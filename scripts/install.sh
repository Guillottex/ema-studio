#!/usr/bin/env bash
# Instalación de EMA Studio con Docker.
# Uso: ./scripts/install.sh
set -euo pipefail
cd "$(dirname "$0")/.."

command -v docker >/dev/null || { echo "❌ Docker no está instalado"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "❌ Falta el plugin 'docker compose'"; exit 1; }

if [ ! -f .env ]; then
  cp .env.example .env
  rand() { (openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'); }
  sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=$(rand)/" .env
  sed -i.bak "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(rand | cut -c1-24)/" .env
  rm -f .env.bak
  echo "✅ Archivo .env creado con secretos aleatorios. Revisalo antes de pasar a producción."
fi

docker compose up -d --build
PORT=$(grep -E '^APP_PORT=' .env | cut -d= -f2); PORT=${PORT:-8080}
echo ""
echo "⏳ Esperando a que el backend esté listo…"
for i in $(seq 1 60); do
  if curl -fs "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
    echo "✅ EMA Studio está corriendo en http://localhost:${PORT}"
    echo "   Usuario: $(grep -E '^ADMIN_EMAIL=' .env | cut -d= -f2)  ·  Contraseña: la definida en ADMIN_PASSWORD"
    exit 0
  fi
  sleep 3
done
echo "⚠️  El backend tardó demasiado. Revisá: docker compose logs backend"
