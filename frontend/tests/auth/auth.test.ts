import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { reference } = createRequire(import.meta.url)('../reference.cjs');
test('only enabled platform accounts with the demo password can enter Admin mode', () => {
  const { db, EmployeeModel } = reference();
  assert.equal(EmployeeModel.authenticate(db, ' PLATFORM@demo.example ', 'Demo123').role, 'Platform Admin');
  assert.throws(() => EmployeeModel.authenticate(db, 'platform@demo.example', 'wrong'));
  assert.throws(() => EmployeeModel.authenticate(db, 'admin@demo.example', 'Demo123'));
  db.accounts.find((a: { id: string }) => a.id === 'platform-admin').active = false;
  assert.throws(() => EmployeeModel.authenticate(db, 'platform@demo.example', 'Demo123'));
});
