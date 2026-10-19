#!/usr/bin/env bash
# Descarga el logo y favicon de EMA Servicios a frontend/public/brand (para desarrollo local).
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/fetch-brand.mjs
