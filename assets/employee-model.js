/* Employee self-service for the offline prototype. Server authentication is not implemented. */
(function (root) {
  'use strict';
  const B = root.BranchModel, S = root.SaaSModel;
  const today = () => root.DemoData.DEMO_DATE;
  const uid = prefix => prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const person = (db, a) => db.employees.find(e => e.id === a?.employeeId);
  const loginFor = (db, employeeId) => db.accounts.find(a => a.role === 'Employee' && a.employeeId === employeeId && a.kind !== 'platform');
  const tenantOf = (db, employee) => db.tenants.find(t => t.companyIds.includes(employee?.companyId));
  const enabled = (db, a) => !!a && a.active !== false && (a.role !== 'Employee' || person(db, a)?.status === 'Active');
  function authenticate(db, email, password, mode, tenantId) {
    const a = db.accounts.find(a => a.email.toLowerCase() === String(email).trim().toLowerCase());
    if (!a || !enabled(db, a) || String(password) !== (a.demoPassword || 'Demo123')) throw Error('Check your email and password, or ask your manager to enable your login.');
    if (!root.PortalModel.allowsAccount(a)) throw Error(root.PortalModel.isAdmin() ? 'This is the Admin app. Use a platform admin or support account.' : 'This is the Business app. Use a business or employee account.');
    if (!root.PortalModel.isAdmin()) {
      if (a.tenantId !== tenantId) throw Error('Select the business that owns this login.');
      if ((mode === 'employee') !== (a.role === 'Employee')) throw Error(a.role === 'Employee' ? 'Use Employee sign in for this account.' : 'Use Business sign in for this account.');
    }
    return a;
  }
  function upgrade(db) {
    if (!db.employeeWorkspaceVersion) {
      db.accounts.forEach(a => { a.seedDemo = !a.id.startsWith('USER-') && !a.id.startsWith('OWNER-'); });
      db.accounts.filter(a => a.role === 'Employee').forEach(a => { if (a.taskAccess === undefined) a.taskAccess = true; });
      db.tasks.forEach(t => {
        if (t.assignedEmployeeId) return;
        const candidates = db.employees.filter(e => e.companyId === t.companyId && e.branch === t.branch && e.name === t.owner);
        if (candidates.length === 1) t.assignedEmployeeId = candidates[0].id;
        t.priority = t.priority || 'Normal';
        t.updates = t.updates || [];
      });
      for (const a of db.accounts.filter(a => a.role === 'Employee' && a.seedDemo)) {
        const e = person(db, a);
        if (!e) continue;
        const lead = db.leads.find(l => l.companyId === e.companyId && l.branch === e.branch);
        const names = ['Confirm customer requirements', 'Prepare your weekly work update', 'Complete onboarding checklist'];
        names.forEach((title, i) => db.tasks.push({
          id: 'SELF-' + a.id + '-' + i, companyId: e.companyId, branch: e.branch,
          assignedEmployeeId: e.id, owner: e.name, title, type: i === 0 ? 'Call' : 'Task',
          date: i === 1 ? '2026-10-04' : today(), time: ['11:00', '16:00', '10:00'][i],
          status: i === 2 ? 'Completed' : 'Open', priority: i === 0 ? 'High' : 'Normal',
          relatedId: i === 0 ? lead?.id || '' : '', note: i === 0 ? 'Confirm the requirement and add a short call outcome. Your manager can review your update.' : 'Add your progress here so your manager knows the next step.',
          assignedBy: db.accounts.find(x => x.id === tenantOf(db, e)?.ownerAccountId)?.name || 'Business Admin',
          outcome: i === 2 ? 'Sample onboarding completed.' : '', updates: []
        }));
      }
      db.employeeWorkspaceVersion = 1;
    }
    if (db.session && !enabled(db, db.accounts.find(a => a.id === db.session.accountId))) db.session = null;
    return db;
  }
  function canTasks(db, a) {
    if (!enabled(db, a) || a.kind === 'platform') return false;
    const t = S.tenant(db, a);
    return !!S.plan(db, t?.subscription.planId)?.features.crm && (a.role === 'Employee' ? a.taskAccess !== false : B.can(a, 'crm'));
  }
  function tasks(db, a) {
    if (!canTasks(db, a)) return [];
    if (a.role !== 'Employee') return B.records(db, a, 'tasks');
    const e = person(db, a);
    return db.tasks.filter(t => t.companyId === e.companyId && t.branch === e.branch && t.assignedEmployeeId === e.id);
  }
  function requirePeople(db, a, id) {
    if (!enabled(db, a) || !B.can(a, 'peopleEdit')) throw Error('Employee management access required.');
    S.requireWrite(db, a);
    if (!S.allowPermission(db, a, 'peopleEdit')) throw Error('Employee management is unavailable on this plan.');
    if (id && !B.accessible(db, a, 'employees', id)) throw Error('This employee is outside your branch access.');
  }
  function validateEmployee(db, a, input, id = '') {
    requirePeople(db, a, id);
    const old = db.employees.find(e => e.id === id), companyId = old?.companyId || db.settings.companyId;
    const name = String(input.name || '').trim(), email = String(input.email || '').trim().toLowerCase();
    if (name.length < 2) throw Error('Enter the employee’s full name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Enter a valid work email.');
    if (!B.branches(db, a, companyId).includes(input.branch) || (db.settings.branch !== B.ALL && input.branch !== db.settings.branch)) throw Error('Choose a branch in the current workspace.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.joinDate || '')) throw Error('Choose a joining date.');
    const gross = Number(input.gross), deductions = Number(input.deductions || 0);
    if (!Number.isFinite(gross + deductions) || gross <= 0 || deductions < 0 || deductions >= gross) throw Error('Enter a positive salary and deductions lower than salary.');
    if (gross < (old?.incentive || 0)) throw Error('Salary cannot be below already approved incentives.');
    if (input.bankLast4 && !/^\d{4}$/.test(input.bankLast4)) throw Error('Use four digits for the bank ending, or leave it blank.');
    if (db.employees.some(e => e.id !== id && e.email.toLowerCase() === email)) throw Error('This work email already belongs to an employee.');
    const access = input.loginEnabled === true || input.loginEnabled === 'on', existing = loginFor(db, id);
    if (access || existing) {
      if (db.accounts.some(x => x.id !== existing?.id && x.email.toLowerCase() === email)) throw Error('This email already has another login. Use a separate employee email.');
      if (access && !existing && String(input.password || '').length < 6) throw Error('Use at least 6 characters for the demo password.');
    }
    if (input.status === 'Active' && old?.status !== 'Active') S.quota(db, a, 'employees');
    if (old && old.branch !== input.branch && [old.branch, input.branch].some(b => !['Draft', 'Rejected'].includes(B.branchRun(db, companyId, b)?.status))) throw Error('Both branch payroll runs must be Draft or Returned before a branch transfer.');
    return { old, companyId, name, email, gross, deductions, access, existing };
  }
  function saveEmployee(db, a, input, id = '') {
    const { old, companyId, name, email, gross, deductions, access, existing } = validateEmployee(db, a, input, id);
    const e = old || { id: uid('EMP'), companyId, cl: 6, sl: 4, incentive: 0, bankStatus: 'Needs verification' };
    const grossChanged = !old || old.gross !== gross, deductionsChanged = !old || old.deductions !== deductions;
    const changedBranch = old && old.branch !== input.branch, bankChanged = e.bankLast4 !== input.bankLast4;
    if (changedBranch) {
      ['requests', 'issues', 'advances', 'incentives', 'payments', 'attendance'].forEach(key => db[key].filter(r => r.employeeId === e.id && ((key === 'attendance' && r.date === today()) || ['Pending', 'Open', 'Not initiated'].includes(r.status))).forEach(r => r.branch = input.branch));
      db.tasks.filter(t => t.assignedEmployeeId === e.id && t.status !== 'Completed').forEach(t => { t.assignedEmployeeId = ''; t.owner = 'Unassigned'; t.note += '\nEmployee moved branch. Please reassign this activity.'; });
    }
    Object.assign(e, { name, email, gross, deductions, phone: String(input.phone || '').trim(), department: input.department || 'Operations', designation: String(input.designation || '').trim(), branch: input.branch, manager: input.manager || a.name, joinDate: input.joinDate, status: input.status === 'Inactive' ? 'Inactive' : 'Active', bankLast4: input.bankLast4 || '' });
    const base = gross - (e.incentive || 0);
    if (grossChanged) { e.basic = Math.floor(base * .54); e.hra = Math.floor(base * .27); e.allowance = base - e.basic - e.hra; }
    if (deductionsChanged) { e.retirement = Math.min(1800, deductions); e.tax = deductions - e.retirement; }
    if (!old) db.employees.push(e);
    if (bankChanged || !e.bankLast4) {
      e.bankStatus = 'Needs verification';
      if (!db.issues.some(i => i.employeeId === e.id && i.type === 'Bank details' && i.status === 'Open')) db.issues.push({ id: uid('ISS'), companyId, branch: e.branch, employeeId: e.id, type: 'Bank details', description: 'Check employee bank details before payroll.', status: 'Open' });
    }
    let account = existing;
    if (access && !account) {
      account = { id: uid('USER'), kind: 'customer', tenantId: tenantOf(db, e).id, role: 'Employee', employeeId: e.id, seedDemo: false, demoPassword: input.password };
      db.accounts.push(account);
    }
    if (account) Object.assign(account, { name, email, active: access && e.status === 'Active', loginEnabled: access, taskAccess: input.taskAccess === true || input.taskAccess === 'on', grants: { [companyId]: [e.branch] }, subtitle: 'Employee · ' + e.branch });
    S.audit(db, a, old ? 'Employee updated' : 'Employee created', e.name + ' · ' + e.branch + (account ? ' · employee login linked' : ''));
    return { employee: e, account, createdLogin: access && !existing };
  }
  function setAccess(db, a, employeeId, input) {
    requirePeople(db, a, employeeId);
    const e = db.employees.find(e => e.id === employeeId), existing = loginFor(db, e.id);
    const email = String(input.email || '').trim().toLowerCase(), password = String(input.password || '');
    const access = input.loginEnabled === true || input.loginEnabled === 'on';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Enter a valid login email.');
    if (db.accounts.some(x => x.id !== existing?.id && x.email.toLowerCase() === email) || db.employees.some(x => x.id !== e.id && x.email.toLowerCase() === email)) throw Error('This email belongs to another employee or login.');
    if ((password && password.length < 6) || (access && !existing && password.length < 6)) throw Error('Use at least 6 characters for the demo password.');
    let account = existing;
    if (access && !account) {
      account = { id: uid('USER'), kind: 'customer', tenantId: tenantOf(db, e).id, role: 'Employee', employeeId: e.id, seedDemo: false };
      db.accounts.push(account);
    }
    if (account) {
      Object.assign(account, { name: e.name, email, active: access && e.status === 'Active', loginEnabled: access, taskAccess: input.taskAccess === true || input.taskAccess === 'on', grants: { [e.companyId]: [e.branch] }, subtitle: 'Employee · ' + e.branch });
      if (password) account.demoPassword = password;
    }
    S.audit(db, a, 'Employee access updated', e.name + ' · ' + (account?.active ? 'Enabled' : 'Disabled'));
    return { employee: e, account, createdLogin: access && !existing };
  }
  function assignTask(db, a, input, id = '') {
    if (!enabled(db, a) || a.role === 'Employee' || !canTasks(db, a)) throw Error('Task management access required.');
    S.requireWrite(db, a);
    const old = id ? tasks(db, a).find(t => t.id === id) : null;
    if (id && !old) throw Error('This task is outside your branch access.');
    const e = B.records(db, a, 'employees').find(e => e.id === input.assignedEmployeeId && e.status === 'Active');
    if (!e) throw Error('Choose an active employee in this branch.');
    if (input.branch !== e.branch) throw Error('Employee and task must belong to the same branch.');
    if (input.relatedId && !B.records(db, a, 'leads').some(l => l.id === input.relatedId && l.branch === e.branch)) throw Error('Choose a related lead in the task’s branch.');
    if (!String(input.title || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') || !/^\d{2}:\d{2}$/.test(input.time || '')) throw Error('Add a title, due date and time.');
    const t = old || { id: uid('TASK'), companyId: db.settings.companyId, status: 'Open', updates: [], assignedBy: a.name };
    Object.assign(t, { title: String(input.title).trim(), type: ['Task', 'Call', 'Meeting'].includes(input.type) ? input.type : 'Task', branch: e.branch, assignedEmployeeId: e.id, owner: e.name, date: input.date, time: input.time, priority: input.priority === 'High' ? 'High' : 'Normal', relatedId: input.relatedId || '', note: String(input.note || '').trim() });
    if (!old) db.tasks.push(t);
    S.audit(db, a, old ? 'Task reassigned or updated' : 'Task assigned', t.title + ' → ' + e.name);
    return t;
  }
  function updateTask(db, a, id, input) {
    S.requireWrite(db, a);
    const t = tasks(db, a).find(t => t.id === id);
    if (!t) throw Error('This task is not assigned to you or is outside your branch.');
    if (!['Open', 'In progress', 'Completed'].includes(input.status)) throw Error('Choose a valid task status.');
    const note = String(input.note || '').trim();
    if (input.status === 'Completed' && !note) throw Error('Add a short completion note so your manager can review the outcome.');
    t.status = input.status;
    if (input.status === 'Completed') t.outcome = note;
    t.updates = t.updates || [];
    t.updates.unshift({ by: a.name, employeeId: a.employeeId, status: input.status, note, date: today() });
    S.audit(db, a, 'Task progress updated', t.title + ' · ' + input.status);
    return t;
  }
  function payslips(db, a) {
    const e = person(db, a);
    if (!e) return [];
    const sept = db.payHistory?.September_2026?.find(x => x.id === e.id);
    const run = B.branchRun(db, e.companyId, e.branch), oct = run?.published && run.snapshot?.find(x => x.id === e.id);
    const pay = db.payments.find(p => p.employeeId === e.id && p.companyId === e.companyId);
    return [...(oct ? [{ key: 'oct', label: 'October 2026', row: oct, status: pay?.status === 'Confirmed' ? 'Paid' : 'Published' }] : []), ...(sept ? [{ key: 'sep', label: 'September 2026', row: sept, status: 'Paid' }] : [])];
  }
  root.EmployeeModel = { upgrade, person, loginFor, tenantOf, enabled, authenticate, canTasks, tasks, validateEmployee, saveEmployee, setAccess, assignTask, updateTask, payslips };
})(typeof window !== 'undefined' ? window : globalThis);
