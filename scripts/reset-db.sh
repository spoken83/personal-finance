#!/bin/bash
# Reset the database from the JSON dump (baseline snapshot)
# Usage: ./scripts/reset-db.sh

set -e

cd "$(dirname "$0")/.."

echo "=== Resetting database to baseline ==="

echo "1/2 Pushing schema (recreate tables)..."
npx drizzle-kit push --force 2>&1 | tail -3

echo "2/2 Restoring from JSON dump..."
npx tsx scripts/restore-db.ts 2>&1 | grep -v -e Warning -e 'major version' -e 'prepare for' -e 'current behavior' -e 'libpq' -e 'postgresql.org' -e 'node --trace'

echo ""
echo "=== Done! Database restored to baseline ==="
