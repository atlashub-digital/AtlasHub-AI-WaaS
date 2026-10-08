#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
restore_db=${RESTORE_DB:-waas_restore}
[[ "$restore_db" =~ ^waas_restore[a-z0-9_]*$ ]] || { echo 'Invalid restore target'; exit 1; }
mkdir -p artifacts
chmod 700 artifacts
docker compose --env-file .env.staging -f infra/compose.yml exec -T postgres pg_dump -U waas -d waas_staging -Fc > artifacts/staging.dump
# Restores into a separate test database; the source remains untouched.
docker compose --env-file .env.staging -f infra/compose.yml exec -T postgres createdb -U waas "$restore_db"
docker compose --env-file .env.staging -f infra/compose.yml exec -T postgres pg_restore -U waas -d "$restore_db" < artifacts/staging.dump
source_count=$(docker compose --env-file .env.staging -f infra/compose.yml exec -T postgres psql -U waas -d waas_staging -Atc 'SELECT count(*) FROM "TaskRun"')
restore_count=$(docker compose --env-file .env.staging -f infra/compose.yml exec -T postgres psql -U waas -d "$restore_db" -Atc 'SELECT count(*) FROM "TaskRun"')
test "$source_count" = "$restore_count"
printf 'Backup restored into separate database; %s run records verified\n' "$restore_count"
