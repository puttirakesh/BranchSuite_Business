import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { api, configureSession, scopeHeaders } from '../src/services/api';
import { deleteRecord, getRecord, getRecords, saveRecord } from '../src/services/business';
import { InputValidationError } from '../src/utils/validation';

const scope = { tenantId: 'tenant-a', companyId: 'company-a', branchId: 'branch-a', membershipId: 'member-a' };
api.defaults.baseURL = 'https://example.invalid/api/v1';
test('requests carry the token and all three scope IDs, without posting scope as record data', async () => {
  configureSession('test-token');
  const requests: InternalAxiosRequestConfig[] = [];
  api.defaults.adapter = async (config) => {
    requests.push(config);
    return { data: config.method === 'get' ? { items: [], nextCursor: null } : { id: 'lead-a', name: 'Alice', status: 'NEW', createdAt: '2026-10-07' }, status: 200, statusText: 'OK', headers: {}, config };
  };
  await getRecords(scope, 'leads', 'Alice'); await saveRecord(scope, 'leads', { name: 'Alice', status: 'NEW' });
  for (const request of requests) {
    assert.equal(request.headers.Authorization, 'Bearer test-token');
    for (const [key, value] of Object.entries(scopeHeaders(scope))) assert.equal(request.headers.get(key), value);
  }
  assert.equal(requests[0].params.search, 'Alice');
  assert.deepEqual(JSON.parse(requests[1].data), { name: 'Alice', status: 'NEW' });
});
test('an expired business request clears the session, but a forbidden request does not', async () => {
  let expired = 0; configureSession('test-token', () => expired++);
  let status = 403;
  api.defaults.adapter = async (config) => { throw new AxiosError('Failure', 'ERR_BAD_REQUEST', config, {}, { data: {}, status, statusText: '', headers: new AxiosHeaders(), config }); };
  await assert.rejects(getRecords(scope, 'contacts')); assert.equal(expired, 0);
  status = 401; await assert.rejects(getRecords(scope, 'contacts')); assert.equal(expired, 1);
});
test('invalid form, search, status and ID inputs never reach the HTTP adapter', async () => {
  let requests = 0;
  api.defaults.adapter = async () => { requests++; throw new Error('Must not send invalid input'); };
  await assert.rejects(saveRecord(scope, 'contacts', { name: 'Alice', status: 'ACTIVE', phone: '.......' }), InputValidationError);
  await assert.rejects(saveRecord(scope, 'quotes', { name: 'Quote', status: 'DRAFT', customerId: 'customer-a', items: [{ description: 'Service', quantity: 0, unitPrice: 100 }] }), InputValidationError);
  await assert.rejects(getRecords(scope, 'leads', 'x'.repeat(161)), InputValidationError);
  await assert.rejects(getRecords(scope, 'leads', '', 'ACTIVE'), InputValidationError);
  await assert.rejects(getRecord(scope, 'leads', ' '), InputValidationError);
  await assert.rejects(deleteRecord(scope, 'leads', ''), InputValidationError);
  assert.equal(requests, 0);
});
