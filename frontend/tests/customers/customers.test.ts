import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { reference } = createRequire(import.meta.url)('../reference.cjs');
test('plans cannot be reduced below customer usage; invalid new plans roll back', () => {
  const { db, SaaSModel } = reference();
  const owner = db.accounts.find((a: { id: string }) => a.id === 'platform-admin');
  const plan = db.plans.find((p: { id: string }) => p.id === 'growth');
  assert.throws(() => SaaSModel.editPlan(db, owner, plan.id, { ...plan, employees: 1 }));
  const count = db.plans.length;
  assert.throws(() => SaaSModel.createPlan(db, owner, { ...plan, monthly: -1 }));
  assert.equal(db.plans.length, count);
  assert.equal(SaaSModel.createPlan(db, owner, { ...plan, name: 'New tier' }).name, 'New tier');
  assert.equal(db.plans.length, count + 1);
});
