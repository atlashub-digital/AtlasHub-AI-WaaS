#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/init-staging.mjs
set -a
source .env.staging
set +a
export npm_config_cache=/workspace/.npm-cache
docker compose --env-file .env.staging -f infra/compose.yml up -d --wait
npm run db:generate
npm run db:deploy
node scripts/runtime-role.mjs
npm run db:seed
npm run build
