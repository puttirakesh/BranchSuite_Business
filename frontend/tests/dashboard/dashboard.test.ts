import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { reference } = createRequire(import.meta.url)('../reference.cjs');
test('dashboard metrics reflect subscription and ticket changes', () => {
  const { db, SaaSModel } = reference();
  const owner = db.accounts.find((a: { id: string }) => a.id === 'platform-admin');
  const before = SaaSModel.platformMetrics(db);
  assert.equal(before.customers, 3);
  assert.equal(before.mrr, 3498);
  assert.equal(before.unpaid, 999);
  SaaSModel.replyTicket(db, owner, 'BS-TK-101', { message: 'Resolved', status: 'Resolved' });
  assert.equal(SaaSModel.platformMetrics(db).support, before.support - 1);
});
