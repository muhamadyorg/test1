#!/bin/bash
set -e

# ============================================================
#  Hikvision Event Listener — VPS Deploy Script
#  Server: 89.167.32.140  |  Port: 4637
# ============================================================

APP_NAME="hikvision-listener"
PORT=4637

echo ""
echo "======================================================"
echo "  Hikvision Event Listener — Deployment"
echo "  Port: $PORT"
echo "======================================================"
echo ""

# --- Docker tekshiruvi ---
if ! command -v docker &>/dev/null; then
  echo "[ERROR] Docker o'rnatilmagan. Avval Docker o'rnating."
  exit 1
fi

if ! command -v docker &>/dev/null || ! docker compose version &>/dev/null 2>&1; then
  if ! command -v docker-compose &>/dev/null; then
    echo "[ERROR] Docker Compose topilmadi."
    exit 1
  fi
  COMPOSE_CMD="docker-compose"
else
  COMPOSE_CMD="docker compose"
fi

echo "[1/5] Eski konteyner to'xtatilmoqda (agar mavjud bo'lsa)..."
$COMPOSE_CMD down --remove-orphans 2>/dev/null || true

echo "[2/5] Docker image qurilmoqda (bu biroz vaqt olishi mumkin)..."
$COMPOSE_CMD build --no-cache

echo "[3/5] Konteyner ishga tushirilmoqda..."
$COMPOSE_CMD up -d

echo "[4/5] Konteyner holati tekshirilmoqda..."
sleep 5
$COMPOSE_CMD ps

echo "[5/5] Ishlayotganini tekshiramiz..."
sleep 3

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/api/events 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  echo ""
  echo "======================================================"
  echo "  MUVAFFAQIYATLI ISHGA TUSHDI!"
  echo ""
  echo "  Dashboard:   http://89.167.32.140:$PORT"
  echo "  Events API:  http://89.167.32.140:$PORT/api/events"
  echo ""
  echo "  Hikvision sozlamalari (Network Service → HTTP Listening):"
  echo "  ┌─────────────────────────────────────────────────────┐"
  echo "  │  Event Alarm IP/Domain Name: 89.167.32.140          │"
  echo "  │  URL:                        /api/events             │"
  echo "  │  Port:                       $PORT                     │"
  echo "  │  Protocol:                   HTTP                    │"
  echo "  └─────────────────────────────────────────────────────┘"
  echo "======================================================"
else
  echo ""
  echo "[OGOHLANTIRISH] Server javob bermadi (HTTP $HTTP_CODE)."
  echo "Loglarni tekshiring:"
  echo "  $COMPOSE_CMD logs --tail=50 $APP_NAME"
  echo ""
  $COMPOSE_CMD logs --tail=30
fi

echo ""
echo "Foydali buyruqlar:"
echo "  Loglar ko'rish:      $COMPOSE_CMD logs -f $APP_NAME"
echo "  To'xtatish:          $COMPOSE_CMD down"
echo "  Qayta ishga tushirish: $COMPOSE_CMD restart $APP_NAME"
echo "  Konteyner holati:    $COMPOSE_CMD ps"
echo ""
