import { test } from 'node:test';
import assert from 'node:assert/strict';

test('preview providers filter before pagination and isolate changes to the preview store', async () => {
  process.env.EXPO_PUBLIC_API_URL = '';
  process.env.EXPO_PUBLIC_PREVIEW_DATA = 'true';
  const { previewDb, resetPreview } = await import('../src/core/data/previewStore');
  const { customersApi } = await import('../src/features/customers/api/customers.api');
  const { marketingApi } = await import('../src/features/marketing/api/marketing.api');
  const db = previewDb();
  const prospect = db.prospects[0]!;
  db.prospects = Array.from({ length: 45 }, (_, i) => ({ ...prospect, id: String(i), status: i === 44 ? 'Qualified' as const : 'New' as const, followup: i === 44 ? '2026-11-04' : '2026-10-01' }));
  const result = await marketingApi.list({ stage: 'Qualified', from: '2026-11-01', to: '2026-11-30', page: 1, limit: 20 });
  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.id, '44');
  const customer = db.customers[0]!;
  await customersApi.setAccountStatus(customer.id, 'INACTIVE');
  const filtered = await customersApi.list({ status: 'INACTIVE', page: 1, limit: 20 });
  assert.equal(filtered.items[0]?.id, customer.id);
  assert.equal(db.audit.length, 1);
  resetPreview();
  assert.notEqual(previewDb().customers[0]?.accountStatus, 'Inactive');
});
