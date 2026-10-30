/* v2.3: focused dashboards, action-led cards and consistent mobile interactions. */
(function (root) {
  'use strict';
  const E = root.EmployeeModel, B = root.BranchModel, S = root.SaaSModel, P = root.PortalModel;
  let H, wizard = null, query = '', filter = 'All', page = 0, listContext = '', searchTimer, draftTimer, pendingLogin = null;
  const D = () => H.getDB(), A = () => H.account(), C = () => D().companies.find(c => c.id === D().settings.companyId);
  const employee = () => A()?.role === 'Employee', self = () => E.person(D(), A());
  const use = h => { H = h; };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const numberFormat = new Intl.NumberFormat('en-IN', {maximumFractionDigits:0});
  const money = v => '₹' + numberFormat.format(Number(v) || 0);
  const short = v => v >= 100000 ? '₹' + (v / 100000).toFixed(2) + ' L' : money(v);
  const date = v => v ? new Date(v+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'}) : '—';
  const initials = name => String(name || '').split(' ').slice(0,2).map(n=>n[0]).join('');
  const icon = name => H.icon(name);
  const btn = (label, action, id='', cls='') => '<button type="button" class="btn '+cls+'" data-act="'+action+'" data-id="'+esc(id)+'">'+esc(label)+'</button>';
  const nav = (label, target, cls='') => '<button type="button" class="btn '+cls+'" data-act="nav" data-target="'+esc(target)+'">'+esc(label)+'</button>';
  const avatar = (name, tone='') => '<span class="flow-avatar '+tone+'">'+esc(initials(name))+'</span>';
  const tag = status => '<span class="pill '+(/Active|Paid|Present|Completed|Enabled|Published/.test(status)?'green':/Inactive|Suspended|Expired|Past due/.test(status)?'red':/Open|Trial|Pending|Review/.test(status)?'amber':'purple')+'">'+esc(status)+'</span>';
  const note = (text, tone='') => '<div class="note '+tone+'">'+icon('info')+'<p>'+esc(text)+'</p></div>';
  const title = (name, subtitle='', actions='', back=false) => '<div class="page-head flow-page-head"><div>'+(back?'<button class="flow-back" data-act="back">'+icon('back')+'Back</button>':'')+'<h1>'+esc(name)+'</h1><p class="subtitle">'+esc(subtitle)+'</p></div>'+actions+'</div>';
  const section = (name, target='', label='View all') => '<div class="section-title"><h2>'+esc(name)+'</h2>'+(target?nav(label,target,'text-button'):'')+'</div>';
  const empty = (name,text) => '<div class="flow-empty"><span class="flow-empty-icon">'+icon('check')+'</span><h3>'+esc(name)+'</h3><p>'+esc(text)+'</p></div>';
  const metric = (label, value, hint, target, symbol, tone='blue', key='') => `<button type="button" class="stat flow-stat ${tone}" data-act="nav" data-target="${target}" ${key?'data-metric="'+key+'"':''}><span class="studio-stat-top"><span class="flow-stat-icon">${icon(symbol)}</span><span class="studio-stat-arrow">${icon('chevron')}</span></span><span class="stat-label">${esc(label)}</span><strong class="value">${esc(value)}</strong><span class="hint">${esc(hint)}</span></button>`;
  const tile = (label, desc, target, symbol, tone='blue') => `<button type="button" class="flow-tile ${tone}" data-act="nav" data-target="${target}"><span class="flow-tile-icon">${icon(symbol)}</span><span><strong>${esc(label)}</strong><small>${esc(desc)}</small></span>${icon('chevron')}</button>`;
  const moduleCard = (label, desc, target, symbol, tone='blue', count='') => `<button type="button" class="studio-module ${tone}" data-act="nav" data-target="${target}"><span class="studio-module-top"><span class="flow-tile-icon">${icon(symbol)}</span>${count!==''?'<span class="studio-module-count">'+esc(count)+'</span>':''}</span><strong>${esc(label)}</strong><small>${esc(desc)}</small><span class="studio-module-bottom">Open workspace ${icon('chevron')}</span></button>`;
  const quickAction = (label,target,symbol,tone='blue',action='nav') => `<button type="button" class="studio-quick ${tone}" data-act="${action}" data-target="${target}"><span class="flow-tile-icon">${icon(symbol)}</span><strong>${esc(label)}</strong></button>`;
  const homeHeading = (label,heading,sub) => `<div class="studio-home-heading"><div><span class="eyebrow">${esc(label)}</span><h1>${esc(heading)}</h1><p>${esc(sub)}</p></div><span class="studio-date">${icon('attendance')}<span>03 OCT<small>Sample day</small></span></span></div>`;
  const detail = pairs => '<dl class="flow-details">'+pairs.map(([k,v])=>'<div><dt>'+esc(k)+'</dt><dd>'+esc(v || '—')+'</dd></div>').join('')+'</dl>';
  const checkbox = (label, name, checked, description='') => '<label class="flow-checkbox"><input type="checkbox" name="'+name+'" '+(checked?'checked':'')+'><span><strong>'+esc(label)+'</strong>'+(description?'<small>'+esc(description)+'</small>':'')+'</span></label>';

  function loginScreen() {
    const admin = P.isAdmin(), mode = D().settings.portalLoginMode || 'staff', isEmp = !admin && mode === 'employee';
    const tenant = P.selectedTenant(D()), rows = P.accounts(D(), tenant?.id, mode).filter(a=>E.enabled(D(),a));
    const first = admin ? rows.find(a=>a.id==='platform-admin') : rows.find(a=>a.id===tenant?.ownerAccountId) || rows[0];
    const email = isEmp && D().settings.employeeLoginEmail ? D().settings.employeeLoginEmail : first?.email || '';
    const custom = D().accounts.find(a=>a.email===email)?.seedDemo === false;
    const heading = admin?'Admin sign in':isEmp?'Employee sign in':'Business sign in';
    const color = admin?'lavender':isEmp?'mint':'blue';
    const quick = rows.filter(a=>a.seedDemo).map(a=>'<button class="portal-account" data-act="login" data-id="'+esc(a.id)+'">'+avatar(a.name)+'<span class="stack"><strong>'+esc(admin?a.role:isEmp?a.name:B.policy(a).label)+'</strong><small>'+esc(a.email)+'</small></span>'+icon('chevron')+'</button>').join('');
    return '<div class="flow-auth '+color+'"><section class="flow-auth-story"><div class="eyebrow">'+(admin?'THE ADMIN WORKSPACE':isEmp?'YOUR PERSONAL WORKSPACE':'BUSINESS · PEOPLE · PAYROLL')+'</div><h2>'+(admin?'A clear view.<br>A better-run platform.':isEmp?'Your workday,<br>in one place.':'Less searching.<br>More getting done.')+'</h2><p>'+(admin?'Manage customers, subscriptions and support with a clear next action.':isEmp?'Record attendance, follow your tasks and view your payslips.':'Customers, employees and branch payroll, organised around your day.')+'</p><div class="flow-auth-visual"><div class="flow-mini-top"><span class="flow-dot"></span>'+ (admin?'Platform workspace':isEmp?'My work':'Branch workspace')+'<span>LIVE DEMO</span></div><div class="flow-mini-grid">'+(admin?'<div>'+icon('building')+'<strong>Customers</strong><small>Plans & renewals</small></div><div>'+icon('support')+'<strong>Support</strong><small>Every request</small></div>':isEmp?'<div>'+icon('attendance')+'<strong>Attendance</strong><small>Check in & out</small></div><div>'+icon('tasks')+'<strong>My tasks</strong><small>Today’s priorities</small></div>':'<div>'+icon('team')+'<strong>Your people</strong><small>One connected flow</small></div><div>'+icon('wallet')+'<strong>Branch payroll</strong><small>Prepare to publish</small></div>')+'</div><div class="flow-mini-strip">'+icon('check')+' '+(isEmp?'Your own records, clearly organised':'The right workspace for every role')+'</div></div><div class="flow-auth-pills"><span>Light & clear</span><span>Phone & desktop</span><span>Offline sample data</span></div></section><section class="flow-auth-card">'+title(heading,admin?'Your platform administration starts here.':isEmp?'Use the employee login created by your manager.':'Sign in to manage your business.')+(!admin?'<div class="portal-segments" role="group" aria-label="Login type"><button class="'+(!isEmp?'selected':'')+'" data-act="portal-login-mode" data-id="staff">Business</button><button class="'+(isEmp?'selected':'')+'" data-act="portal-login-mode" data-id="employee">Employee</button></div><label class="field"><span>Business</span><select data-portal-tenant="true" aria-label="Demo business">'+D().tenants.map(t=>'<option value="'+esc(t.id)+'" '+(t.id===tenant?.id?'selected':'')+'>'+esc(t.name)+'</option>').join('')+'</select></label>':'')+'<form id="login-form">'+H.field(admin?'Admin email':isEmp?'Employee email':'Work email','email',email,'email',true,'','autocomplete="username"')+'<label class="field"><span>Password *</span><div class="password-wrap"><input id="login-password" name="password" type="password" value="'+(custom?'':'Demo123')+'" required autocomplete="current-password"><button class="password-toggle" type="button" data-act="password" aria-label="Show or hide password">'+icon('eye')+'</button></div></label><div class="form-error" role="alert"></div><button type="submit" class="btn full">Sign in '+icon('chevron')+'</button></form><p class="flow-signin-help">'+(isEmp?'New employee? Ask your manager for your work email and demo password.':'Sample accounts use <strong>Demo123</strong>.')+'</p>'+(quick?'<details class="flow-demo-accounts"><summary>Try sample accounts '+icon('down')+'</summary><div>'+quick+'</div></details>':'')+(!admin&&!isEmp?'<div class="flow-auth-bottom">New business? '+nav('Explore plans','pricing','text-button')+'</div>':'')+'<p class="flow-auth-foot">'+icon('lock')+' '+(admin?'Dedicated Admin app':isEmp?'Separate employee access':'Business and management access')+'</p></section></div>';
  }

  function businessHome() {
    if (employee()) return employeeHome();
    const m=B.summary(D(),A()), branch=B.title(D(),A()), all=D().settings.branch===B.ALL;
    const can=k=>B.can(A(),k)&&S.allowPermission(D(),A(),k), sales=A().role==='Sales';
    const writable=S.writable(D(),A());
    const openTasks=E.tasks(D(),A()).filter(t=>t.status!=='Completed').length;
    let html=homeHeading(all?'Business overview':branch+' dashboard','Hello, '+A().name.split(' ')[0]+'.','Your people, customers and priorities.');
    html+='<div class="studio-quickbar" aria-label="Quick actions">'+(can('peopleEdit')&&writable?quickAction('Add employee','employee-new','team','blue'):can('people')?quickAction('Employees','team','team','blue'):'')+(can('crm')?(writable?quickAction('Add lead','lead-new','leads','mint')+quickAction('Assign task','task-new','tasks','lavender'):quickAction('Leads','leads','leads','mint')+quickAction('Tasks','tasks','tasks','lavender')):'')+quickAction('Attendance','attendance','attendance','amber')+'</div>';
    html+='<div class="studio-section-label"><h2>At a glance</h2><span>'+esc(all?'All assigned branches':branch)+'</span></div><div class="stats flow-stats">';
    if(sales) html+=metric('Open leads',m.leads,'Ready for follow-up','leads','leads','blue','leads')+metric('Sales pipeline',short(m.pipeline),m.deals+' opportunities','deals','deals','mint','pipeline')+metric('Open tasks',openTasks,'Keep work moving','tasks','tasks','lavender','tasks');
    else html+=metric('Active employees',m.employees,m.present+' present today','team','team','blue','employees')+metric('Pending requests',m.requests,'Review and approve','approvals','approvals','amber','requests')+(can('payroll')?metric('Net payroll',short(m.net),m.payEmployees+' employees · Oct','payroll','wallet','mint','net'):metric('On leave',m.onLeave,'Today in this workspace','attendance-team','attendance','mint'))+(can('crm')?metric('Open pipeline',short(m.pipeline),m.leads+' open leads','deals','deals','lavender','pipeline'):metric('Attendance review',m.attendanceReview,'Shift exceptions','attendance-team','attendance','lavender'));
    html+='</div>';
    const priority=[];
    if(can('approveRequests')&&m.requests) priority.push(tile(m.requests+' requests to review','Leave & attendance approvals','approvals','approvals','amber'));
    if(can('payroll')&&m.issues) priority.push(tile(m.issues+' payroll check'+(m.issues===1?'':'s'),'Resolve before the next pay run','payroll-inputs','wallet','lavender'));
    if(can('crm')) priority.push(tile(openTasks+' customer follow-up'+(openTasks===1?'':'s'),'Open your team’s task list','tasks','tasks','blue'));
    html+='<div class="studio-dashboard-columns"><section>'+section('Your workspaces')+'<div class="studio-module-grid">'+(can('crm')?moduleCard('CRM','Leads, deals & customers','crm','deals','blue',m.leads+' leads'):'')+(can('people')?moduleCard('People','Team, attendance & leave','people','team','mint',m.employees+' people'):'')+(can('payroll')?moduleCard('Payroll','Prepare, review & publish','payroll','wallet','lavender','October'):'')+(can('reports')?moduleCard('Reports','Insights & PDF exports','reports','reports','amber'):'')+'</div></section><section class="studio-attention">'+section('Needs attention')+'<div class="flow-priorities">'+(priority.join('')||empty('You’re all caught up','New reviews will appear here.'))+'</div>'+section('Your personal space')+'<div class="studio-personal">'+tile('My attendance','Check-in, leave & corrections','attendance','attendance','mint')+tile('My payslips','View your published pay','my-pay','wallet','blue')+'</div></section></div>';
    if(all)html+=section('Branch overview')+'<div class="flow-branch-grid">'+B.branches(D(),A()).map(branch=>{const n=B.summary(D(),A(),{branch}),rate=n.employees?Math.round(n.present/n.employees*100):0;return `<button type="button" class="flow-branch-card" data-act="branch-dashboard" data-id="${esc(branch)}"><span class="between"><span class="row"><span class="flow-tile-icon">${icon('building')}</span><strong>${esc(branch)}</strong></span>${icon('chevron')}</span><span class="flow-branch-numbers"><span><strong>${n.employees}</strong>Employees</span><span><strong>${n.present}</strong>Present today</span><span><strong>${n.requests}</strong>Requests</span></span><span class="studio-branch-progress"><span style="width:${Math.min(100,rate)}%"></span></span><span class="flow-branch-foot">${rate}% present${can('payroll')?' · '+short(n.net)+' net payroll':''}</span></button>`;}).join('')+'</div>';
    return html;
  }

  function attendanceCard() {
    const e=self(), at=D().attendance.find(r=>r.employeeId===e.id&&r.date===root.DemoData.DEMO_DATE);
    return '<div class="flow-shift-card"><div class="between"><span class="row"><span class="flow-tile-icon">'+icon('attendance')+'</span><h2>Today’s attendance</h2></span>'+tag(at?.outTime?'Shift complete':at?.inTime?'Checked in':'Not checked in')+'</div><p class="small muted mt">'+esc(e.branch)+' · 09:00–18:00 shift</p><div class="flow-shift-times"><div><span>Check in</span><strong>'+esc(at?.inTime||'—')+'</strong></div><span class="flow-shift-line"></span><div><span>Check out</span><strong>'+esc(at?.outTime||'—')+'</strong></div></div>'+(at?.outTime?nav('View attendance','attendance','full secondary'):btn(at?.inTime?'Check out':'Check in',at?.inTime?'check-out':'check-in',e.id,'full'))+'<small class="flow-local-hint">Sample shift · saved on this device</small></div>';
  }
  function employeeHome() {
    const e=self(), tasks=E.tasks(D(),A()).filter(t=>t.status!=='Completed').sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)), slip=E.payslips(D(),A())[0];
    return title('My work','Saturday, 3 October · '+e.branch)+ '<div class="flow-employee-greeting"><span class="eyebrow">YOUR PERSONAL WORKSPACE</span><h2>Hello, '+esc(e.name.split(' ')[0])+'.</h2><p>One clear place for your day, tasks and pay.</p></div><div class="flow-employee-columns"><section>'+attendanceCard()+'<div class="flow-tile-grid mt">'+tile('Apply for leave',e.cl+' casual · '+e.sl+' sick days','leave','leave','mint')+tile('My profile','Details & documents','profile','profile','blue')+'</div></section><section><div class="stats flow-stats employee-metrics">'+(E.canTasks(D(),A())?metric('Tasks to do',tasks.length,'Assigned only to you','my-tasks','tasks','blue'):metric('Leave balance',e.cl+' days','Casual leave remaining','leave','leave','mint'))+metric('Latest take-home',slip?money(slip.row.gross-slip.row.deductions):'—',slip?slip.label+' · '+slip.status:'No published payslip yet','my-pay','wallet','lavender')+'</div>'+(E.canTasks(D(),A())?section('Your next tasks','my-tasks')+(tasks.length?tasks.slice(0,3).map(taskCard).join(''):empty('Your tasks are up to date','Assigned CRM tasks will appear here.')):'')+'</section></div>';
  }

  function employeeAttendance() {
    const rows=D().attendance.filter(r=>r.employeeId===self().id).sort((a,b)=>b.date.localeCompare(a.date));
    return title('My attendance','Your shifts and correction requests.')+'<div class="flow-detail-columns"><section>'+attendanceCard()+'<div class="button-row mt">'+btn('Request correction','attendance-correction','','secondary')+nav('Apply leave','leave','soft')+'</div></section><section>'+section('Recorded shifts')+(rows.length?rows.slice(0,31).map(r=>'<div class="flow-record"><div class="between"><strong>'+date(r.date)+'</strong>'+tag(r.status)+'</div><div class="list-meta"><span>In '+esc(r.inTime||'—')+'</span><span>Out '+esc(r.outTime||'—')+'</span></div>'+(r.note?'<p class="small muted mt">'+esc(r.note)+'</p>':'')+'</div>').join(''):empty('No attendance recorded','Check in to record your first demo shift.'))+'</section></div>';
  }
  function myPay() {
    const slips=E.payslips(D(),A()), latest=slips[0], e=self();
    return title('My payroll','Published payslips for your employee account.')+'<div class="flow-detail-columns"><section><div class="flow-pay-card"><span class="eyebrow">'+(latest?'LATEST PUBLISHED PAY':'YOUR PAYROLL')+'</span><h2>'+(latest?latest.label:'Your payslips will appear here')+'</h2><div class="hero-value">'+(latest?money(latest.row.gross-latest.row.deductions):'—')+'</div><p>'+(latest?'Take-home pay · '+latest.status:'Your manager must publish payroll before a payslip is available.')+'</p>'+(latest?nav('View payslip','payslip/'+latest.key,'full mt'):'')+'</div>'+note('Only published payroll is visible here. Salary settings and draft payroll do not count as paid salary.')+nav('Salary advance requests','advance','full secondary')+'</section><section>'+section('Payslip history')+(slips.length?slips.map(s=>'<button class="flow-record" data-act="nav" data-target="payslip/'+s.key+'"><div class="between"><span class="row"><span class="flow-tile-icon">'+icon('doc')+'</span><span class="stack"><strong>'+s.label+'</strong><small>'+money(s.row.gross-s.row.deductions)+' take-home</small></span></span>'+tag(s.status)+'</div></button>').join(''):empty('No payslips yet','New employees start with an empty pay history.'))+'</section></div>';
  }
  function payslip(period) {
    const s=E.payslips(D(),A()).find(s=>s.key===period), e=self();
    if(!s)return title('Payslip unavailable','This period has not been published for you.','',true)+empty('No payslip for this period','Your published payslips appear in My payroll.');
    const p=s.row;
    return title(s.label+' payslip',e.name+' · '+e.id,btn('Save PDF','export-payslip',s.key,'small'),true)+'<div class="flow-payslip document-preview"><div class="between"><div><div class="eyebrow">EMPLOYEE PAYSLIP</div><h2>'+esc(C().name)+'</h2><p class="small muted mt">'+esc(e.branch)+' · '+esc(e.department)+'</p></div>'+tag(s.status)+'</div><div class="divider"></div>'+detail([['Employee',e.name],['Employee ID',e.id],['Pay period',s.label],['Bank ending',e.bankLast4||'Not added']])+'<div class="divider"></div><h3>Earnings</h3>'+[['Basic salary',p.basic],['House rent allowance',p.hra],['Special allowance',p.allowance],['Approved incentive',p.incentive]].map(([label,value])=>'<div class="money-row"><span>'+label+'</span><strong>'+money(value)+'</strong></div>').join('')+'<h3 class="mt">Deductions</h3>'+[['Retirement contribution',p.retirement],['Demo tax deduction',p.tax]].map(([label,value])=>'<div class="money-row"><span>'+label+'</span><strong>'+money(value)+'</strong></div>').join('')+'<div class="money-row total"><span>Net take-home</span><strong>'+money(p.gross-p.deductions)+'</strong></div><p class="tiny muted mt">Fictional sample payslip. Not a statutory or employment record.</p></div>';
  }
  function employeeProfile() {
    const e=self();
    return title('My profile','Your details and self-service options.')+'<div class="flow-detail-columns"><section><div class="card"><div class="row">'+avatar(e.name,'large')+'<div><h2>'+esc(e.name)+'</h2><p class="small muted mt">'+esc(e.designation||e.department)+' · '+esc(e.branch)+'</p>'+tag('Employee')+'</div></div><div class="divider"></div>'+detail([['Employee ID',e.id],['Work email',e.email],['Department',e.department],['Manager',e.manager],['Joined',date(e.joinDate)],['Phone',e.phone]])+'<p class="small muted mt">Ask your manager to update your employment details.</p></div></section><section><div class="flow-tile-grid">'+tile('Leave & requests','Apply and track requests','leave','leave','mint')+tile('My documents','Employment records','documents','doc','blue')+tile('Salary advances','Request and track','advance','wallet','lavender')+tile('Help','Using your workspace','help','support','amber')+'</div>'+btn('Sign out','logout','','full secondary mt')+'<p class="small muted flow-local-hint">Your attendance, payslips and assigned tasks stay linked to your employee account.</p></section></div>';
  }

  function employeeHelp() {
    return title('Employee help','A quick guide to your own workspace.','',true)+'<div class="flow-tile-grid">'+tile('Record your workday','Open Attendance to check in or out.','attendance','attendance','mint')+(E.canTasks(D(),A())?tile('Keep work moving','Open an assigned task and save a progress note.','my-tasks','tasks','blue'):'')+tile('View your pay','Published payslips appear under Payroll.','my-pay','wallet','lavender')+tile('Request time off','Choose dates and submit a leave request.','leave','leave','amber')+'</div><div class="card mt"><h2>Need a correction?</h2><p class="small muted mt">Use Request correction in Attendance for a recorded shift. Ask your manager to update your profile, enable access or reset your demo password.</p></div>'+note('This is an offline sample app. Your manager and employee logins share records only in the same Business app on the same device. A backend is required to connect different devices.');
  }

  function resetListContext(name) {
    const key=[name,A()?.id,C()?.id,D().settings.branch].join('|');
    if(listContext!==key){listContext=key;query='';filter='All';page=0;}
  }
  function filterBar(name, options, placeholder) {
    return '<div class="flow-filterbar"><label class="flow-search">'+icon('search')+'<input type="search" data-flow-search="'+name+'" value="'+esc(query)+'" placeholder="'+esc(placeholder)+'" aria-label="'+esc(placeholder)+'"></label><div class="flow-filter-chips">'+options.map(label=>'<button class="'+(filter===label?'active':'')+'" data-act="flow-filter" data-id="'+esc(label)+'" aria-pressed="'+(filter===label)+'">'+esc(label)+'</button>').join('')+'</div></div>';
  }
  function pages(rows, renderer, size=12) {
    const count=rows.length; page=Math.min(page,Math.max(0,Math.ceil(count/size)-1));
    return '<p class="flow-count">'+count+' '+(H.route().startsWith('team')?'employees':'tasks')+(count?' · showing '+(page*size+1)+'–'+Math.min(count,(page+1)*size):'')+'</p>'+ (count?'<div class="flow-list-grid">'+rows.slice(page*size,(page+1)*size).map(renderer).join('')+'</div>':empty('No matches','Try another search or filter.'))+(count>size?'<div class="flow-pagination"><button class="btn secondary small" data-act="flow-page" data-id="-1" '+(!page?'disabled':'')+'>Previous</button><span>Page '+(page+1)+' of '+Math.ceil(count/size)+'</span><button class="btn secondary small" data-act="flow-page" data-id="1" '+((page+1)*size>=count?'disabled':'')+'>Next</button></div>':'');
  }
  function employeeRows() {
    const rows=B.records(D(),A(),'employees').filter(e=>[e.name,e.id,e.email,e.department,e.branch].join(' ').toLowerCase().includes(query.toLowerCase())).filter(e=>filter==='All'||e.status===filter||(filter==='Login enabled'&&E.loginFor(D(),e.id)?.active)||(filter==='No login'&&!E.loginFor(D(),e.id)?.active));
    return pages(rows,e=>{const a=E.loginFor(D(),e.id);return '<button class="flow-person-card" data-act="nav" data-target="employee/'+e.id+'"><div class="between"><span class="row">'+avatar(e.name)+'<span class="stack"><strong>'+esc(e.name)+'</strong><small>'+esc(e.designation||e.department)+'</small></span></span>'+icon('chevron')+'</div><div class="flow-person-meta"><span>'+esc(e.branch)+'</span>'+tag(e.status)+'</div><div class="flow-person-foot">'+icon(a?.active?'check':'lock')+'<span>'+(a?.active?'Employee login enabled':'Employee login not enabled')+'</span></div></button>';});
  }
  function directory() {
    resetListContext('employees');const rows=B.records(D(),A(),'employees'), active=rows.filter(e=>e.status==='Active').length, logins=rows.filter(e=>E.loginFor(D(),e.id)?.active).length;
    return title('Employees','Create a profile, enable login and assign work.',B.can(A(),'peopleEdit')?nav('Add employee','employee-new','small'):'')+'<div class="flow-summary-strip"><span><strong>'+rows.length+'</strong> employees</span><span><strong>'+active+'</strong> active</span><span><strong>'+logins+'</strong> employee logins</span></div>'+filterBar('employees',['All','Active','Inactive','Login enabled','No login'],'Search name, email or branch')+'<div id="flow-results">'+employeeRows()+'</div>';
  }
  function employeeDetail(id) {
    const e=B.records(D(),A(),'employees').find(e=>e.id===id);
    if(!e)return title('Employee unavailable','Choose an employee in this branch.');
    const a=E.loginFor(D(),id), can=B.can(A(),'peopleEdit'), taskRows=E.tasks(D(),A()).filter(t=>t.assignedEmployeeId===id);
    return title(e.name,e.id+' · '+e.branch,can?nav('Edit profile','employee-edit/'+id,'small secondary'):'',true)+'<div class="flow-detail-columns"><section><div class="card"><div class="row">'+avatar(e.name,'large')+'<div><h2>'+esc(e.name)+'</h2><p class="small muted mt">'+esc(e.designation||e.department)+'</p>'+tag(e.status)+'</div></div><div class="divider"></div>'+detail([['Work email',e.email],['Phone',e.phone],['Department',e.department],['Manager',e.manager],['Branch',e.branch],['Joining date',date(e.joinDate)]])+'</div><div class="card"><h2>Payroll settings</h2>'+detail([['Monthly gross',money(e.gross)],['Deductions',money(e.deductions)],['Expected net',money(e.gross-e.deductions)],['Bank ending',e.bankLast4||'Not added']])+'<div class="between mt">'+tag(e.bankStatus)+(e.bankStatus!=='Verified'&&B.can(A(),'bank')?btn('Verify bank','verify-bank',id,'small secondary'):'')+'</div></div></section><section><div class="flow-access-card"><span class="flow-tile-icon">'+icon('lock')+'</span><h2>Employee login</h2><p>'+esc(a?.active?'Enabled — this employee can sign in to their own workspace.':a?'Disabled — this employee cannot sign in.':'Create a separate login for this employee.')+'</p>'+detail([['Login email',a?.email||e.email],['Workspace','Attendance, leave & published payslips'],['Assigned CRM tasks',a?.taskAccess!==false&&a?'Enabled':'Not enabled']])+(can?btn(a?'Manage employee access':'Enable employee login','flow-access',id,'full mt'):'')+'</div>'+section('Assigned tasks')+(taskRows.length?taskRows.slice(0,4).map(taskCard).join(''):empty('No tasks assigned','Create a CRM task and choose this employee.'))+(E.canTasks(D(),A())?nav('Assign a task','task-new','full secondary mt'):'')+'</section></div>';
  }

  function wizardKey(id) {return [A().id,C().id,D().settings.branch,id||'new'].join('|');}
  function draftStorage() {return P.config.draftKey+'-employee-flow';}
  function employeeWizard(id='') {
    const key=wizardKey(id), e=D().employees.find(e=>e.id===id), a=e&&E.loginFor(D(),id);
    if(!wizard||wizard.key!==key){
      let cached;try{cached=JSON.parse(localStorage.getItem(draftStorage())||'{}')[key];}catch(_){}
      wizard=cached||{key,id,step:0,values:{name:e?.name||'',email:e?.email||'',phone:e?.phone||'',designation:e?.designation||'',department:e?.department||'Operations',branch:e?.branch||(D().settings.branch===B.ALL?B.branches(D(),A())[0]:D().settings.branch),manager:e?.manager||A().name,joinDate:e?.joinDate||root.DemoData.DEMO_DATE,status:e?.status||'Active',gross:e?.gross||45000,deductions:e?.deductions||0,bankLast4:e?.bankLast4||'',loginEnabled:e?!!a?.active:true,taskAccess:a?a.taskAccess!==false:true,password:'Demo123'}};
    }
    const v=wizard.values;let fields='';
    if(wizard.step===0) fields='<h2 class="flow-form-title">Who is joining your team?</h2><div class="form-grid">'+H.field('Full name','name',v.name,'text',true)+H.field('Work email','email',v.email,'email',true,'Used for employee sign-in.')+H.field('Phone (optional)','phone',v.phone,'tel')+H.field('Job title (optional)','designation',v.designation)+H.select('Department','department',['Operations','Sales','Support','HR','Finance','Engineering','Production','Other'],v.department)+H.select('Branch','branch',D().settings.branch===B.ALL?B.branches(D(),A()):[D().settings.branch],v.branch)+H.field('Reporting manager','manager',v.manager,'text',true)+H.field('Joining date','joinDate',v.joinDate,'date',true)+'</div>';
    if(wizard.step===1) fields='<h2 class="flow-form-title">Pay and employee access</h2><div class="form-grid">'+H.field('Monthly gross salary (₹)','gross',v.gross,'number',true,'Before deductions.','min="1"')+H.field('Monthly deductions (₹)','deductions',v.deductions,'number',true,'Sample amount; no statutory tax calculation.','min="0"')+H.field('Bank ending (optional)','bankLast4',v.bankLast4,'text',false,'Last four digits only.','pattern="[0-9]{4}" maxlength="4"')+H.select('Employment status','status',['Active','Inactive'],v.status)+'</div><div class="flow-form-divider"></div>'+checkbox('Enable employee login','loginEnabled',v.loginEnabled,'A separate personal workspace for this employee.')+(!a?H.field('Temporary demo password','password',v.password,'text',true,'Use at least 6 characters. Share it with the employee manually.','minlength="6"'):'<p class="small muted mb">Existing password stays unchanged. Reset it in Manage employee access.</p>')+checkbox('Show assigned CRM tasks','taskAccess',v.taskAccess,'Employee sees only the tasks assigned to them.')+'<div class="flow-inline-note">'+icon('lock')+'Employee access does not include other employees, business reports or payroll approval.</div>';
    if(wizard.step===2) fields='<h2 class="flow-form-title">Review and '+(id?'save':'create')+'</h2>'+detail([['Employee',v.name],['Email',v.email],['Department / branch',v.department+' · '+v.branch],['Monthly gross',money(v.gross)],['Deductions',money(v.deductions)],['Expected take-home',money(v.gross-v.deductions)],['Employee login',v.loginEnabled&&v.status==='Active'?'Enabled':'Disabled'],['CRM tasks',v.taskAccess?'Assigned tasks only':'Hidden']])+'<div class="flow-inline-note">'+icon('check')+'Profile, payroll settings and employee access will be saved together.</div>';
    return title(id?'Edit employee':'Add employee','Three short steps. One connected employee record.','',true)+'<div class="flow-form-layout"><div><ol class="flow-stepper">'+['Profile','Pay & login','Review'].map((label,i)=>'<li class="'+(i===wizard.step?'active':i<wizard.step?'done':'')+'"><span>'+(i<wizard.step?'✓':i+1)+'</span>'+label+'</li>').join('')+'</ol><form id="flow-employee-form" data-record="'+esc(id)+'"><div class="card flow-form-card">'+fields+'<div class="form-error" role="alert"></div></div><div class="form-actions">'+(wizard.step?btn('Back','flow-wizard-prev','','secondary'):nav('Cancel','team','secondary'))+'<button type="submit" class="btn">'+(wizard.step===2?(id?'Save employee':'Create employee'):'Continue')+'</button></div><p class="form-draft-note">Your draft is saved on this device.</p></form></div><aside class="flow-form-aside"><span class="flow-tile-icon">'+icon('team')+'</span><h2>A better first day</h2><p>Create the record once. Your employee gets a focused place to check attendance, tasks and payslips.</p><ul><li>Personal attendance & leave</li><li>Published payslips only</li><li>Assigned CRM tasks</li><li>Manager controls access</li></ul><p class="small muted">Offline demo logins work on this device. No invitation email is sent.</p></aside></div>';
  }
  function captureWizard(form) {
    if(!wizard||!form)return;
    const values=Object.fromEntries(new FormData(form));
    for(const name of ['loginEnabled','taskAccess'])if(form.elements.namedItem(name))values[name]=form.elements.namedItem(name).checked;
    Object.assign(wizard.values,values);
  }
  function persistWizard() {
    clearTimeout(draftTimer);if(!wizard)return;
    let all={};try{all=JSON.parse(localStorage.getItem(draftStorage())||'{}');}catch(_){}
    all[wizard.key]=wizard;localStorage.setItem(draftStorage(),JSON.stringify(all));
  }
  function clearWizard() {
    clearTimeout(draftTimer);if(!wizard)return;
    let all={};try{all=JSON.parse(localStorage.getItem(draftStorage())||'{}');}catch(_){}
    delete all[wizard.key];localStorage.setItem(draftStorage(),JSON.stringify(all));wizard=null;
  }
  function accessModal(id) {
    const e=B.records(D(),A(),'employees').find(e=>e.id===id), a=e&&E.loginFor(D(),id);
    if(!e||!B.can(A(),'peopleEdit'))throw Error('Employee management access required.');
    H.modal('Employee login · '+e.name,'<form id="flow-access-form" data-record="'+id+'">'+H.field('Login email','email',a?.email||e.email,'email',true)+checkbox('Enable employee login','loginEnabled',a?!!a.active:true,'Inactive employees cannot sign in.')+checkbox('Show assigned CRM tasks','taskAccess',a?a.taskAccess!==false:true,'Only this employee’s assigned tasks.')+H.field(a?'New password (optional)':'Temporary demo password','password',a?'':'Demo123','text',!a,a?'Leave blank to keep the current password.':'Use at least 6 characters.','minlength="6"')+'<div class="form-error" role="alert"></div><button class="btn full" type="submit">Save employee access</button></form>');
  }

  function taskCard(t) {
    const target=(employee()?'my-task/':'task/')+t.id;
    return '<button class="flow-task-card" data-act="nav" data-target="'+target+'"><div class="between"><span class="flow-task-type '+(t.priority==='High'?'high':'')+'">'+icon(t.type==='Call'?'phone':'tasks')+esc(t.type)+(t.priority==='High'?' · High priority':'')+'</span>'+tag(t.status)+'</div><h3>'+esc(t.title)+'</h3><p>'+date(t.date)+' · '+esc(t.time)+(employee()?'':' · '+esc(t.owner))+'</p></button>';
  }
  function taskRows() {
    const rows=E.tasks(D(),A()).filter(t=>[t.title,t.owner,t.note].join(' ').toLowerCase().includes(query.toLowerCase())).filter(t=>filter==='All'||filter==='Today'&&t.date===root.DemoData.DEMO_DATE||t.status===filter).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
    return pages(rows,taskCard);
  }
  function taskList() {
    resetListContext('tasks');const rows=E.tasks(D(),A()), open=rows.filter(t=>t.status!=='Completed').length;
    return title(employee()?'My tasks':'Tasks & follow-ups',employee()?'Only work assigned to you. Add progress and completion notes.':'Assign an employee, set a due date and track the outcome.',employee()?'':nav('Assign task','task-new','small'))+'<div class="flow-summary-strip"><span><strong>'+open+'</strong> to do</span><span><strong>'+rows.filter(t=>t.date===root.DemoData.DEMO_DATE&&t.status!=='Completed').length+'</strong> due today</span><span><strong>'+rows.filter(t=>t.status==='Completed').length+'</strong> completed</span></div>'+filterBar('tasks',['All','Today','Open','In progress','Completed'],'Search tasks or employee')+'<div id="flow-results">'+taskRows()+'</div>';
  }
  function taskForm(relatedId='',id='') {
    const t=id?E.tasks(D(),A()).find(t=>t.id===id):{}, lead=D().leads.find(l=>l.id===relatedId), branches=D().settings.branch===B.ALL?B.branches(D(),A()):[D().settings.branch];
    const branch=t?.branch||lead?.branch||branches[0], people=B.records(D(),A(),'employees').filter(e=>e.status==='Active'&&e.branch===branch);
    const leads=B.records(D(),A(),'leads').filter(l=>l.branch===branch);
    return title(id?'Edit task':'Assign a task','An employee sees this in their own workspace.','',true)+'<form id="flow-task-form" data-record="'+esc(id)+'" class="form-narrow"><div class="card flow-form-card"><div class="form-grid">'+H.field('Task title','title',t?.title||'','text',true)+H.select('Type','type',['Task','Call','Meeting'],t?.type||'Task')+H.select('Branch','branch',branches,branch)+H.select('Assign to employee','assignedEmployeeId',people.map(e=>({value:e.id,label:e.name+' · '+e.id})),t?.assignedEmployeeId||people[0]?.id)+H.field('Due date','date',t?.date||root.DemoData.DEMO_DATE,'date',true)+H.field('Due time','time',t?.time||'11:00','time',true)+H.select('Priority','priority',['Normal','High'],t?.priority||'Normal')+H.select('Related lead (optional)','relatedId',[{value:'',label:'No linked lead'},...leads.map(l=>({value:l.id,label:l.organization}))],t?.relatedId||relatedId)+H.textArea('Instructions / expected outcome','note',t?.note||'')+'</div><div class="flow-inline-note">'+icon('info')+'Employee needs an enabled login and task access to view this assignment.</div><div class="form-error" role="alert"></div></div><div class="form-actions">'+btn('Cancel','back','','secondary')+'<button class="btn" type="submit">'+(id?'Save task':'Assign task')+'</button></div></form>';
  }
  function taskDetail(id) {
    const t=E.tasks(D(),A()).find(t=>t.id===id);
    if(!t)return title('Task unavailable','This task is outside your access.','',true);
    const lead=D().leads.find(l=>l.id===t.relatedId&&l.companyId===t.companyId&&l.branch===t.branch);
    return title(t.title,t.type+' · '+t.branch,employee()?'':nav('Edit / reassign','task-edit/'+id,'small secondary'),true)+'<div class="flow-detail-columns"><section><div class="card"><div class="between"><h2>Task details</h2>'+tag(t.status)+'</div>'+detail([['Assigned to',t.owner],['Due',date(t.date)+' · '+t.time],['Priority',t.priority||'Normal'],['Assigned by',t.assignedBy||'Manager']])+'<div class="flow-task-note">'+esc(t.note||'No extra instructions.')+'</div></div>'+(lead?'<div class="card"><h2>Related contact</h2>'+detail([['Organisation',lead.organization],['Contact',lead.contact],['Email',lead.email],['Phone',lead.phone]])+'<p class="small muted mt">Contact details belong to this assigned task.</p></div>':'')+'</section><section><div class="card"><h2>Update progress</h2><form id="flow-task-update" data-record="'+id+'" class="mt">'+H.select('Task status','status',['Open','In progress','Completed'],t.status)+H.textArea('Progress / completion note','note','',false)+'<div class="form-error" role="alert"></div><button class="btn full" type="submit">Save update</button></form></div>'+section('Activity history')+((t.updates||[]).length?t.updates.map(u=>'<div class="flow-record"><div class="between"><strong>'+esc(u.by)+'</strong>'+tag(u.status)+'</div><p class="small mt">'+esc(u.note||'Status updated.')+'</p><small class="muted">'+date(u.date)+'</small></div>').join(''):empty('No updates yet','Progress and completion notes appear here.'))+'</section></div>';
  }

  function adminHome() {
    const m=S.platformMetrics(D()),owner=S.platformOwner(A()),needs=D().tenants.filter(t=>['Past due','Suspended','Expired'].includes(S.effectiveStatus(t)));
    const quick=owner?quickAction('Customers','platform-customers','building','blue')+quickAction('New offer','','star','lavender','saas-offer-new')+quickAction('Campaign','','leads','mint','saas-campaign-new')+quickAction('Support','platform-support','support','amber'):quickAction('Customers','platform-customers','building','blue')+quickAction('Support','platform-support','support','mint');
    return homeHeading('BranchSuite Admin',owner?'Your platform':'Customer support','A clear view of your subscription business.')+'<div class="studio-quickbar" aria-label="Quick actions">'+quick+'</div><div class="studio-section-label"><h2>Business health</h2><span>Sample subscriptions</span></div><div class="stats flow-stats">'+metric('Businesses',m.customers,m.active+' active · '+m.trials+' trial','platform-customers','building','blue')+metric('Need attention',m.attention,'Review subscription status','platform-customers','approvals','amber')+(owner?metric('Monthly recurring',money(m.mrr),'Monthly equivalent · demo','platform-billing','wallet','mint'):metric('Open support',m.support,'Customer enquiries','platform-support','support','mint'))+metric(owner?'Unpaid invoices':'Trial workspaces',owner?money(m.unpaid):m.trials,owner?'Outstanding · sample':'Help them get started',owner?'platform-billing':'platform-customers',owner?'quote':'star','lavender')+'</div><div class="studio-dashboard-columns"><section>'+section('Manage your platform')+'<div class="studio-module-grid">'+moduleCard('Customers','Businesses & subscriptions','platform-customers','building','blue',m.customers+' businesses')+(owner?moduleCard('Plans & limits','Pricing, seats & features','platform-plans','wallet','lavender',D().plans.length+' plans')+moduleCard('Billing','Invoices & collections','platform-billing','quote','mint')+moduleCard('Marketing','Prospects & follow-ups','platform-marketing','leads','amber',m.prospects+' prospects')+moduleCard('Offers','Coupons & campaigns','platform-offers','star','lavender'):'')+moduleCard('Support','Enquiries & resolutions','platform-support','support','blue',m.support+' open')+'</div></section><section class="studio-attention">'+section('Priority queue')+'<div class="flow-priorities">'+needs.map(t=>tile(t.name,S.effectiveStatus(t)+' · subscription review','platform-customer/'+t.id,'building','amber')).join('')+(m.support?tile(m.support+' support requests','Help customers get back to work','platform-support','support','blue'):'')+(owner&&m.prospects?tile(m.prospects+' open prospects','Review your next opportunity','platform-marketing','leads','mint'):'')+(!needs.length&&!m.support&&(!owner||!m.prospects)?empty('All caught up','New customer activity will appear here.'):'')+'</div></section></div>'+section('Customer health','platform-customers')+'<div class="studio-health-grid">'+D().tenants.map(t=>{const u=S.usage(D(),t),p=S.plan(D(),t.subscription.planId);return `<button type="button" class="studio-health-card" data-act="nav" data-target="platform-customer/${t.id}"><span class="between">${avatar(t.name)}${tag(S.effectiveStatus(t))}</span><strong>${esc(t.name)}</strong><small>${esc(p.name)} plan · ${esc(t.industry)}</small><span class="studio-health-numbers"><span>${icon('team')}${u.employees} employees</span><span>${icon('building')}${u.branches} branches</span></span><span class="studio-module-bottom">Manage subscription ${icon('chevron')}</span></button>`;}).join('')+'</div>';
  }
  function screen(route,h) {
    use(h);const [name,id]=route.split('/');
    if(['login','employee-login'].includes(name))return loginScreen();
    if(P.isAdmin()){if(name==='platform-home'||name==='home')return adminHome();return null;}
    if(!A())return null;
    switch(name){
      case 'home':return businessHome();
      case 'team':return directory();
      case 'employee':return employeeDetail(id);
      case 'employee-new':return employeeWizard();
      case 'employee-edit':return employeeWizard(id);
      case 'tasks':case 'my-tasks':return taskList();
      case 'task':case 'my-task':return taskDetail(id);
      case 'task-new':return taskForm(id);
      case 'task-edit':return taskForm('',id);
      case 'my-pay':return myPay();
      case 'payslip':return payslip(id);
      case 'attendance':return employeeAttendance();
      case 'profile':if(employee())return employeeProfile();return null;
      case 'more':case 'settings':if(employee())return employeeProfile();return null;
      case 'help':if(employee())return employeeHelp();return null;
      default:return null;
    }
  }

  function menuItems(admin) {
    if(admin){const owner=S.platformOwner(A());return [['Overview','platform-home','home'],['Customers','platform-customers','building'],...(owner?[['Plans','platform-plans','wallet'],['Billing','platform-billing','quote'],['Marketing','platform-marketing','leads'],['Offers','platform-offers','star']]:[]),['Support','platform-support','support'],...(owner?[['Settings','platform-settings','settings'],['Audit history','platform-audit','doc']]:[])];}
    if(employee())return [['My work','home','home'],['Attendance','attendance','attendance'],...(E.canTasks(D(),A())?[['My tasks','my-tasks','tasks']]:[]),['My payroll','my-pay','wallet'],['Leave & requests','leave','leave'],['My profile','profile','profile']];
    const can=k=>B.can(A(),k)&&S.allowPermission(D(),A(),k);
    return [['Overview','home','home'],...(can('crm')?[['CRM','crm','deals'],['Tasks','tasks','tasks']]:[]),...(can('people')?[['Employees','team','team'],['Attendance','attendance-team','attendance']]:[]),...(can('approveRequests')?[['Approvals','approvals','approvals']]:[]),...(can('payroll')?[['Payroll','payroll','wallet']]:[]),...(can('reports')?[['Reports','reports','reports']]:[]),['More','more','more']];
  }
  function shell(html,navItems,active,h,admin=false) {
    use(h);const a=A(),isEmp=!admin&&employee(),tenant=!admin&&S.tenant(D(),a), all=menuItems(admin);
    document.body.classList.toggle('flow-employee',isEmp);document.body.classList.toggle('flow-shell',true);
    const currentRoute=H.route().split('/')[0];
    const sidebarGroups=admin?{'platform-customer':'platform-customers','platform-invoice':'platform-billing','platform-ticket':'platform-support','platform-lead':'platform-marketing'}:isEmp?{'my-task':'my-tasks','payslip':'my-pay','documents':'profile','advance':'my-pay','advance-new':'my-pay'}:{people:'team',employee:'team','employee-new':'team','employee-edit':'team',task:'tasks','task-new':'tasks','task-edit':'tasks','payroll-inputs':'payroll','payroll-review':'payroll',payments:'payroll',incentives:'payroll'};
    const sidebarCurrent=all.some(i=>i[1]===currentRoute)?currentRoute:sidebarGroups[currentRoute]||active;
    const navButtons=items=>items.map(([label,target,symbol])=>{const selected=(items===all?sidebarCurrent:active)===target;return '<button type="button" class="'+(selected?'active':'')+'" data-act="tab" data-target="'+target+'" '+(selected?'aria-current="page"':'')+'>'+icon(symbol)+'<span>'+esc(label)+'</span></button>';}).join('');
    document.body.dataset.screen=H.route().split('/')[0];
    const role = admin?a.role:isEmp?'Employee':B.policy(a).label;
    const brand='<span class="brand-mark">'+icon(admin?'building':isEmp?'profile':'deals')+'</span><span>BranchSuite<small>'+ (admin?'Admin':isEmp?'Employee':'Business')+'</small></span>';
    const context=admin?'<div class="flow-top-label"><strong>BranchSuite</strong><small>Admin console</small></div>':isEmp?'<div class="flow-top-label"><strong>'+esc(S.tenant(D(),a).name)+'</strong><small class="company-scope">'+esc(self().branch)+' · Employee workspace</small></div>':'<button class="flow-business-name" data-act="portal-switch-business" aria-label="Switch demo business"><span class="stack"><strong>'+esc(tenant.name)+'</strong><small>Business workspace</small></span>'+icon('down')+'</button>';
    const roleButton=admin?'<button class="flow-user-button" data-act="portal-admin-account" aria-label="Switch admin account">'+avatar(a.name)+'<span>Account</span>'+icon('down')+'</button>':isEmp?'<button class="flow-user-button" data-act="nav" data-target="profile" aria-label="My profile">'+avatar(a.name)+'</button>':'<button class="flow-user-button" data-act="role-context" aria-label="Switch business role">'+avatar(a.name)+'<span>'+esc(role)+'</span>'+icon('down')+'</button>';
    const scope=admin||isEmp?'':'<div class="flow-context-row"><button class="flow-context company-scope" data-act="companies"><span>Company</span><strong>'+esc(C().name)+'</strong>'+icon('down')+'</button><button class="flow-context branch-scope" data-act="branches"><span>'+ (D().settings.personal?'Personal branch':'Branch')+'</span><strong>'+esc(B.title(D(),a))+'</strong>'+icon('down')+'</button><span class="flow-scope-state">'+tag(S.effectiveStatus(tenant))+'</span></div>';
    return '<aside class="flow-sidebar"><div class="brand">'+brand+'</div><p class="flow-nav-caption">'+(isEmp?'MY WORKSPACE':admin?'PLATFORM':'WORKSPACE')+'</p><div class="sidebar-nav">'+navButtons(all)+'</div><div class="flow-sidebar-footer">'+(!admin&&!isEmp?nav('Subscription & settings','subscription','full secondary small'):'')+'<div class="flow-sidebar-user">'+avatar(a.name)+'<span><strong>'+esc(a.name)+'</strong><small>'+esc(role)+'</small></span></div><span class="flow-demo-dot">Sample data · offline</span></div></aside><div class="flow-body"><header class="flow-topbar"><div class="flow-top-main">'+context+'<div class="flow-top-actions"><button class="icon-button" data-act="flow-search" aria-label="Find a module">'+icon('search')+'</button>'+roleButton+'</div></div>'+scope+(!admin&&!S.writable(D(),a)?'<div class="readonly-banner">Read-only subscription · existing records remain available.</div>':'')+'</header><main class="flow-main '+(admin?'platform-main':'page')+'">'+html+'<p class="demo-banner">Offline sample workspace · 3 Oct 2026 · v2.3</p></main></div><nav class="bottom-nav '+(admin?'platform-bottom':'')+'" aria-label="Main navigation">'+navButtons(navItems)+'</nav>';
  }

  function quickMenu(search=false) {
    const admin=P.isAdmin();let items=menuItems(admin);
    if(!search){items=admin?S.platformOwner(A())?[['Create offer','saas-offer-new','star'],['Create campaign','saas-campaign-new','leads']]:[]:[...(B.can(A(),'peopleEdit')?[['Add employee','employee-new','team']]:[]),...(E.canTasks(D(),A())&&!employee()?[['Assign task','task-new','tasks'],['Add lead','lead-new','leads']]:[]),['My attendance','attendance','attendance']];}
    H.modal(search?'Find a module':'Quick actions',(search?'<label class="flow-search mb">'+icon('search')+'<input type="search" data-flow-menu-search="true" aria-label="Find a module" placeholder="Search a module"></label>':'')+'<div class="flow-menu-results">'+items.map(([label,target,symbol])=>'<button class="flow-tile" data-flow-label="'+esc(label.toLowerCase())+'" data-act="'+(target.startsWith('saas-')?target:'nav')+'" data-target="'+target+'"><span class="flow-tile-icon">'+icon(symbol)+'</span><strong>'+label+'</strong>'+icon('chevron')+'</button>').join('')+'</div>');
  }
  function allowed(target,h) {
    use(h);if(P.isAdmin())return null;const [r,id]=target.split('/');
    if(r==='employee-login')return !A();
    if(!A())return null;
    if(['my-tasks','my-task','task-edit'].includes(r))return E.canTasks(D(),A()) && (r!=='task-edit'||!employee()&&S.writable(D(),A())) && (!id||E.tasks(D(),A()).some(t=>t.id===id));
    if(employee()&&['tasks','task'].includes(r))return E.canTasks(D(),A())&&(!id||E.tasks(D(),A()).some(t=>t.id===id));
    if(employee()&&['subscription','pricing','customer-help','customer-ticket','notifications'].includes(r))return false;
    return null;
  }
  async function action(action,id,el,h) {
    use(h);
    if(employee()&&['switch-role','role-context','portal-switch-business','reset-demo','login'].includes(action)){H.toast('Sign out to use a different account.');return true;}
    if(action==='login'){
      const a=D().accounts.find(a=>a.id===id);
      if(a&&!a.seedDemo){H.toast('Use your email and password to sign in.');return true;}
    }
    if(action==='portal-login-mode'){
      if(P.isAdmin())return false;
      D().settings.portalLoginMode=id==='employee'?'employee':'staff';D().settings.employeeLoginEmail='';H.save();H.go(id==='employee'?'employee-login':'login');return true;
    }
    if(!action.startsWith('flow-'))return false;
    try{
      if(!A()&&action!=='flow-employee-signin')throw Error('Sign in to continue.');
      switch(action){
        case 'flow-search':quickMenu(true);break;
        case 'flow-quick-add':quickMenu();break;
        case 'flow-filter':filter=id;page=0;H.render();break;
        case 'flow-page':page=Math.max(0,page+Number(id));H.render();document.querySelector('.flow-filterbar')?.scrollIntoView({block:'start'});break;
        case 'flow-wizard-prev':captureWizard(document.querySelector('#flow-employee-form'));wizard.step=Math.max(0,wizard.step-1);persistWizard();H.render();window.scrollTo(0,0);break;
        case 'flow-access':accessModal(id);break;
        case 'flow-employee-signin':{
          const a=D().accounts.find(a=>a.id===id&&a.role==='Employee');if(!a)throw Error('Employee login unavailable.');
          D().settings.portalLoginMode='employee';D().settings.demoTenant=a.tenantId;D().settings.employeeLoginEmail=a.email;H.leaveSession();H.go('employee-login',true);break;
        }
        default:return false;
      }
    }catch(error){H.toast(error.message);}return true;
  }
  async function submit(form,v,h) {
    use(h);if(!form.id.startsWith('flow-'))return false;
    try{
      if(!A()||P.isAdmin())throw Error('Business or employee access required.');
      if(form.dataset.context&&form.dataset.context!==[A().id,C().id,D().settings.branch].join('|'))throw Error('Your branch changed. Reopen this form.');
      if(form.id==='flow-employee-form'){
        captureWizard(form);
        if(wizard.step===1)E.validateEmployee(D(),A(),wizard.values,wizard.id);
        if(wizard.step<2){wizard.step++;persistWizard();H.render();window.scrollTo(0,0);return true;}
        const data=E.saveEmployee(D(),A(),wizard.values,wizard.id),password=wizard.values.password,newRecord=!wizard.id;
        H.audit(newRecord?'Employee created':'Employee updated',data.employee.name+' · '+data.employee.branch);clearWizard();H.save();H.go('employee/'+data.employee.id,true);
        if(data.createdLogin){pendingLogin=data.account.id;H.modal('Employee and login ready','<div class="flow-success">'+icon('check')+'<h3>'+esc(data.employee.name)+' is ready to start</h3></div>'+detail([['Business',S.tenant(D(),A()).name],['Employee login',data.account.email],['Demo password',password]])+'<p class="small muted mb">Share these details manually. No email has been sent. The login is saved in this app on this device.</p>'+btn('Open employee sign in','flow-employee-signin',data.account.id,'full')+btn('Continue managing employees','close-modal','','full secondary mt'));}
        else H.toast('Employee details saved.');
      }else if(form.id==='flow-access-form'){
        const result=E.setAccess(D(),A(),form.dataset.record,{...v,loginEnabled:form.elements.loginEnabled.checked,taskAccess:form.elements.taskAccess.checked});
        H.audit('Employee access updated',result.employee.name);H.save();H.closeModal();H.render();H.toast(result.account?.active?'Employee login enabled.':'Employee login disabled.');
      }else if(form.id==='flow-task-form'){
        const task=E.assignTask(D(),A(),v,form.dataset.record||'');H.audit('Task assigned',task.title+' → '+task.owner);H.save();H.go('task/'+task.id,true);H.toast('Task assigned to '+task.owner+'.');
      }else if(form.id==='flow-task-update'){
        const task=E.updateTask(D(),A(),form.dataset.record,v);H.audit('Task progress updated',task.title+' · '+task.status);H.save();H.render();H.toast('Task progress saved.');
      }else return false;
    }catch(error){H.formError(form,error.message);}return true;
  }
  function input(el,h) {
    use(h);
    if(el.dataset.flowSearch){query=el.value;page=0;clearTimeout(searchTimer);const key=listContext;searchTimer=setTimeout(()=>{const out=document.querySelector('#flow-results');if(out&&key===listContext)out.innerHTML=H.route()==='team'?employeeRows():taskRows();},120);return true;}
    if(el.dataset.flowMenuSearch){document.querySelectorAll('[data-flow-label]').forEach(row=>row.hidden=!row.dataset.flowLabel.includes(el.value.trim().toLowerCase()));return true;}
    if(el.closest('#flow-employee-form')){captureWizard(el.closest('form'));clearTimeout(draftTimer);draftTimer=setTimeout(persistWizard,200);return true;}
    return false;
  }
  function change(el,h) {
    use(h);if(el.dataset.portalTenant){D().settings.employeeLoginEmail='';return false;}
    if(el.closest('#flow-employee-form')){captureWizard(el.closest('form'));persistWizard();return true;}
    if(el.closest('#flow-task-form')&&el.name==='branch'){
      const form=el.closest('form'), people=B.records(D(),A(),'employees').filter(e=>e.status==='Active'&&e.branch===el.value), leads=B.records(D(),A(),'leads').filter(l=>l.branch===el.value);
      form.elements.assignedEmployeeId.innerHTML=people.map(e=>'<option value="'+e.id+'">'+esc(e.name)+' · '+e.id+'</option>').join('');
      form.elements.relatedId.innerHTML='<option value="">No linked lead</option>'+leads.map(l=>'<option value="'+l.id+'">'+esc(l.organization)+'</option>').join('');return true;
    }
    return false;
  }
  function flushDraft(){if(wizard){captureWizard(document.querySelector('#flow-employee-form'));persistWizard();}}
  root.WorkspaceUI={screen,shell,allowed,action,submit,input,change,flushDraft};
  let pdfPromise;
  root.loadPdfLibrary=function(){
    if(root.PDFLib)return Promise.resolve(root.PDFLib);
    if(!pdfPromise)pdfPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='pdf-lib.min.js';script.onload=()=>resolve(root.PDFLib);script.onerror=()=>{pdfPromise=null;script.remove();reject(Error('Unable to load the bundled PDF module.'));};document.head.append(script);});
    return pdfPromise;
  };
})(typeof window!=='undefined'?window:globalThis);
