#!/bin/bash
set -e

APP_NAME="hikvision-listener"
PORT=4637

echo ""
echo "======================================================"
echo "  Hikvision Event Listener — Birinchi marta deploy"
echo "  (Keyingi yangilashlar uchun: ./update.sh)"
echo "  Port: $PORT"
echo "======================================================"
echo ""

if ! command -v docker &>/dev/null; then
  echo "[ERROR] Docker o'rnatilmagan."
  exit 1
fi

if docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
else
  echo "[ERROR] Docker Compose topilmadi."
  exit 1
fi

echo "[1/4] Eski konteyner to'xtatilmoqda..."
$COMPOSE_CMD down --remove-orphans 2>/dev/null || true

echo "[2/4] Docker image qurilmoqda (npm install — bir marta)..."
$COMPOSE_CMD build

echo "[3/4] Konteyner ishga tushirilmoqda..."
$COMPOSE_CMD up -d

echo "[4/4] Tekshirilmoqda..."
sleep 10

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/api/events 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  echo ""
  echo "======================================================"
  echo "  MUVAFFAQIYATLI ISHGA TUSHDI!"
  echo ""
  echo "  Dashboard:  http://89.167.32.140:$PORT"
  echo ""
  echo "  Keyingi yangilashlar uchun:"
  echo "    ./update.sh"
  echo ""
  echo "  Foydali buyruqlar:"
  echo "    Loglar:    $COMPOSE_CMD logs -f $APP_NAME"
  echo "    To'xtatish: $COMPOSE_CMD down"
  echo "======================================================"
else
  echo "[OGOHLANTIRISH] HTTP $HTTP_CODE. Loglar:"
  $COMPOSE_CMD logs --tail=30
fi
echo ""
