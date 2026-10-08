// Enables login for waas_runtime with RUNTIME_DB_PASSWORD. The password itself is never printed.
//   node scripts/runtime-role.mjs           ALTER ROLE via the owner DATABASE_URL (local/staging Postgres)
//   node scripts/runtime-role.mjs --scram   print only a SCRAM-SHA-256 verifier, for managed databases where
//                                           the role is altered from an admin console (the plaintext stays here)
import pg from 'pg';import {pbkdf2Sync,createHmac,createHash,randomBytes} from 'node:crypto';
const password=process.env.RUNTIME_DB_PASSWORD;
if(!password||password.length<32)throw new Error('RUNTIME_DB_PASSWORD (>=32 chars) required');
function scram(secret){const salt=randomBytes(16),iterations=4096;const salted=pbkdf2Sync(secret.normalize('NFKC'),salt,iterations,32,'sha256');
 const stored=createHash('sha256').update(createHmac('sha256',salted).update('Client Key').digest()).digest();const server=createHmac('sha256',salted).update('Server Key').digest();
 return `SCRAM-SHA-256$${iterations}:${salt.toString('base64')}$${stored.toString('base64')}:${server.toString('base64')}`;}
if(process.argv.includes('--scram')){console.log(scram(password));process.exit(0);}
const client=new pg.Client({connectionString:process.env.DATABASE_URL});await client.connect();
try{await client.query(`ALTER ROLE waas_runtime LOGIN PASSWORD ${client.escapeLiteral(scram(password))}`);console.log('waas_runtime login enabled');}finally{await client.end();}
