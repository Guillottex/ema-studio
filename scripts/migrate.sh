#!/usr/bin/env bash
# Aplica las migraciones pendientes de /database/migrations
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose exec backend node dist/migrate.js
