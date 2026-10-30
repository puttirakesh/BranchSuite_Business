/* Local demo boundaries. Real authentication and tenant enforcement require a server. */
(function(root){
'use strict';const config=root.BranchSuiteConfig;
const isAdmin=()=>config.mode==='admin';
const allowsAccount=a=>!!a&&a.active!==false&&(isAdmin()?a.kind==='platform':a.kind!=='platform'&&!!a.tenantId);
const publicRoutes=()=>isAdmin()?['login']:['login','employee-login','welcome','pricing','signup','contact'];
const home=()=>isAdmin()?'platform-home':'home';
function upgrade(db){
 if(!db.portalVersion){
  for(const tid of ['t2','t3']){const t=db.tenants.find(t=>t.id===tid);if(!t||db.accounts.some(a=>a.tenantId===tid&&a.role==='Employee'))continue;
   const owner=db.accounts.find(a=>a.id===t.ownerAccountId),person=db.employees.find(e=>t.companyIds.includes(e.companyId)&&e.status==='Active'&&e.id!==owner?.employeeId);if(!person)continue;
   const prefix=tid==='t2'?'northstar':'brightpath';db.accounts.push({id:prefix+'-employee',kind:'customer',tenantId:tid,name:person.name,email:prefix+'.employee@demo.example',role:'Employee',employeeId:person.id,active:true,grants:{[person.companyId]:[person.branch]},subtitle:'Employee self-service · '+person.branch});
  }
  db.portalVersion=1;
 }
 const a=db.accounts.find(a=>a.id===db.session?.accountId);if(!allowsAccount(a))db.session=null;
 return db;
}
function selectedTenant(db){return db.tenants.find(t=>t.id===db.settings.demoTenant)||db.tenants[0];}
function accounts(db,tenantId,mode){return db.accounts.filter(a=>allowsAccount(a)&&(isAdmin()||a.tenantId===tenantId)&&(!mode||isAdmin()||(mode==='employee'?a.role==='Employee':a.role!=='Employee')));}
function migration(storage){let raw=storage.getItem(config.dataKey);if(!raw&&!isAdmin())raw=storage.getItem('branchsuite-saas-demo-v2');return raw;}
root.PortalModel={config,isAdmin,allowsAccount,publicRoutes,home,upgrade,selectedTenant,accounts,migration};
})(typeof window!=='undefined'?window:globalThis);
