'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const p=require('./policy.cjs'),plan=require('./development-plan.json');
const metadata={projectId:plan.target.projectId,branchId:plan.target.branchId,branchName:'apk-testing',endpointId:plan.target.endpointId,host:plan.target.directHost,primary:false,default:false};
const sql={endpoint:plan.target.endpointId,database:'neondb',schema:'public',read_only:'on'};
const fake=host=>`postgresql://synthetic:unit-test-only@${host}/neondb?schema=public&sslmode=require&sslaccept=strict`;
test('exact metadata and read-only SQL identity match',()=>assert.equal(p.assertIdentity(metadata,sql),true));
for(const [key,value] of [['projectId','wrong'],['branchId','wrong'],['endpointId','ep-autumn-sunset-b3sbfmer'],['branchName','production'],['primary',true],['default',true]])
  test('refuse metadata '+key,()=>assert.throws(()=>p.assertIdentity({...metadata,[key]:value},sql),/REFUSED/));
for(const [key,value] of [['endpoint','ep-autumn-sunset-b3sbfmer'],['database','postgres'],['schema','private'],['read_only','off']])
  test('refuse SQL '+key,()=>assert.throws(()=>p.assertIdentity(metadata,{...sql,[key]:value}),/REFUSED/));
test('production direct and pooler refused without URL disclosure',()=>{
  for(const h of ['ep-autumn-sunset-b3sbfmer.c-4.ap-southeast-1.aws.neon.tech','ep-autumn-sunset-b3sbfmer-pooler.c-4.ap-southeast-1.aws.neon.tech'])
    assert.throws(()=>p.validatePrivateUrl(fake(h),'direct'),e=>e.code==='PRODUCTION_ENDPOINT_REFUSED'&&!e.message.includes('synthetic'));
});
test('only exact direct/pooled hosts and strict TLS accepted statically',()=>{
  assert.equal(p.validatePrivateUrl(fake(plan.target.directHost),'direct').database,'neondb');
  assert.equal(p.validatePrivateUrl(fake(plan.target.pooledHost),'pooled').kind,'pooled');
  for(const url of [fake('localhost'),fake(plan.target.directHost).replace('/neondb','/postgres'),fake(plan.target.directHost).replace('sslaccept=strict','sslaccept=accept_invalid_certs'),fake(plan.target.directHost)+'&host=other',fake(plan.target.directHost)+'&schema=other'])
    assert.throws(()=>p.validatePrivateUrl(url,'direct'));
});
test('missing private credentials refuse',()=>assert.throws(()=>p.validatePrivateUrl(undefined,'direct'),/PRIVATE_CREDENTIAL_REQUIRED/));
test('LAN must still match; both app overrides disable dotenv/preview',()=>{
  assert.throws(()=>p.frontendEnvironment(['192.168.0.2']),/LAN_IDENTITY_CHANGED/);
  assert.deepEqual(p.frontendEnvironment(['192.168.1.12']),{EXPO_PUBLIC_API_URL:'http://192.168.1.12:4000/api/v1',EXPO_NO_DOTENV:'1',EXPO_PUBLIC_PREVIEW_DATA:'false'});
});
// ---- Runtime-environment regression tests (synthetic credentials only) ----
const appUrl=`postgresql://bs_app_rw:unit-test-only@${plan.target.pooledHost}/neondb?schema=public&sslmode=require&sslaccept=strict`;
const dirUrl=`postgresql://bs_migrator:unit-test-only@${plan.target.directHost}/neondb?schema=public&sslmode=require&sslaccept=strict`;
const secrets={applicationDatabaseUrl:appUrl,directDatabaseUrl:dirUrl,businessJwtSecret:'b'.repeat(48),platformJwtSecret:'p'.repeat(48)};
const base={PATH:'C:/Windows',SystemRoot:'C:/Windows'};
const code=c=>e=>e.code===c&&!String(e.message).includes('unit-test-only');
test('unknown remote hosts refused (other Neon endpoint, other region, IP, loopback, wrong port)',()=>{
  for(const h of ['ep-unknown-host-a1b2c3d4.c-4.ap-southeast-1.aws.neon.tech','ep-late-sunset-b3cwjc8n.us-east-2.aws.neon.tech',
    'ep-late-sunset-b3cwjc8n.c-4.ap-southeast-1.aws.neon.tech.evil.example','db.example.com','10.0.0.5','127.0.0.1','localhost',plan.target.directHost+':6543'])
    assert.throws(()=>p.validatePrivateUrl(fake(h),'direct'),code('APK_CONNECTION_TARGET_REFUSED'),h);
});
test('wrong branch: pooled host used as direct, and direct host as pooled, are refused',()=>{
  assert.throws(()=>p.validatePrivateUrl(fake(plan.target.pooledHost),'direct'),code('APK_CONNECTION_TARGET_REFUSED'));
  assert.throws(()=>p.validatePrivateUrl(fake(plan.target.directHost),'pooled'),code('APK_CONNECTION_TARGET_REFUSED'));
  assert.throws(()=>p.validatePrivateUrl(fake(plan.target.directHost),undefined),code('CONNECTION_KIND_REQUIRED'));
});
test('credentials without user/password or with extra options refused',()=>{
  assert.throws(()=>p.validatePrivateUrl(`postgresql://${plan.target.directHost}/neondb?schema=public&sslmode=require&sslaccept=strict`,'direct'),code('APK_CONNECTION_TARGET_REFUSED'));
  assert.throws(()=>p.validatePrivateUrl(fake(plan.target.directHost)+'&options=-c%20search_path%3Dx','direct'),code('DATABASE_OPTIONS_REFUSED'));
  assert.throws(()=>p.validatePrivateUrl('',`direct`),code('PRIVATE_CREDENTIAL_REQUIRED'));
  assert.throws(()=>p.validatePrivateUrl('not a url','direct'),code('DATABASE_URL_REFUSED'));
});
test('inherited DATABASE_URL / dotenv / PG* / production NODE_ENV are refused without echoing values',()=>{
  for(const k of p.INHERITED_DATABASE_KEYS)
    assert.throws(()=>p.assertCleanInheritedEnvironment({...base,[k]:'postgresql://x:unit-test-only@h/d'}),e=>code('INHERITED_DATABASE_OVERRIDE_REFUSED')(e)&&e.keys.includes(k),k);
  for(const v of ['production','test','staging'])
    assert.throws(()=>p.assertCleanInheritedEnvironment({...base,NODE_ENV:v}),code('NODE_ENV_OVERRIDE_REFUSED'));
  assert.equal(p.assertCleanInheritedEnvironment({...base,NODE_ENV:'development'}),true);
});
test('runtime secrets: missing, shared migration role, weak or identical JWT secrets refused',()=>{
  assert.throws(()=>p.validateRuntimeSecrets(undefined),code('PRIVATE_CREDENTIAL_REQUIRED'));
  assert.throws(()=>p.validateRuntimeSecrets({...secrets,applicationDatabaseUrl:undefined}),code('PRIVATE_CREDENTIAL_REQUIRED'));
  assert.throws(()=>p.validateRuntimeSecrets({...secrets,directDatabaseUrl:undefined}),code('PRIVATE_CREDENTIAL_REQUIRED'));
  assert.throws(()=>p.validateRuntimeSecrets({...secrets,applicationDatabaseUrl:appUrl.replace('bs_app_rw','bs_migrator')}),code('APPLICATION_ROLE_MUST_DIFFER_FROM_MIGRATION_ROLE'));
  assert.throws(()=>p.validateRuntimeSecrets({...secrets,applicationDatabaseUrl:appUrl.replace(plan.target.pooledHost,'ep-autumn-sunset-b3sbfmer-pooler.c-4.ap-southeast-1.aws.neon.tech')}),code('PRODUCTION_ENDPOINT_REFUSED'));
  assert.throws(()=>p.validateRuntimeSecrets({...secrets,businessJwtSecret:'short'}),code('JWT_SECRET_REQUIRED'));
  assert.throws(()=>p.validateRuntimeSecrets({...secrets,platformJwtSecret:secrets.businessJwtSecret}),code('JWT_SECRETS_MUST_DIFFER'));
  assert.equal(p.validateRuntimeSecrets(secrets),true);
});
test('child environment: development, port 4000, loopback, no DIRECT_URL, no dotenv fallback, email disabled',()=>{
  const env=p.buildChildEnvironment({...base,UNRELATED_SECRET:'x'},secrets);
  assert.equal(env.NODE_ENV,'development');assert.equal(env.PORT,'4000');assert.equal(env.HOST,'127.0.0.1');
  assert.equal(env.DATABASE_URL,appUrl);assert.equal(env.DIRECT_URL,undefined);assert.equal(env.UNRELATED_SECRET,undefined);
  assert.equal(env.BRANCHSUITE_FORCE_LOCAL_GUARD,undefined);assert.equal(env.SMTP_HOST,'127.0.0.1');
  assert.equal(env.DOTENV_CONFIG_PATH,p.NO_DOTENV_FILE);
  assert.deepEqual(require('dotenv').parse(require('node:fs').readFileSync(p.NO_DOTENV_FILE)),{});
  assert.throws(()=>p.buildChildEnvironment({...base,DATABASE_URL:dirUrl},secrets),code('INHERITED_DATABASE_OVERRIDE_REFUSED'));
});
test('LAN binding requires the verified address AND recorded approval; 0.0.0.0 never allowed',()=>{
  assert.throws(()=>p.buildChildEnvironment(base,secrets,{bindAddress:'192.168.1.12'}),code('LAN_EXPOSURE_NOT_APPROVED'));
  assert.throws(()=>p.buildChildEnvironment(base,secrets,{bindAddress:'0.0.0.0',lanExposureApproved:true}),code('LAN_EXPOSURE_NOT_APPROVED'));
  assert.equal(p.buildChildEnvironment(base,secrets,{bindAddress:'192.168.1.12',lanExposureApproved:true}).HOST,'192.168.1.12');
});
test('runtime gates: current recorded state is blocked; missing evidence is blocked; 44/44 alone is not enough',()=>{
  assert.equal(p.evaluateRuntimeGates(plan.runtimeGates).ready,false);
  const old=p.evaluateRuntimeGates({...plan.runtimeGates,appliedMigrations:41});
  assert.equal(old.ready,false);assert.ok(old.blockers.some(b=>b.startsWith('SCHEMA_INCOMPATIBLE: 41/44')));
  assert.equal(p.evaluateRuntimeGates(undefined).ready,false);
  const r=p.evaluateRuntimeGates({...plan.runtimeGates,appliedMigrations:44});
  assert.equal(r.ready,false);assert.ok(!r.blockers.some(b=>b.startsWith('SCHEMA_INCOMPATIBLE')));
  const all=Object.fromEntries(Object.keys(plan.runtimeGates).map(k=>[k,true]));
  assert.equal(p.evaluateRuntimeGates({...all,appliedMigrations:44,requiredMigrations:44,unfinishedMigrations:0}).ready,true);
  assert.equal(p.evaluateRuntimeGates({...all,appliedMigrations:43,requiredMigrations:43,unfinishedMigrations:0}).ready,false);
});
test('preflight command never starts the backend and exits non-zero',()=>{
  const cp=require('node:child_process'),path=require('node:path');
  const script=path.join(__dirname,'prepare.cjs');
  let r=cp.spawnSync(process.execPath,[script],{env:base,encoding:'utf8',timeout:30000,windowsHide:true});
  assert.notEqual(r.status,0);assert.match(r.stdout,/"status": "BLOCKED"/);assert.match(r.stderr,/NOT_IMPLEMENTED_OR_AUTHORIZED/);
  r=cp.spawnSync(process.execPath,[script],{env:{...base,DATABASE_URL:dirUrl},encoding:'utf8',timeout:30000,windowsHide:true});
  assert.notEqual(r.status,0);assert.match(r.stdout,/INHERITED_DATABASE_OVERRIDE_REFUSED \(DATABASE_URL\)/);assert.doesNotMatch(r.stdout+r.stderr,/unit-test-only/);
  r=cp.spawnSync(process.execPath,[script,'--start'],{env:base,encoding:'utf8',timeout:30000,windowsHide:true});
  assert.notEqual(r.status,0);assert.equal(r.stdout,'');
});
test('existing local guard still refuses the APK endpoint (no silent unlock)',()=>{
  const guard=require('../safe-env/db-target-guard.cjs');
  assert.throws(()=>guard.assertSafeDatabaseTarget({NODE_ENV:'development',DATABASE_URL:appUrl}),e=>e.code==='REMOTE_ENDPOINT_REFUSED');
  assert.throws(()=>guard.assertSafeDatabaseTarget({NODE_ENV:'development',DATABASE_URL:dirUrl}),e=>e.code==='REMOTE_ENDPOINT_REFUSED');
});
test('backend cannot start even with inherited bypass attempts',()=>{
  const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
  try{assert.equal(plan.backendExecutionEnabled,false);assert.throws(()=>p.refuseBackendStart(),/NOT_IMPLEMENTED_OR_AUTHORIZED/);}finally{if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});
