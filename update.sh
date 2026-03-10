#!/bin/bash
set -e

APP_NAME="hikvision-listener"
PORT=4637

if docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
else
  echo "[ERROR] Docker Compose topilmadi."
  exit 1
fi

echo ""
echo "======================================================"
echo "  Hikvision — Tezkor yangilash (git pull + restart)"
echo "======================================================"
echo ""

echo "[1/3] GitHub dan yangi kod olinmoqda..."
git pull

echo "[2/3] Konteyner qayta ishga tushirilmoqda..."
$COMPOSE_CMD restart $APP_NAME

echo "[3/3] Tekshirilmoqda..."
sleep 8

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/api/events 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  echo ""
  echo "======================================================"
  echo "  YANGILANDI! Dashboard: http://89.167.32.140:$PORT"
  echo "======================================================"
else
  echo "[OGOHLANTIRISH] HTTP $HTTP_CODE. Loglar:"
  $COMPOSE_CMD logs --tail=20 $APP_NAME
fi
echo ""
