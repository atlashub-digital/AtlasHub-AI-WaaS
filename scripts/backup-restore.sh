#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p artifacts
chmod 700 artifacts
docker compose --env-file .env.staging -f infra/compose.yml exec -T postgres pg_dump -U waas -d waas_staging -Fc > artifacts/staging.dump
# Restores into a separate test database; the source remains untouched.
docker compose --env-file .env.staging -f infra/compose.yml exec -T postgres createdb -U waas waas_restore
docker compose --env-file .env.staging -f infra/compose.yml exec -T postgres pg_restore -U waas -d waas_restore < artifacts/staging.dump
source_count=$(docker compose --env-file .env.staging -f infra/compose.yml exec -T postgres psql -U waas -d waas_staging -Atc 'SELECT count(*) FROM "TaskRun"')
restore_count=$(docker compose --env-file .env.staging -f infra/compose.yml exec -T postgres psql -U waas -d waas_restore -Atc 'SELECT count(*) FROM "TaskRun"')
test "$source_count" = "$restore_count"
printf 'Backup restored into separate database; %s run records verified\n' "$restore_count"
