import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchAll } from '../src/core/admin/http';

test('fetchAll loads pages in order with bounded parallel requests', async () => {
  let active = 0;
  let peak = 0;
  const rows = await fetchAll(async page => {
    if (page === 1) return { data: [page], pagination: { page, limit: 1, total: 7, totalPages: 7 } };
    active += 1;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active -= 1;
    return { items: [page], pagination: { page, limit: 1, total: 7, pages: 7 } };
  });

  assert.deepEqual(rows, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(peak, 4);
});

test('fetchAll respects its page cap and propagates page failures', async () => {
  const requested: number[] = [];
  const rows = await fetchAll(async page => {
    requested.push(page);
    return { data: [page], pagination: { page, limit: 1, total: 5, totalPages: 5 } };
  }, 3);

  assert.deepEqual(rows, [1, 2, 3]);
  assert.deepEqual(requested, [1, 2, 3]);
  await assert.rejects(
    fetchAll(async page => {
      if (page === 2) throw new Error('page failed');
      return { data: [page], pagination: { page, limit: 1, total: 2, totalPages: 2 } };
    }),
    /page failed/,
  );
});
