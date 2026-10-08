import {mkdirSync} from 'node:fs';import {chromium} from 'playwright-core';import assert from 'node:assert/strict';import {SignJWT} from 'jose';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:3000');await page.getByRole('link',{name:'Portal do cliente'}).click();await page.waitForURL('**/login');assert.ok(await page.getByRole('button',{name:'Entrar',exact:true}).isVisible());
for(const slug of ['clinic-appointment-confirmation','sales-assistant','administrative-secretary']){await page.goto(`http://127.0.0.1:3000/simulador/${slug}`);assert.equal((await page.locator('h1').count()),1);assert.ok((await page.locator('body').innerText()).includes('fictíc'));}
await page.goto('http://127.0.0.1:3000/assessment');await page.getByRole('textbox',{name:'Empresa',exact:true}).fill('Empresa Fictícia Browser');await page.getByRole('textbox',{name:'Necessidade administrativa'}).fill('Confirmação sintética de consultas');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Solicitar assessment'}).click();await page.waitForURL('**/assessment?sent=1');assert.ok(await page.getByRole('status').isVisible());
const token=await new SignJWT({}).setProtectedHeader({alg:'HS256'}).setSubject('admin-A').setIssuer(process.env.JWT_ISSUER).setAudience(process.env.JWT_AUDIENCE).setExpirationTime('10m').sign(new TextEncoder().encode(process.env.STAGING_JWT_SECRET));
await context.addCookies([{name:'waas_session',value:token,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Strict'}]);await page.goto('http://127.0.0.1:3000/portal?tenant=tenant-A');assert.ok((await page.locator('body').innerText()).includes('Serviço gerido · Atividade'));assert.ok(!(await page.locator('body').innerText()).includes('appointment-B'));
mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/portal-staging.png',fullPage:true});
await page.goto('http://127.0.0.1:3000/portal?tenant=tenant-B');assert.ok((await page.locator('body').innerText()).includes('Acesso indisponível'));
assert.deepEqual(errors,[]);console.log('Browser: anonymous login redirect, 3 demos, consented assessment, authorized portal and cross-tenant denial PASS. Supabase login not exercised.');
}finally{await browser.close();}
