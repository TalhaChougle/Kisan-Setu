#!/bin/sh
set -e

echo "⏳ Waiting for Postgres on postgres:5432..."
until nc -z postgres 5432 2>/dev/null; do
  echo "   Not ready yet, retrying in 2s..."
  sleep 2
done
echo "✅ Postgres is up!"

echo "📐 Pushing schema..."
npx prisma db push --accept-data-loss

echo "🌱 Seeding..."
node prisma/seed.js || echo "⚠️  Seed skipped"

echo "🚀 Starting server..."
exec node src/index.js
