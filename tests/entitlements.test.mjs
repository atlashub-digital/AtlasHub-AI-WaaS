import test from 'node:test';import assert from 'node:assert/strict';
import {activeKeys,allowsRole,allowsTool,enforcing,modulesOf,moduleOfTool,MODULE_KEYS} from '../dist/packages/contracts/entitlements.js';
const now=new Date('2026-10-09T12:00:00Z');const row=(key,o={})=>({key,status:'active',validFrom:new Date('2026-01-01'),validUntil:null,...o});
test('only active, started and unexpired rows count',()=>{
 const keys=activeKeys([row('module.ami'),row('module.workforce',{status:'revoked'}),row('mission.tpl-1',{validUntil:new Date('2026-10-01')}),row('module.media',{validFrom:new Date('2026-11-01')}),row('module.ami')],now);
 assert.deepEqual(keys,['module.ami']);
 assert.deepEqual(activeKeys([row('mission.tpl-1',{validUntil:now})],now),[],'validUntil is exclusive');
});
test('modules come from module.<m>, missions and role products; unknown modules are ignored',()=>{
 assert.deepEqual(MODULE_KEYS,['workforce','ami','community','media']);
 assert.deepEqual(modulesOf(['module.ami','module.unknown']),['ami']);
 assert.deepEqual(modulesOf(['mission.tpl-2']),['workforce']);
 assert.deepEqual(modulesOf(['product.addon-x']),[],'a product without a role does not open Workforce');
 assert.deepEqual(modulesOf(['product.p-5'],{'product.p-5':'ROLE-005'}),['workforce']);
});
test('a role needs a module listing it or the mission/product that sold exactly that role',()=>{
 assert.equal(allowsRole([],'ROLE-001'),false);
 assert.equal(allowsRole(['module.workforce'],'ROLE-006'),true);
 assert.equal(allowsRole(['module.ami'],'ROLE-006'),false,'AMI does not unlock Workforce roles');
 assert.equal(allowsRole(['mission.tpl-2'],'ROLE-002',{'mission.tpl-2':'ROLE-002'}),true);
 assert.equal(allowsRole(['mission.tpl-2'],'ROLE-003',{'mission.tpl-2':'ROLE-002'}),false,'a mission covers only its own role');
 assert.equal(allowsRole(['mission.tpl-2'],'ROLE-002'),false,'unresolved keys grant nothing');
});
test('tools owned by a module need it; role tools stay governed by grants',()=>{
 assert.equal(moduleOfTool('ami.collect'),'ami');assert.equal(moduleOfTool('research.collect'),null);
 assert.equal(allowsTool([],'research.collect'),true);
 assert.equal(allowsTool(['module.workforce'],'ami.collect'),false);
 assert.equal(allowsTool(['module.ami'],'ami.collect'),true);
});
test('enforcement is opt-in by ENTITLEMENTS_ENFORCE=1 only',()=>{assert.equal(enforcing({}),false);assert.equal(enforcing({ENTITLEMENTS_ENFORCE:'true'}),false);assert.equal(enforcing({ENTITLEMENTS_ENFORCE:'1'}),true);});
