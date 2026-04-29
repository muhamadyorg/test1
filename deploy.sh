#!/bin/bash
set -e

# ============================================================
# deploy.sh — Shop Catalog Deployment Script
# 
# Bu skript quyidagilarni bajaradi:
#   1. Kerakli dasturlarni tekshiradi (Node.js, pnpm, Nginx, PostgreSQL, Git)
#   2. GitHub-dan reponi clone yoki pull qiladi
#   3. Dependencylarni o'rnatadi va build qiladi
#   4. PostgreSQL bazasini sozladi
#   5. Systemd xizmati yaratadi (API Server)
#   6. Nginx konfiguratsiyasini yozadi
#   7. SSL sertifikatini sozlaydi (ixtiyoriy, Certbot orqali)
# ============================================================

# ============================================================
# KONFIGURATSIYA — bu qismni o'zgartiring
# ============================================================

REPO_URL="${REPO_URL:-https://github.com/your-username/shop-catalog.git}"
APP_DIR="${APP_DIR:-/opt/shop-catalog}"
DOMAIN="${DOMAIN:-example.com}"
APP_PORT="${APP_PORT:-8080}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
DB_NAME="${DB_NAME:-shop_catalog}"
DB_USER="${DB_USER:-shop_user}"
DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 32)}"
SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -base64 64)}"
NODE_VERSION="${NODE_VERSION:-20}"
USE_SSL="${USE_SSL:-false}"   # "true" yoki "false"

# ============================================================
# Ranglar
# ============================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ============================================================
# Root huquqlarini tekshirish
# ============================================================
if [ "$EUID" -ne 0 ]; then
  log_error "Bu skriptni root huquqi bilan ishga tushiring: sudo bash deploy.sh"
fi

# ============================================================
# 1. Kerakli dasturlarni o'rnatish
# ============================================================
log_info "Kerakli dasturlar tekshirilmoqda..."

install_if_missing() {
  if ! command -v "$1" &>/dev/null; then
    log_info "$1 o'rnatilmoqda..."
    apt-get install -y "$2" || log_error "$1 o'rnatib bo'lmadi"
  else
    log_success "$1 mavjud"
  fi
}

apt-get update -q

# Git
install_if_missing git git

# Curl
install_if_missing curl curl

# Nginx
install_if_missing nginx nginx

# PostgreSQL
if ! command -v psql &>/dev/null; then
  log_info "PostgreSQL o'rnatilmoqda..."
  apt-get install -y postgresql postgresql-contrib
fi
log_success "PostgreSQL mavjud"

# Node.js (nvm orqali yoki nodesource)
if ! command -v node &>/dev/null; then
  log_info "Node.js $NODE_VERSION o'rnatilmoqda (nodesource orqali)..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi
log_success "Node.js: $(node --version)"

# pnpm
if ! command -v pnpm &>/dev/null; then
  log_info "pnpm o'rnatilmoqda..."
  npm install -g pnpm
fi
log_success "pnpm: $(pnpm --version)"

# ============================================================
# 2. Reponi clone yoki pull qilish
# ============================================================
log_info "Repo sozlanmoqda: $REPO_URL -> $APP_DIR"

if [ -d "$APP_DIR/.git" ]; then
  log_info "Repo allaqachon mavjud. git pull amalga oshirilmoqda..."
  cd "$APP_DIR"
  git pull origin main || git pull origin master || log_error "git pull bajarib bo'lmadi"
  log_success "Repo yangilandi"
else
  log_info "Repo clone qilinmoqda..."
  git clone "$REPO_URL" "$APP_DIR" || log_error "git clone bajarib bo'lmadi"
  log_success "Repo clone qilindi: $APP_DIR"
fi

cd "$APP_DIR"

# ============================================================
# 3. PostgreSQL bazasini sozlash
# ============================================================
log_info "PostgreSQL baza sozlanmoqda..."

systemctl start postgresql
systemctl enable postgresql

# Foydalanuvchi va baza yaratish (agar yo'q bo'lsa)
sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$DB_USER') THEN
    CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME') \gexec

GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
SQL

log_success "Baza tayyor: $DB_NAME"

# pgcrypto extension (parol hashlash uchun)
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" 2>/dev/null || true

# ============================================================
# 4. .env fayli yaratish
# ============================================================
log_info ".env fayli yaratilmoqda..."

ENV_FILE="$APP_DIR/.env"
cat > "$ENV_FILE" <<ENV
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}
PGHOST=localhost
PGPORT=5432
PGUSER=${DB_USER}
PGPASSWORD=${DB_PASSWORD}
PGDATABASE=${DB_NAME}
SESSION_SECRET=${SESSION_SECRET}
NODE_ENV=production
PORT=${APP_PORT}
ENV

chmod 600 "$ENV_FILE"
log_success ".env fayli yaratildi: $ENV_FILE"

# ============================================================
# 5. Dependencylarni o'rnatish va build qilish
# ============================================================
log_info "Dependencylar o'rnatilmoqda..."
cd "$APP_DIR"

