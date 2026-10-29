import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { reference } = createRequire(import.meta.url)('../reference.cjs');
test('support can reply to tickets but cannot change plans or subscription configuration', () => {
  const { db, SaaSModel } = reference();
  const support = db.accounts.find((a: { id: string }) => a.id === 'platform-support');
  assert.throws(() => SaaSModel.editPlan(db, support, 'growth', {}));
  assert.throws(() => SaaSModel.saveSettings(db, support, { brand: 'Other', supportEmail: 'a@b.example' }));
  SaaSModel.replyTicket(db, support, 'BS-TK-101', { message: 'Private investigation', internal: true, status: 'In progress' });
  assert.equal(db.saasTickets[0].messages.at(-1).internal, true);
});
