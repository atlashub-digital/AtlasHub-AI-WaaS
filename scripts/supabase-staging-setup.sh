#!/usr/bin/env bash
# Supabase staging (Round 2 / G1). Runs on the staging host, from the repository root, as root.
# Reads credentials from 0600 files, never prints them. Idempotent: existing config and users are kept.
set -euo pipefail
REF=${SUPABASE_REF:-aakdyumavlzgyklbrsrw}
POOLER=${SUPABASE_POOLER:-aws-1-eu-west-1.pooler.supabase.com}
KEYS=${KEYS_DIR:-/root/.config/atlas}
AUTH="https://${REF}.supabase.co/auth/v1"
umask 077

[ -s .env.supabase ] || { echo "falta .env.supabase (password de waas_runtime no Supabase)"; exit 1; }
set -a; . ./.env.supabase; set +a
SECRET=$(cat "$KEYS/supabase-secret-key")

if [ ! -f .env.supabase-app ]; then
  python3 - "$REF" "$POOLER" "$KEYS" <<'EOF'
import os,sys,secrets,urllib.parse
ref,pooler,keys=sys.argv[1:]
pw=urllib.parse.quote(os.environ['SUPABASE_RUNTIME_DB_PASSWORD'],safe='')
orkey=open(f'{keys}/openrouter-key').read().strip() if os.path.exists(f'{keys}/openrouter-key') else ''
lines=[f'DATABASE_URL=postgresql://waas_runtime.{ref}:{pw}@{pooler}:6543/postgres?uselibpqcompat=true&sslmode=require',
 'AUTH_MODE=supabase',f'JWT_ISSUER=https://{ref}.supabase.co/auth/v1',f'JWT_JWKS_URL=https://{ref}.supabase.co/auth/v1/.well-known/jwks.json','JWT_AUDIENCE=authenticated',
 f'INBOUND_HMAC_SECRET={secrets.token_hex(48)}','NODE_ENV=staging','PORT=4000','REDIS_PORT=6379',
 *(['LLM_ENABLED=1','LLM_PROVIDER=openrouter',f'OPENROUTER_API_KEY={orkey}','LLM_TENANT_DAILY_USD=1'] if orkey else [])]
open('.env.supabase-app','w').write('\n'.join(lines)+'\n')
EOF
  echo "Gerado .env.supabase-app (0600); valores não exibidos"
fi

# Test users in Supabase Auth (confirmed, random passwords kept only in .supabase-users).
python3 - "$AUTH" "$SECRET" <<'EOF'
import json,os,sys,secrets,urllib.request,urllib.error
auth,key=sys.argv[1:]
hdr={'apikey':key,'Authorization':f'Bearer {key}','Content-Type':'application/json'}
def call(method,path,body=None):
    req=urllib.request.Request(auth+path,method=method,headers=hdr,data=json.dumps(body).encode() if body else None)
    try:
        with urllib.request.urlopen(req,timeout=20) as r: return r.status,json.load(r)
    except urllib.error.HTTPError as e: return e.code,json.loads(e.read() or b'{}')
store=json.load(open('.supabase-users')) if os.path.exists('.supabase-users') else {}
_,listing=call('GET','/admin/users?per_page=200')
existing={u['email']:u['id'] for u in listing.get('users',[])}
for name in ['owner','admin-a','viewer-a','admin-b']:
    email=f'staging-{name}@staging.atlashub.test'
    if email in existing and name in store: store[name]['id']=existing[email]; continue
    pw=secrets.token_urlsafe(24)
    if email in existing: status,u=call('PUT',f'/admin/users/{existing[email]}',{'password':pw})
    else: status,u=call('POST','/admin/users',{'email':email,'password':pw,'email_confirm':True})
    if status>=300: sys.exit(f'falha ao criar {name}: HTTP {status}')
    store[name]={'id':u['id'],'email':email,'password':pw}
open('.supabase-users','w').write(json.dumps(store))
for n,u in store.items(): print(f'{n}\t{u["id"]}\t{u["email"]}')
EOF

docker compose -f infra/compose.supabase-staging.yml up -d --wait
curl -fsS http://127.0.0.1:14100/health && echo && curl -fsS http://127.0.0.1:14100/ready && echo
