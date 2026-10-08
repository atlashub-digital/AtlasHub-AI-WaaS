#!/usr/bin/env bash
# Imports and activates the AI-WaaS staging workflows (infra/n8n/*.json) in the existing n8n through its
# public API — no n8n restart, no change to other workflows. Run on the n8n host from the repository root.
# Reads the API key from a 0600 file; generates shared secrets without printing them. Idempotent.
set -euo pipefail
KEYS=${KEYS_DIR:-/root/.config/atlas}
N8N_LOCAL=${N8N_LOCAL:-http://127.0.0.1:5678}
N8N_PUBLIC=${N8N_PUBLIC:-https://n8n.atlashub.si}
APP_ENV=${APP_ENV:-.env.supabase-app}
umask 077
[ -s "$KEYS/n8n-waas-token" ] || python3 -c 'import secrets;print(secrets.token_hex(32),end="")' > "$KEYS/n8n-waas-token"
[ -s "$KEYS/n8n-waas-signing" ] || python3 -c 'import secrets;print(secrets.token_hex(32),end="")' > "$KEYS/n8n-waas-signing"

python3 - "$N8N_LOCAL" "$KEYS" <<'EOF'
import json,glob,sys,urllib.request,urllib.error
base,keys=sys.argv[1:]
key=open(f'{keys}/n8n-api-key').read().strip()
def call(method,path,body=None):
    req=urllib.request.Request(f'{base}/api/v1{path}',method=method,headers={'X-N8N-API-KEY':key,'Content-Type':'application/json','Accept':'application/json'},data=json.dumps(body).encode() if body is not None else None)
    try:
        with urllib.request.urlopen(req,timeout=20) as r: return r.status,json.loads(r.read() or b'{}')
    except urllib.error.HTTPError as e: return e.code,json.loads(e.read() or b'{}')
cred_file=f'{keys}/n8n-waas-credential-id'
try: cred=open(cred_file).read().strip()
except FileNotFoundError: cred=''
if not cred:
    s,c=call('POST','/credentials',{'name':'waas-staging X-Atlas-Token','type':'httpHeaderAuth','data':{'name':'X-Atlas-Token','value':open(f'{keys}/n8n-waas-token').read().strip()}})
    if s>=300: sys.exit(f'credential: HTTP {s} {c.get("message","")}')
    cred=c['id']; open(cred_file,'w').write(cred)
s,listing=call('GET','/workflows?limit=250')
existing={w['name']:w for w in listing.get('data',[])}
for path in sorted(glob.glob('infra/n8n/*.json')):
    wf=json.loads(open(path).read().replace('__CREDENTIAL_ID__',cred))
    body={k:wf[k] for k in ('name','nodes','connections','settings')}
    if wf['name'] in existing:
        wid=existing[wf['name']]['id']; s,_=call('PUT',f'/workflows/{wid}',body)
    else:
        s,created=call('POST','/workflows',body); wid=created.get('id')
    if s>=300 or not wid: sys.exit(f'{wf["name"]}: HTTP {s}')
    s,act=call('POST',f'/workflows/{wid}/activate')
    print(f'{wf["name"]}\tid={wid}\tactive={act.get("active", s<300)}')
EOF

# Wire the Supabase staging stack to n8n (public HTTPS endpoint behind the existing edge).
if [ -f "$APP_ENV" ] && ! grep -q '^N8N_BASE_URL=' "$APP_ENV"; then
  { echo "N8N_BASE_URL=$N8N_PUBLIC"; echo "N8N_TOKEN=$(cat "$KEYS/n8n-waas-token")"; echo "N8N_SIGNING_SECRET=$(cat "$KEYS/n8n-waas-signing")"; echo "N8N_TIMEOUT_MS=10000"; } >> "$APP_ENV"
  echo "Configuração n8n acrescentada a $APP_ENV (valores não exibidos)"
fi
