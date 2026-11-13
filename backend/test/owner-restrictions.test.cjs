require('reflect-metadata');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { AttendanceService } = require('../src/modules/attendance/attendance.service');
const { AttendanceCorrectionsService } = require('../src/modules/attendance/attendance-corrections.service');
const { LeaveService } = require('../src/modules/leave/leave.service');

// The owner guard is the first statement of each method, so no collaborators are needed.
const bare = Service => Object.create(Service.prototype);
const owner = { id: 'owner', tenantId: 'tenant', roles: ['BUSINESS_OWNER'] };
const cases = [
  ['check in', () => bare(AttendanceService).checkIn(owner, {})],
  ['check out', () => bare(AttendanceService).checkOut(owner, {})],
  ['request attendance corrections', () => bare(AttendanceCorrectionsService).create(owner, {})],
  ['apply for leave', () => bare(LeaveService).apply(owner, {})],
];

for (const [action, call] of cases) {
  test(`a business owner cannot ${action} even when the account also has an employee profile`, async () => {
    await assert.rejects(call(), error => error.getStatus() === 403 && error.message.includes(`cannot ${action}`));
  });
}

test('other roles are not stopped by the owner restriction', async () => {
  for (const roles of [['EMPLOYEE'], ['BUSINESS_ADMIN'], ['HR_MANAGER'], ['BRANCH_MANAGER']]) {
    const actor = { id: 'u', tenantId: 'tenant', roles };
    for (const call of [() => bare(AttendanceService).checkIn(actor, {}), () => bare(LeaveService).apply(actor, {})]) {
      await assert.rejects(call(), error => !(error.getStatus?.() === 403 && /Business owners cannot/.test(error.message)));
    }
  }
});
