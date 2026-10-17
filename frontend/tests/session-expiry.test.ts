/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError } from 'axios';
import { api, setAccessToken, subscribeSessionExpiry } from '../src/core/api/client';

test('expired requests notify the session provider while stale logins and forbidden actions do not', async () => {
  const adapter = api.defaults.adapter;
  let calls = 0;
  const unsubscribe = subscribeSessionExpiry(() => { calls++; });
  try {
    setAccessToken('current-token');
    let status = 401;
    api.defaults.adapter = async config => { throw new AxiosError('Denied', undefined, config, undefined, { data: {}, status, statusText: 'Denied', headers: {}, config }); };
    await assert.rejects(api.get('/tasks')); assert.equal(calls, 1);
    await assert.rejects(api.get('/tasks', { headers: { Authorization: 'Bearer old-token' } })); assert.equal(calls, 1);
    status = 403;
    await assert.rejects(api.get('/tasks')); assert.equal(calls, 1);
  } finally { unsubscribe(); api.defaults.adapter = adapter; setAccessToken(null); }
});
