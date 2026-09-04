#!/bin/sh
set -e

# Extract host and port from DATABASE_URL for TCP check
# DATABASE_URL format: postgresql://user:pass@hostname:5432/dbname
DB_HOST=$(echo $DATABASE_URL | sed 's/.*@//' | sed 's/:.*//' | sed 's/\/.*//')
DB_PORT=5432

echo "⏳ Waiting for Postgres at $DB_HOST:$DB_PORT..."
for i in $(seq 1 30); do
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "✅ Postgres is up!"
    break
  fi
  echo "   Attempt $i/30 — retrying in 3s..."
  sleep 3
done

echo "📐 Pushing schema..."
npx prisma db push --accept-data-loss

echo "🌱 Seeding..."
node prisma/seed.js || echo "⚠️  Seed skipped"

echo "🚀 Starting server..."
exec node src/index.js
