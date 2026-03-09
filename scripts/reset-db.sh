#!/bin/bash
# Reset the database from the JSON dump (baseline snapshot)
# Usage: ./scripts/reset-db.sh

set -e

cd "$(dirname "$0")/.."

FILTER='grep -v -e Warning -e "major version" -e "prepare for" -e "current behavior" -e libpq -e postgresql.org -e "node --trace"'

echo "=== Resetting database to baseline ==="

echo "1/2 Resetting schema (drop all tables + recreate)..."
npx prisma migrate reset --force --skip-seed 2>&1 | tail -3

echo "2/2 Restoring from JSON dump..."
npx tsx scripts/restore-db.ts 2>&1 | grep -v -e Warning -e 'major version' -e 'prepare for' -e 'current behavior' -e 'libpq' -e 'postgresql.org' -e 'node --trace'

echo ""
echo "=== Done! Database restored to baseline ==="
