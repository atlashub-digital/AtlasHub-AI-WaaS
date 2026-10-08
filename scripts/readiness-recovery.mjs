import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const args=['compose','--env-file','.env.staging','-f','infra/compose.yml'];
const cmd=(...tail)=>execFileSync('docker',[...args,...tail],{stdio:'pipe'});
assert.equal((await fetch('http://127.0.0.1:4000/ready')).status,200);
try{cmd('stop','postgres');assert.equal((await fetch('http://127.0.0.1:4000/ready')).status,503);}finally{cmd('start','postgres');}
let restored=false;for(let i=0;i<50;i++){if((await fetch('http://127.0.0.1:4000/ready')).status===200){restored=true;break;}await new Promise(r=>setTimeout(r,200));}
assert.ok(restored);console.log('T11: DB outage => readiness 503; restart => readiness 200');