# pnpm approve-builds (bcrypt kabi native modullar uchun)
pnpm approve-builds --yes 2>/dev/null || true
pnpm install --frozen-lockfile || pnpm install

log_info "Zod sxemalari generatsiya qilinmoqda..."
pnpm --filter @workspace/api-spec run codegen 2>/dev/null || true

log_info "DB sxemasi push qilinmoqda..."
set -a && source "$ENV_FILE" && set +a
pnpm --filter @workspace/db run push || log_error "DB push bajarib bo'lmadi"

log_info "API Server build qilinmoqda..."
NODE_ENV=production pnpm --filter @workspace/api-server run build || log_error "API Server build xato"

log_info "Frontend build qilinmoqda..."
BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/shop-catalog run build || log_error "Frontend build xato"

log_success "Build muvaffaqiyatli yakunlandi"

# ============================================================
# 6. Systemd xizmati (API Server)
# ============================================================
log_info "Systemd xizmati yaratilmoqda..."

SYSTEMD_FILE="/etc/systemd/system/shop-catalog-api.service"

cat > "$SYSTEMD_FILE" <<UNIT
[Unit]
Description=Shop Catalog API Server
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node --enable-source-maps $APP_DIR/artifacts/api-server/dist/index.mjs
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=shop-catalog-api

[Install]
WantedBy=multi-user.target
UNIT

# www-data foydalanuvchisiga ruxsat berish
chown -R www-data:www-data "$APP_DIR" 2>/dev/null || true

systemctl daemon-reload
systemctl enable shop-catalog-api
systemctl restart shop-catalog-api

log_success "API Server systemd xizmati ishga tushdi"

# ============================================================
# 7. Nginx konfiguratsiyasi
# ============================================================
log_info "Nginx konfiguratsiya qilinmoqda..."

NGINX_CONF="/etc/nginx/sites-available/shop-catalog"
FRONTEND_DIST="$APP_DIR/artifacts/shop-catalog/dist/public"

cat > "$NGINX_CONF" <<NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Frontend — static files
    root $FRONTEND_DIST;
    index index.html;

    # API va WebSocket — backend ga proxy
    location /api/ {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
    }

    # WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 3600;
    }

    # Static frontend — SPA routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Service Worker — no cache
    location = /sw.js {
        add_header Cache-Control "no-cache";
        expires 0;
    }
}
NGINX

# Symlink yaratish
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/shop-catalog

# Default site o'chirish
rm -f /etc/nginx/sites-enabled/default

# Nginx konfiguratsiyasini tekshirish
nginx -t || log_error "Nginx konfiguratsiya xatosi"

systemctl enable nginx
systemctl restart nginx

log_success "Nginx sozlandi: http://$DOMAIN"

# ============================================================
# 8. SSL (Certbot) — ixtiyoriy
# ============================================================
if [ "$USE_SSL" = "true" ]; then
  log_info "SSL sertifikati sozlanmoqda (Certbot)..."

  if ! command -v certbot &>/dev/null; then
    apt-get install -y certbot python3-certbot-nginx
  fi

  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" || log_warn "Certbot xato — SSL qo'lda o'rnatish kerak"
  log_success "SSL sertifikati o'rnatildi"
fi

# ============================================================
# 9. Admin foydalanuvchisini yaratish (agar yo'q bo'lsa)
# ============================================================
log_info "Admin foydalanuvchisi yaratilmoqda..."

sudo -u postgres psql -d "$DB_NAME" <<ADMIN
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM users WHERE username = 'admin') THEN
    INSERT INTO users (username, password_hash, role, created_at)
    VALUES ('admin', crypt('admin123', gen_salt('bf')), 'admin', NOW());
    RAISE NOTICE 'Admin yaratildi: admin / admin123';
  ELSE
    RAISE NOTICE 'Admin allaqachon mavjud';
  END IF;
END
\$\$;
ADMIN

# ============================================================
# Yakuniy xuborot
# ============================================================
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN}  MUVAFFAQIYATLI DEPLOY QILINDI!${NC}"
echo -e "${GREEN}============================================================${NC}"
echo ""
echo -e "  Sayt manzili:     ${BLUE}http://$DOMAIN${NC}"
if [ "$USE_SSL" = "true" ]; then
echo -e "  HTTPS:            ${BLUE}https://$DOMAIN${NC}"
fi
echo -e "  Admin login:      ${YELLOW}admin${NC}"
echo -e "  Admin parol:      ${YELLOW}admin123${NC}  (kirganingizda o'zgartiring!)"
echo -e "  API endpoint:     ${BLUE}http://$DOMAIN/api${NC}"
echo ""
echo -e "  Yangilash uchun skriptni qayta ishga tushiring:"
echo -e "    ${YELLOW}sudo DOMAIN=$DOMAIN bash $APP_DIR/deploy.sh${NC}"
echo ""
echo -e "${GREEN}============================================================${NC}"
