import assert from 'node:assert/strict';
import test from 'node:test';
import { branchFormValues, emptyBranch } from '../src/core/admin/branch-form';

const valid = { ...emptyBranch, name: ' Guntur ', code: ' gnt ', location: ' Andhra Pradesh ' };
test('branch form normalizes the existing API payload without inventing shift values', () => {
  assert.deepEqual(branchFormValues({ ...valid, code: '' }, []), { name: 'Guntur', location: 'Andhra Pradesh', latitude: null, longitude: null, managerUserId: null, shiftStart: null, shiftEnd: null, graceMinutes: 0 });
});
test('branch form preserves required validation and duplicate checks', () => {
  for (const changes of [{ name: '' }, { shiftEnd: '18:00' }, { shiftStart: '25:00' }, { graceMinutes: '-1' }, { graceMinutes: '181' }, { graceMinutes: '1.5' }]) {
    assert.throws(() => branchFormValues({ ...valid, ...changes }, []));
  }
  const existing = { ...valid, id: 'existing', name: 'Guntur' };
  assert.throws(() => branchFormValues(valid, [existing]), /already exists/);
  assert.doesNotThrow(() => branchFormValues(existing, [existing]), 'Editing the same branch is allowed.');
});
test('branch form accepts complete map coordinates and rejects an incomplete or invalid pin', () => {
  const mapped = { ...valid, latitude: 17.385, longitude: 78.4867 };
  assert.deepEqual(branchFormValues(mapped, []), {
    name: 'Guntur', location: 'Andhra Pradesh', latitude: 17.385, longitude: 78.4867,
    managerUserId: null, shiftStart: null, shiftEnd: null, graceMinutes: 0,
  });
  assert.throws(() => branchFormValues({ ...mapped, longitude: null }, []), /valid branch location/);
  assert.throws(() => branchFormValues({ ...mapped, latitude: 91 }, []), /valid branch location/);
});
test('branch form retains overnight shifts and manager assignment supported by the API', () => {
  const values = branchFormValues({ ...valid, managerUserId: 'manager', shiftStart: '22:00', shiftEnd: '06:00', graceMinutes: '15' }, []);
  assert.equal(values.managerUserId, 'manager');
  assert.equal(values.shiftStart, '22:00');
  assert.equal(values.shiftEnd, '06:00');
  assert.equal(values.graceMinutes, 15);
});
