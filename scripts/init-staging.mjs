import {randomBytes} from 'node:crypto';import {writeFileSync,existsSync,readFileSync,appendFileSync} from 'node:fs';
const runtime=()=>{const p=randomBytes(32).toString('hex');return `RUNTIME_DB_PASSWORD=${p}\nAPP_DATABASE_URL=postgresql://waas_runtime:${p}@127.0.0.1:5432/waas_staging\n`;};
// Phase B: sandbox payments and fast trial expiry for staging tests.
const commerce=()=>`PAYMENTS_MODE=sandbox\nSANDBOX_PAYMENTS_SECRET=${randomBytes(32).toString('hex')}\nCONCIERGE_SERVICE_KEY=${randomBytes(32).toString('hex')}\nTRIAL_EXPIRY_INTERVAL_MS=5000\n`;
if(existsSync('.env.staging')){
 // Older files gain new keys; existing values are preserved.
 const current=readFileSync('.env.staging','utf8');
 if(!/^RUNTIME_DB_PASSWORD=/m.test(current)){appendFileSync('.env.staging',runtime());console.log('Added runtime role credentials; no credentials displayed');}
 if(!/^SANDBOX_PAYMENTS_SECRET=/m.test(current)){appendFileSync('.env.staging',commerce());console.log('Added sandbox payment settings; no credentials displayed');}
 process.exit(0);
}
const password=randomBytes(32).toString('hex');
writeFileSync('.env.staging',`DB_PASSWORD=${password}\nDATABASE_URL=postgresql://waas:${password}@127.0.0.1:5432/waas_staging\n${runtime()}${commerce()}AUTH_MODE=staging\nJWT_ISSUER=http://atlashub-staging.local\nJWT_AUDIENCE=atlashub-waas\nSTAGING_JWT_SECRET=${randomBytes(48).toString('hex')}\nINBOUND_HMAC_SECRET=${randomBytes(48).toString('hex')}\nREDIS_HOST=127.0.0.1\nREDIS_PORT=6379\n`,{mode:0o600});
console.log('Generated local staging-only configuration; no credentials displayed');
