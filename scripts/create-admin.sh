#!/usr/bin/env bash
# Crea o restablece un administrador.
# Uso: ./scripts/create-admin.sh email@empresa.com 'Contraseña123' "Nombre Apellido"
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -lt 2 ] && { echo "Uso: $0 <email> <contraseña> [\"Nombre\"]"; exit 1; }
docker compose exec backend node dist/create-admin.js "$1" "$2" "${3:-Administrador}"
