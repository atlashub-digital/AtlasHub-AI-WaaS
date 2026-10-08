import {randomBytes} from 'node:crypto';import {writeFileSync,existsSync} from 'node:fs';
if(existsSync('.env.staging')){console.log('Existing staging configuration preserved');process.exit(0);}
const password=randomBytes(32).toString('hex');
writeFileSync('.env.staging',`DB_PASSWORD=${password}\nDATABASE_URL=postgresql://waas:${password}@127.0.0.1:5432/waas_staging\nAUTH_MODE=staging\nJWT_ISSUER=http://atlashub-staging.local\nJWT_AUDIENCE=atlashub-waas\nSTAGING_JWT_SECRET=${randomBytes(48).toString('hex')}\nINBOUND_HMAC_SECRET=${randomBytes(48).toString('hex')}\nREDIS_HOST=127.0.0.1\nREDIS_PORT=6379\n`,{mode:0o600});
console.log('Generated local staging-only configuration; no credentials displayed');
