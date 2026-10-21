import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateAccessUser } from '../src/ui/access-user-validation';
import type { AccessRole, AccessUser } from '../src/core/admin/organisation';

const roles: AccessRole[] = ['Employee', 'HR Manager'];
const draft: AccessUser = { id: '', name: 'New teammate', email: 'new@example.com', role: 'Employee', branches: ['north'], active: true };

test('user creation validates names, email, role and required branch access independently', () => {
  const errors = validateAccessUser({ ...draft, name: ' ', email: 'not-an-email', role: 'Business Admin', branches: [] }, [], roles, ['north']);
  assert.deepEqual(Object.keys(errors).sort(), ['branches', 'email', 'name', 'role']);
  assert.deepEqual(validateAccessUser(draft, [], roles, ['north']), {});
  assert.ok(validateAccessUser({ ...draft, name: 'x'.repeat(151) }, [], roles, ['north']).name);
  assert.ok(validateAccessUser({ ...draft, branches: ['unavailable'] }, [], roles, ['north']).branches);
});

test('email checks ignore case and surrounding spaces while allowing the same user to keep their email', () => {
  const existing = [{ id: 'existing', email: 'NEW@example.com' }];
  assert.match(validateAccessUser({ ...draft, email: ' new@example.com ' }, existing, roles, ['north']).email ?? '', /already exists/);
  assert.deepEqual(validateAccessUser({ ...draft, id: 'existing' }, existing, roles, ['north']), {});
});

test('editing can revoke all branches or preserve a previous assignment', () => {
  assert.deepEqual(validateAccessUser({ ...draft, id: 'existing', branches: [] }, [], roles, ['north']), {});
  assert.deepEqual(validateAccessUser({ ...draft, id: 'existing', branches: ['previous'] }, [], roles, ['north']), {});
});
