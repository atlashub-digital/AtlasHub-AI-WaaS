#!/usr/bin/env bash
# Deploy do staging AI-WaaS isolado na VPS (Round 2). Correr no próprio host, como root.
# Não toca em Caddy, n8n, Chatwoot, LeveLab/LIA nem noutros projetos Compose.
# Idempotente: preserva .env.staging e volumes existentes.
set -euo pipefail
DIR=${DIR:-/srv/apps/ai-waas-staging}
REPO=${REPO:-https://github.com/atlashub-digital/AtlasHub-AI-WaaS.git}
REF=${REF:-main}
COMPOSE="docker compose --env-file .env.staging -f infra/compose.staging-remote.yml"

avail=$(free -m | awk '/Mem/{print $7}')
[ "$avail" -ge 2048 ] || { echo "Memória disponível ${avail}MiB < 2048MiB; abortado"; exit 1; }

if [ ! -d "$DIR/.git" ]; then git clone -q "$REPO" "$DIR"; fi
cd "$DIR"
git fetch -q origin "$REF" && git checkout -q "$REF" && git pull -q --ff-only origin "$REF" || true
[ -f infra/compose.staging-remote.yml ] || { echo "infra/compose.staging-remote.yml em falta"; exit 1; }

if [ ! -f .env.staging ]; then
  ( umask 077; python3 - <<'EOF'
import secrets
open(".env.staging","w").write(
 f"DB_PASSWORD={secrets.token_hex(32)}\nAUTH_MODE=staging\nJWT_ISSUER=http://atlashub-staging.local\n"
 f"JWT_AUDIENCE=atlashub-waas\nSTAGING_JWT_SECRET={secrets.token_hex(48)}\n"
 f"INBOUND_HMAC_SECRET={secrets.token_hex(48)}\nREDIS_PORT=6379\nPORT=4000\nNODE_ENV=staging\n")
EOF
  )
  echo "Gerado .env.staging (0600); valores não exibidos"
fi
# Round 2: credenciais da role de runtime (least privilege), acrescentadas se faltarem.
if ! grep -q '^RUNTIME_DB_PASSWORD=' .env.staging; then
  ( umask 077; python3 -c 'import secrets;print(f"RUNTIME_DB_PASSWORD={secrets.token_hex(32)}")' >> .env.staging )
  echo "Acrescentada RUNTIME_DB_PASSWORD; valor não exibido"
fi
set -a; . ./.env.staging; set +a
OWNER_URL="postgresql://waas:${DB_PASSWORD}@postgres:5432/waas_staging"

$COMPOSE build api
$COMPOSE up -d --wait postgres redis
# Migrations, role e seed com a role dona; API e worker com waas_runtime.
$COMPOSE run --rm --no-deps -e DATABASE_URL="$OWNER_URL" api node scripts/migrate.mjs
$COMPOSE run --rm --no-deps -e DATABASE_URL="$OWNER_URL" -e RUNTIME_DB_PASSWORD api node scripts/runtime-role.mjs
$COMPOSE run --rm --no-deps -e DATABASE_URL="$OWNER_URL" api node scripts/seed.mjs
$COMPOSE run --rm --no-deps -e DATABASE_URL="$OWNER_URL" api node scripts/seed-roles.mjs
$COMPOSE up -d --wait --force-recreate api worker
$COMPOSE ps
curl -fsS http://127.0.0.1:14000/health && echo && curl -fsS http://127.0.0.1:14000/ready && echo
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'levelab|atendimento-(api|chatwoot|evolution)|n8n'
