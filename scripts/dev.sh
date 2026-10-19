#!/usr/bin/env bash
# Entorno de desarrollo sin Docker para la app (requiere Node 20+ y un PostgreSQL accesible).
#   DATABASE_URL=postgres://ema:ema@localhost:5432/ema_studio ./scripts/dev.sh
set -euo pipefail
cd "$(dirname "$0")/.."
(cd scorm-engine && npm install && npm run build)
(cd backend && npm install)
(cd frontend && npm install)
export DATA_DIR=${DATA_DIR:-./data}
(cd backend && npm run dev) &
(cd frontend && npm run dev) &
wait
