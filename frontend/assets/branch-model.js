/* One branch and permission model for dashboards, modules and exports. */
(function(root){
  'use strict';
  const ALL='All branches';
  const policies={
    Admin:{label:'Super Admin',short:'Admin',crm:true,people:true,peopleEdit:true,payroll:true,payPrepare:true,payApprove:false,approveRequests:true,reports:true,access:true,bank:true},
    Manager:{label:'Company Manager',short:'Manager',crm:true,people:true,peopleEdit:false,payroll:true,payPrepare:false,payApprove:true,approveRequests:true,reports:true,access:false,bank:true},
    'Branch Manager':{label:'Branch Manager',short:'Branch Mgr',crm:true,people:true,peopleEdit:false,payroll:true,payPrepare:false,payApprove:true,approveRequests:true,reports:true,access:false,bank:true},
    HR:{label:'HR Manager',short:'HR',crm:false,people:true,peopleEdit:true,payroll:false,payPrepare:false,payApprove:false,approveRequests:true,reports:true,access:false,bank:true},
    'Payroll Officer':{label:'Payroll Officer',short:'Payroll',crm:false,people:true,peopleEdit:false,payroll:true,payPrepare:true,payApprove:false,approveRequests:false,reports:true,access:false,bank:true},
    Sales:{label:'Sales Executive',short:'Sales',crm:true,people:false,peopleEdit:false,payroll:false,payPrepare:false,payApprove:false,approveRequests:false,reports:true,access:false,bank:false},
    Employee:{label:'Employee',short:'Employee',crm:false,people:false,peopleEdit:false,payroll:false,payPrepare:false,payApprove:false,approveRequests:false,reports:false,access:false,bank:false}
  };
  const companyRows=(db,key,id)=>db[key].filter(r=>r.companyId===id);
  const employee=(db,id)=>db.employees.find(e=>e.id===id);
  const policy=a=>policies[a?.role]||policies.Employee;
  const can=(a,key)=>a?.active!==false&&!!policy(a)[key];
  const roleNames=()=>Object.keys(policies);
  function companies(db,a){if(!a)return [];if(a.role==='Employee'){const e=employee(db,a.employeeId);return db.companies.filter(c=>c.id===e?.companyId);}return db.companies.filter(c=>a.grants?.['*']||a.grants?.[c.id]?.length);}
  function branches(db,a,id=db.settings.companyId){const c=db.companies.find(c=>c.id===id);if(!c||!a)return [];if(a.role==='Employee'){const e=employee(db,a.employeeId);return e?.companyId===id&&c.branches.includes(e.branch)?[e.branch]:[];}const grant=a.grants?.['*']||a.grants?.[id]||[];return grant.includes('*')?c.branches.slice():c.branches.filter(b=>grant.includes(b));}
  function defaultGrants(a,db){const e=employee(db,a.employeeId);switch(a.role){case 'Admin':return {'*':['*']};case 'Manager':return {[e?.companyId||'c1']:['*']};case 'Branch Manager':return {[e?.companyId||'c1']:[e?.branch||'Guntur']};case 'HR':return {c1:['Guntur','Hyderabad']};case 'Payroll Officer':return {c1:['Vijayawada','Guntur']};default:return {[e?.companyId||'c1']:[e?.branch||'Vijayawada']};}}
  function branchOf(db,key,row){
    if(!row)return null;
    if(row.branch)return row.branch;
    if(row.employeeId)return employee(db,row.employeeId)?.branch||null;
    if(key==='customers')return row.city||null;
    if(key==='quotes'){const d=db.deals.find(d=>d.id===row.dealId);return d?.branch||db.customers.find(c=>c.companyId===row.companyId&&c.name===row.customer)?.branch||null;}
    if(key==='tickets')return db.customers.find(c=>c.companyId===row.companyId&&c.name===row.customer)?.branch||null;
    if(key==='tasks')return db.leads.find(l=>l.id===row.relatedId)?.branch||companyRows(db,'employees',row.companyId).find(e=>e.name===row.owner)?.branch||null;
    return null;
  }
  function enrich(db){
    const firstBranch=id=>db.companies.find(c=>c.id===id)?.branches[0];
    ['attendance','requests','issues','payments','incentives','advances','customers','tasks','quotes','tickets'].forEach(key=>db[key].forEach(row=>{if(!row.branch)row.branch=branchOf(db,key,row)||firstBranch(row.companyId);}));
    db.documents.forEach(d=>{const e=employee(db,d.employeeId);d.companyId=e?.companyId;d.branch=e?.branch;});
  }
  function createRun(companyId,branch){return {id:'OCT26-'+companyId+'-'+branch.toUpperCase().replace(/[^A-Z0-9]+/g,'-'),companyId,branch,period:'October 2026',status:'Draft',revision:1,submittedRevision:null,preparedBy:null,approvedBy:null,published:false,scheduledDate:'2026-10-31'};}
  function upgrade(db){
    if(!db)return db;
    const extras=[
      {id:'branch-manager',name:'Kabir Shah',role:'Branch Manager',email:'branch@demo.example',employeeId:'EMP0070',subtitle:'Guntur · team, CRM & approvals'},
      {id:'hr',name:'Meera Reddy',role:'HR',email:'hr@demo.example',employeeId:'EMP0067',subtitle:'Guntur & Hyderabad · people and leave'},
      {id:'payroll',name:employee(db,'EMP0003')?.name||'Payroll Officer',role:'Payroll Officer',email:'payroll@demo.example',employeeId:'EMP0003',subtitle:'Vijayawada & Guntur · prepare payroll'}
    ];
    extras.forEach(a=>{if(!db.accounts.some(x=>x.id===a.id))db.accounts.push(a);});
    db.accounts.forEach(a=>{if(!a.grants)a.grants=defaultGrants(a,db);if(a.active===undefined)a.active=true;});
    db.settings.contexts=db.settings.contexts||{};db.settings.pinnedBranches=db.settings.pinnedBranches||[];
    if(!db.branches)db.branches=[];
    db.companies.forEach(c=>c.branches.forEach((b,i)=>{if(!db.branches.some(x=>x.companyId===c.id&&x.name===b))db.branches.push({id:c.id+'-BR-'+(i+1),companyId:c.id,name:b,code:b.slice(0,3).toUpperCase(),location:b,manager:c.id==='c1'?({Vijayawada:'Kavitha Reddy',Guntur:'Kabir Shah',Hyderabad:'Shreya Menon'}[b]):companyRows(db,'employees',c.id).find(e=>e.branch===b)?.name||'Unassigned',status:'Active'});}));
    enrich(db);
    if(!db.branchScoped){
      const old=db.runs;
      db.runs=[];
      db.companies.forEach(c=>c.branches.forEach(b=>{const previous=old.find(r=>r.companyId===c.id),run=createRun(c.id,b);if(previous){['status','revision','submittedRevision','preparedBy','preparerAccount','approvedBy','approvedRevision','published','reviewNote','scheduledDate'].forEach(k=>{if(previous[k]!==undefined)run[k]=previous[k];});if(previous.snapshot)run.snapshot=previous.snapshot.filter(e=>e.branch===b);}
        db.runs.push(run);
      }));
      db.branchScoped=true;
    }
    db.schema=2;db.scopeVersion=1;return db;
  }
  function normalise(db,a,preferred){
    if(!a||a.active===false)return false;
    const cs=companies(db,a);if(!cs.length)return false;
    const context=preferred||db.settings.contexts[a.id]||db.settings;
    const c=cs.find(c=>c.id===context.companyId)||cs[0],bs=branches(db,a,c.id);
    if(!bs.length)return false;
    const b=bs.includes(context.branch)?context.branch:context.branch===ALL&&bs.length>1?ALL:bs.length>1?ALL:bs[0];
    db.settings.companyId=c.id;db.settings.branch=b;db.settings.personal=false;remember(db,a);return true;
  }
  function remember(db,a){if(a&&!db.settings.personal)db.settings.contexts[a.id]={companyId:db.settings.companyId,branch:db.settings.branch};}
  function setContext(db,a,companyId,branch){const bs=branches(db,a,companyId);if(a?.active===false||!bs.length||!(bs.includes(branch)||(branch===ALL&&bs.length>1)))throw new Error('Branch access denied');db.settings.companyId=companyId;db.settings.branch=branch;db.settings.personal=false;remember(db,a);}
  function title(db,a){if(db.settings.branch!==ALL)return db.settings.branch;return branches(db,a).length===db.companies.find(c=>c.id===db.settings.companyId)?.branches.length?'All branches':'Assigned branches';}
  function records(db,a,key,options={}){
    if(!a||a.active===false||(a.role==='Employee'&&['leads','deals','customers','tasks','quotes','tickets','audit'].includes(key)))return [];
    const id=options.companyId||db.settings.companyId,selected=options.branch||db.settings.branch,bs=branches(db,a,id);
    if(!bs.length)return [];
    let rows=(db[key]||[]).filter(r=>r.companyId===id);
    return rows.filter(r=>{
      const b=branchOf(db,key,r);
      if(b===null)return selected===ALL&&bs.length===db.companies.find(c=>c.id===id)?.branches.length;
      if(!bs.includes(b)||(selected!==ALL&&selected!==b))return false;
      if(a.role==='Employee'&&r.employeeId)return r.employeeId===a.employeeId;
      if(a.role==='Employee'&&key==='employees')return r.id===a.employeeId;
      return true;
    });
  }
  function accessible(db,a,key,id){return records(db,a,key).some(r=>r.id===id);}
  function branchRun(db,companyId,branch){return db.runs.find(r=>r.companyId===companyId&&r.branch===branch);}
  function currentRun(db,a){
    if(db.settings.branch!==ALL)return branchRun(db,db.settings.companyId,db.settings.branch);
    const rs=records(db,a,'runs'),statuses=new Set(rs.map(r=>r.status));
    return {id:'OCT26-'+db.settings.companyId+'-OVERVIEW',companyId:db.settings.companyId,branch:ALL,period:'October 2026',status:statuses.size===1?rs[0]?.status||'Draft':'In progress',revision:Math.max(1,...rs.map(r=>r.revision)),published:rs.length>0&&rs.every(r=>r.published),scheduledDate:'2026-10-31',aggregate:true,runs:rs};
  }
  function payrollRows(db,a,options={}){
    const id=options.companyId||db.settings.companyId,b=options.branch||db.settings.branch;
    const bs=branches(db,a,id).filter(x=>b===ALL||x===b);
    return bs.flatMap(branch=>{const r=branchRun(db,id,branch);return r?.snapshot&&['Submitted','Approved','Published'].includes(r.status)?r.snapshot.filter(e=>e.branch===branch):companyRows(db,'employees',id).filter(e=>e.branch===branch&&e.status==='Active');}).filter(e=>a.role!=='Employee'||e.id===a.employeeId);
  }
  function summary(db,a,options={}){
    const id=options.companyId||db.settings.companyId,b=options.branch||db.settings.branch;
    const opts={companyId:id,branch:b};
    const employees=records(db,a,'employees',opts).filter(e=>e.status==='Active'),attendance=records(db,a,'attendance',opts).filter(r=>r.date==='2026-10-03'),deals=records(db,a,'deals',opts).filter(d=>!['Won','Lost'].includes(d.stage)),pay=payrollRows(db,a,opts),req=records(db,a,'requests',opts).filter(r=>r.status==='Pending');
    const sum=(rows,k)=>rows.reduce((n,r)=>n+(Number(r[k])||0),0);
    return {employees:employees.length,present:attendance.filter(r=>r.status==='Present').length,onLeave:attendance.filter(r=>r.status==='On leave').length,attendanceReview:attendance.filter(r=>r.status==='Needs review').length,notChecked:Math.max(0,employees.length-attendance.filter(r=>['Present','On leave','Needs review'].includes(r.status)).length),leads:records(db,a,'leads',opts).filter(l=>l.stage!=='Closed').length,pipeline:sum(deals,'value'),deals:deals.length,requests:req.length,leaveRequests:req.filter(r=>r.type==='Leave').length,corrections:req.filter(r=>r.type==='Attendance').length,issues:records(db,a,'issues',opts).filter(i=>i.status==='Open').length,gross:sum(pay,'gross'),deductions:sum(pay,'deductions'),net:sum(pay,'gross')-sum(pay,'deductions'),incentives:sum(pay,'incentive'),tasks:records(db,a,'tasks',opts).filter(t=>t.status==='Open').length,tickets:records(db,a,'tickets',opts).filter(t=>t.status!=='Resolved').length,payEmployees:pay.length};
  }
  function addBranch(db,a,input){if(!can(a,'access'))throw new Error('Admin access required');const c=db.companies.find(c=>c.id===db.settings.companyId),name=input.name.trim();if(!name||c.branches.some(b=>b.toLowerCase()===name.toLowerCase()))throw new Error('Choose a unique branch name');const branch={id:c.id+'-BR-'+Date.now(),companyId:c.id,name,code:input.code.trim().toUpperCase(),location:input.location.trim(),manager:input.manager.trim(),status:'Active'};c.branches.push(name);db.branches.push(branch);db.runs.push(createRun(c.id,name));return branch;}
  function updateGrants(db,actor,id,input){if(!can(actor,'access'))throw new Error('Admin access required');const a=db.accounts.find(a=>a.id===id);if(!a)throw new Error('Account unavailable');if(a.id==='admin')throw new Error('The primary Super Admin stays enabled with full access');if(!policies[input.role])throw new Error('Choose a valid role');let grants=input.grants||{};if(input.role==='Employee'){const e=employee(db,a.employeeId);grants={[e.companyId]:[e.branch]};}else if(input.role==='Admin')grants={'*':['*']};else{const entries=Object.entries(grants).filter(([cid,bs])=>{const c=db.companies.find(c=>c.id===cid);return c&&bs.length&&bs.every(b=>b==='*'||c.branches.includes(b));});grants=Object.fromEntries(entries);if(!Object.keys(grants).length)throw new Error('Assign at least one company and branch');}a.role=input.role;a.grants=grants;a.active=input.active!==false;return a;}
  root.BranchModel={ALL,policies,policy,can,roleNames,companies,branches,branchOf,upgrade,enrich,normalise,remember,setContext,title,records,accessible,branchRun,currentRun,payrollRows,summary,addBranch,updateGrants};
})(typeof window!=='undefined'?window:globalThis);
