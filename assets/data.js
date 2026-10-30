/* All data below is fictional, generated for the offline prototype. */
(function (root) {
  'use strict';
  const DEMO_DATE = '2026-10-03';
  const companySeeds = [
    {id:'c1',name:'5 Gen Educon',legal:'5 Gen Educon Private Limited',short:'5 Gen',branches:['Vijayawada','Guntur','Hyderabad'],headcount:128,gross:5892600,deductions:420000,leads:84},
    {id:'c2',name:'Northstar Services',legal:'Northstar Services Private Limited',short:'Northstar',branches:['Bengaluru','Chennai'],headcount:74,gross:3190000,deductions:222000,leads:42},
    {id:'c3',name:'BrightPath Labs',legal:'BrightPath Labs Private Limited',short:'BrightPath',branches:['Pune','Mumbai'],headcount:58,gross:2373400,deductions:158000,leads:36}
  ];
  const accounts = [
    {id:'admin',name:'Neha Iyer',role:'Admin',email:'admin@demo.example',subtitle:'Prepare payroll · manage people',employeeId:'EMP0001'},
    {id:'manager',name:'Kavitha Reddy',role:'Manager',email:'manager@demo.example',subtitle:'Review payroll · approve requests',employeeId:'EMP0002'},
    {id:'sales',name:'Ravi Teja',role:'Sales',email:'sales@demo.example',subtitle:'Manage leads · win deals',employeeId:'EMP0041'},
    {id:'employee',name:'Ananya Rao',role:'Employee',email:'employee@demo.example',subtitle:'Attendance · leave · payslips',employeeId:'EMP0082'}
  ];
  function seed() {
    const employees=[], attendance=[], leads=[], customers=[], deals=[], tasks=[], requests=[], issues=[], runs=[], tickets=[], quotes=[], payments=[];
    const first=['Aarav','Aditi','Ishaan','Diya','Arjun','Meera','Kabir','Nisha','Rohan','Priya','Vikram','Shreya','Dev','Riya','Kiran','Tara'];
    const last=['Rao','Sharma','Reddy','Shah','Menon','Patel','Iyer','Kumar','Nair','Verma','Joshi','Das','Singh','Kapoor','Gupta','Sethi'];
    const key={1:['Neha Iyer','HR',48000,2700],2:['Kavitha Reddy','Operations',58000,3800],41:['Ravi Teja','Sales',52000,3200],67:['Meera Reddy','HR',48000,2700],70:['Kabir Shah','Sales',50000,3500],82:['Ananya Rao','Operations',45000,2800],94:['Shreya Menon','Sales',58000,3800],103:['Arjun Kumar','Support',41000,2500]};
    companySeeds.forEach((company,ci)=>{
      const start=employees.length;
      for(let n=1;n<=company.headcount;n++){
        const special=ci===0?key[n]:null;
        const id=ci===0?'EMP'+String(n).padStart(4,'0'):company.id.toUpperCase()+'-EMP'+String(n).padStart(3,'0');
        let branch=company.branches[(n-1)%company.branches.length];
        if(ci===0) branch=n<=75?'Vijayawada':n<=106?'Guntur':'Hyderabad';
        if(ci===0 && n===67)branch='Guntur';
        if(ci===0 && n===70)branch='Guntur';
        if(ci===0 && n===82)branch='Vijayawada';
        if(ci===0 && n===94)branch='Hyderabad';
        const name=special?special[0]:first[(n+ci)%first.length]+' '+last[Math.floor((n-1)/first.length)%last.length];
        employees.push({id,companyId:company.id,name,department:special?special[1]:['Operations','Sales','Support','HR'][n%4],branch,manager:'Kavitha Reddy',email:name.toLowerCase().replace(/ /g,'.')+'.'+n+'@demo.example',phone:'+91 90000 '+String(10000+n+ci*1000),joinDate:'2025-06-02',status:'Active',gross:special?special[2]:0,deductions:special?special[3]:0,bankLast4:String(2000+n-34),bankStatus:'Verified',cl:6,sl:4,incentive:ci===0?({41:8000,70:6500,94:4000}[n]||0):0});
      }
      const rows=employees.slice(start);
      const normal=rows.filter(e=>e.gross===0);
      const remainingGross=company.gross-rows.reduce((s,e)=>s+e.gross,0), remainingDed=company.deductions-rows.reduce((s,e)=>s+e.deductions,0);
      normal.forEach((e,i)=>{
        e.gross=Math.floor(remainingGross/normal.length)+(i<remainingGross%normal.length?1:0);
        e.deductions=Math.floor(remainingDed/normal.length)+(i<remainingDed%normal.length?1:0);
      });
      rows.forEach((e,i)=>{
        e.basic=e.id==='EMP0082'?24000:Math.floor((e.gross-e.incentive)*.54);
        e.hra=e.id==='EMP0082'?12000:Math.floor((e.gross-e.incentive)*.27);
        e.allowance=e.gross-e.basic-e.hra-e.incentive;
        e.retirement=Math.min(1800,e.deductions);e.tax=e.deductions-e.retirement;
        let status=i<company.headcount-8?'Present':i<company.headcount-2?'On leave':'Needs review';
        if(e.id==='EMP0082')status='Not checked in';
        attendance.push({id:'AT-'+e.id,companyId:company.id,employeeId:e.id,date:DEMO_DATE,status,inTime:status==='Present'?'09:04':'',outTime:'',note:''});
        payments.push({id:'PAY-'+e.id,companyId:company.id,employeeId:e.id,amount:e.gross-e.deductions,status:'Not initiated',reference:''});
      });
      runs.push({id:'OCT26-'+company.id,companyId:company.id,period:'October 2026',status:'Draft',revision:1,submittedRevision:null,preparedBy:null,approvedBy:null,published:false,scheduledDate:'2026-10-31'});
      const org=['Sunrise Academy','Riverdale School','Lotus Academy','Oakridge Centre','Greenfield School','Harmony School','Cedar Academy','Maple School','Hillside Institute','Bluebell School','Valley Academy','Springfield School'];
      for(let n=0;n<company.leads;n++){
        const name=n<org.length?org[n]:(['Aspire','Horizon','Scholars','Discovery','Silver Oak','Pioneer','Evergreen','Summit'][n%8]+' '+['Academy','School','Learning Centre'][Math.floor(n/8)%3]+' '+(Math.floor(n/24)+1));
        const leadId='LD-'+company.id+'-'+String(n+1).padStart(3,'0');
        const contact=n===0?'Raghav Sharma':first[n%first.length]+' '+last[n%last.length];
        const owner=['Ravi Teja','Shreya Menon','Kabir Shah'][n%3];
        const customerId='CU-'+company.id+'-'+String(n+1).padStart(3,'0');
        leads.push({id:leadId,companyId:company.id,organization:name,contact,email:'contact'+(n+1)+'@'+company.id+'.example',phone:'+91 90001 '+String(11000+n),source:['Website','Referral','Campaign'][n%3],stage:n<12?'Qualified':'New',owner,branch:company.branches[n%company.branches.length],value:n===0?300000:60000+(n%6)*60000,notes:n===0?'500 programme seats. Demo complete. Quote requested.':'Sample enquiry for the education programme.',followup:'2026-10-03',created:'2026-09-28',customerId});
        if(n<16)customers.push({id:customerId,companyId:company.id,name,contact,email:'contact'+(n+1)+'@'+company.id+'.example',phone:'+91 90001 '+String(11000+n),city:company.branches[n%company.branches.length],status:n<4?'Active':'Prospect',owner,notes:'Demo customer record. All contact information is fictional.'});
      }
      const ds=[['Riverdale School',180000,'New','Shreya Menon'],['Cedar Academy',120000,'New','Kabir Shah'],['Elm Centre',60000,'New','Ravi Teja'],['Lotus Academy',240000,'Qualified','Kabir Shah'],['Maple School',120000,'Qualified','Ravi Teja'],['Hillside Institute',180000,'Qualified','Shreya Menon'],['Sunrise Academy',300000,'Proposal','Ravi Teja'],['Oakridge Centre',150000,'Proposal','Shreya Menon'],['Bluebell School',210000,'Proposal','Kabir Shah'],['Harmony School',420000,'Negotiation','Kabir Shah'],['Valley Academy',240000,'Negotiation','Ravi Teja'],['Springfield School',240000,'Negotiation','Shreya Menon']];
      const scale=ci===0?1:ci===1?1620000/2460000:960000/2460000;
      ds.forEach((d,i)=>deals.push({id:'OP-'+company.id+'-'+String(i+1).padStart(3,'0'),companyId:company.id,name:d[0],value:Math.round(d[1]*scale),stage:d[2],owner:d[3],closeDate:'2026-10-16',probability:[15,35,60,85][Math.floor(i/3)],notes:'Sample sales opportunity.',leadId:leads.find(l=>l.companyId===company.id&&l.organization===d[0])?.id||'',branch:company.branches[i%company.branches.length]}));
      tasks.push({id:'TASK-'+company.id+'-1',companyId:company.id,title:'Follow up with Sunrise Academy',type:'Call',date:DEMO_DATE,time:'11:00',owner:'Ravi Teja',status:'Open',relatedId:'LD-'+company.id+'-001',note:'Confirm programme start date.'},{id:'TASK-'+company.id+'-2',companyId:company.id,title:'Riverdale programme demo',type:'Meeting',date:DEMO_DATE,time:'12:30',owner:'Shreya Menon',status:'Open',relatedId:'LD-'+company.id+'-002',note:'Show the 500-seat programme.'},{id:'TASK-'+company.id+'-3',companyId:company.id,title:'Weekly pipeline review',type:'Task',date:DEMO_DATE,time:'16:00',owner:'Kavitha Reddy',status:'Open',relatedId:'',note:'Review opportunities and next steps.'});
      tickets.push({id:'TK-'+company.id+'-108',companyId:company.id,subject:'Programme access help',customer:'Sunrise Academy',owner:'Arjun Kumar',priority:'Normal',status:'Open',messages:[{by:'Raghav Sharma',text:'Please help our coordinator access the programme.',time:'02 Oct, 10:20'}]},{id:'TK-'+company.id+'-107',companyId:company.id,subject:'Quote clarification',customer:'Lotus Academy',owner:'Meera Reddy',priority:'Normal',status:'In progress',messages:[{by:'Akash Verma',text:'Can you confirm the seat count?',time:'02 Oct, 09:30'}]},{id:'TK-'+company.id+'-105',companyId:company.id,subject:'Invoice copy',customer:'Harmony School',owner:'Arjun Kumar',priority:'Low',status:'Resolved',messages:[{by:'Arjun Kumar',text:'Copy added to the customer record.',time:'01 Oct, 15:10'}]});
      quotes.push({id:'Q-'+company.id+'-102',companyId:company.id,customer:'Sunrise Academy',dealId:'OP-'+company.id+'-007',validUntil:'2026-10-16',status:'Draft',lines:[{description:'Education programme seat',quantity:500,rate:600}],discount:0,taxRate:0,note:'Programme delivery for the upcoming academic term.'});
    });
    // Attendance and bank issues block payroll until resolved.
    ['EMP0103','EMP0094','EMP0019','EMP0032','EMP0055'].forEach((employeeId,i)=>issues.push({id:'ISS-ATT-'+i,companyId:'c1',employeeId,type:'Attendance',date:i===1?'2026-10-01':'2026-10-02',description:i===1?'Missing checkout on 01 Oct':'Attendance confirmation required for 02 Oct',status:'Open'}));
    ['EMP0017','EMP0027','EMP0037'].forEach((employeeId,i)=>{employees.find(e=>e.id===employeeId).bankStatus='Needs verification';issues.push({id:'ISS-BANK-'+i,companyId:'c1',employeeId,type:'Bank details',description:'Bank details require verification',status:'Open'});});
    const reqEmp=['EMP0082','EMP0067','EMP0041','EMP0010','EMP0011','EMP0012','EMP0013','EMP0014'];
    reqEmp.forEach((employeeId,i)=>requests.push({id:'REQ-L-'+(i+1),companyId:'c1',employeeId,type:'Leave',leaveType:i%3===2?'Sick leave':'Casual leave',from:i===0?'2026-10-12':'2026-10-19',to:i===0?'2026-10-13':'2026-10-19',days:i===0?2:1,reason:i===0?'Family event':'Personal appointment',status:'Pending',created:'2026-10-02',reviewNote:''}));
    ['EMP0082','EMP0103','EMP0094','EMP0032'].forEach((employeeId,i)=>requests.push({id:'REQ-A-'+(i+1),companyId:'c1',employeeId,type:'Attendance',date:i===0?'2026-09-29':'2026-10-02',inTime:'09:00',outTime:'18:00',reason:'Missed checkout. Worked the full scheduled shift.',status:'Pending',created:'2026-10-02',reviewNote:''}));
    return {schema:1,payHistory:{September_2026:JSON.parse(JSON.stringify(employees))},companies:JSON.parse(JSON.stringify(companySeeds)),accounts:JSON.parse(JSON.stringify(accounts)),employees,attendance,leads,customers,deals,tasks,requests,issues,runs,tickets,quotes,payments,incentives:[{id:'INC-1',companyId:'c1',employeeId:'EMP0041',amount:8000,dealId:'WON-0018',status:'Approved'},{id:'INC-2',companyId:'c1',employeeId:'EMP0070',amount:6500,dealId:'WON-0017',status:'Approved'},{id:'INC-3',companyId:'c1',employeeId:'EMP0094',amount:4000,dealId:'WON-0015',status:'Approved'}],advances:[],documents:[{id:'DOC-1',employeeId:'EMP0082',name:'Employment confirmation',date:'2025-06-02',type:'Letter',status:'Available'},{id:'DOC-2',employeeId:'EMP0082',name:'Bank verification',date:'2026-09-15',type:'Verification',status:'Verified'}],audit:[{id:'AUD-1',companyId:'c1',actor:'Neha Iyer',action:'Demo workspace created',detail:'260 sample employees across 3 companies',time:'2026-10-03T09:00:00'}],notifications:[{id:'N-1',companyId:'c1',title:'8 payroll checks need attention',body:'Resolve attendance and bank issues before submitting.',route:'payroll',read:false},{id:'N-2',companyId:'c1',title:'12 requests waiting for review',body:'Leave and attendance requests are ready.',route:'approvals',read:false},{id:'N-3',companyId:'c1',title:'Sunrise Academy follow-up',body:'Confirm the programme start date.',route:'lead/LD-c1-001',read:false}],session:null,settings:{companyId:'c1',branch:'All branches',notificationEnabled:true,compact:false}};
  }
  root.DemoData={seed,accounts,DEMO_DATE,companySeeds};
})(typeof window!=='undefined'?window:globalThis);
