#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing Python dependencies"
pip install --upgrade pip
pip install -r backend/requirements-api.txt

echo "==> Setting Prisma binary cache inside project"
export PRISMA_BINARY_CACHE_DIR="$(pwd)/backend/.prisma"
mkdir -p "$PRISMA_BINARY_CACHE_DIR"

echo "==> Generating Prisma client"
cd backend
python -m prisma generate --schema=prisma/schema.prisma

echo "==> Fetching Prisma query engine"
python -m prisma py fetch --schema=prisma/schema.prisma
cd ..

echo "==> Build complete"
