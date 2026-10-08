import {randomBytes} from 'node:crypto';import {writeFileSync,existsSync,readFileSync,appendFileSync} from 'node:fs';
const runtime=()=>{const p=randomBytes(32).toString('hex');return `RUNTIME_DB_PASSWORD=${p}\nAPP_DATABASE_URL=postgresql://waas_runtime:${p}@127.0.0.1:5432/waas_staging\n`;};
if(existsSync('.env.staging')){
 // Round 2: older files gain the least-privilege runtime credentials; existing values are preserved.
 if(!/^RUNTIME_DB_PASSWORD=/m.test(readFileSync('.env.staging','utf8'))){appendFileSync('.env.staging',runtime());console.log('Added runtime role credentials; no credentials displayed');}
 else console.log('Existing staging configuration preserved');
 process.exit(0);
}
const password=randomBytes(32).toString('hex');
writeFileSync('.env.staging',`DB_PASSWORD=${password}\nDATABASE_URL=postgresql://waas:${password}@127.0.0.1:5432/waas_staging\n${runtime()}AUTH_MODE=staging\nJWT_ISSUER=http://atlashub-staging.local\nJWT_AUDIENCE=atlashub-waas\nSTAGING_JWT_SECRET=${randomBytes(48).toString('hex')}\nINBOUND_HMAC_SECRET=${randomBytes(48).toString('hex')}\nREDIS_HOST=127.0.0.1\nREDIS_PORT=6379\n`,{mode:0o600});
console.log('Generated local staging-only configuration; no credentials displayed');
