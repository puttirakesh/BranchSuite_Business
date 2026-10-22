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


test('revoked responses arriving after logout stay rejected without error logs or expiry notifications', async () => {
  const adapter = api.defaults.adapter;
  const previousDev = (globalThis as any).__DEV__;
  const previousError = console.error;
  const logs: unknown[][] = [];
  let expired = 0;
  const unsubscribe = subscribeSessionExpiry(() => { expired++; });
  try {
    (globalThis as any).__DEV__ = true;
    console.error = (...args) => { logs.push(args); };
    setAccessToken('old-token');
    api.defaults.adapter = async config => {
      setAccessToken(null); // Logout occurs while /auth/me is in flight.
      throw new AxiosError('Unauthorized', undefined, config, undefined, { data: {}, status: 401, statusText: 'Unauthorized', headers: {}, config });
    };
    await assert.rejects(api.get('/auth/me'));
    assert.equal(expired, 0);
    assert.equal(logs.length, 0);
    api.defaults.adapter = async config => { throw new AxiosError('Server error', undefined, config, undefined, { data: {}, status: 500, statusText: 'Error', headers: {}, config }); };
    await assert.rejects(api.get('/auth/me'));
    assert.equal(logs.length, 1); // Real server failures remain visible.
  } finally {
    unsubscribe(); console.error = previousError; (globalThis as any).__DEV__ = previousDev;
    api.defaults.adapter = adapter; setAccessToken(null);
  }
});
