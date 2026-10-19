#!/usr/bin/env bash
# Carga datos iniciales (roles, temas, layouts, plantillas y curso demo si SEED_DEMO=true).
# Es idempotente: no duplica lo que ya existe.
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose exec backend node dist/seed.js
