#!/bin/sh
set -eu

echo "[flowops] Applying migrations (retry until Postgres is ready)…"
i=0
until npx prisma migrate deploy; do
  i=$((i + 1))
  if [ "$i" -gt 40 ]; then
    echo "[flowops] migrate deploy failed after retries" >&2
    exit 1
  fi
  echo "[flowops] Postgres not ready — retry $i/40…"
  sleep 2
done

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "[flowops] Seeding demo data…"
  npx prisma db seed || echo "[flowops] Seed warning (may already be applied)"
fi

echo "[flowops] Starting: $*"
exec "$@"
