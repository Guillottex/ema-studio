#!/usr/bin/env bash
# Respaldo de la base de datos y de los archivos subidos en ./backups/<fecha>/
set -euo pipefail
cd "$(dirname "$0")/.."
source .env
DIR="backups/$(date +%Y%m%d-%H%M%S)"; mkdir -p "$DIR"
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-ema}" "${POSTGRES_DB:-ema_studio}" > "$DIR/db.sql"
docker compose exec -T backend tar -C /data -czf - . > "$DIR/data.tar.gz"
echo "✅ Respaldo en $DIR"
