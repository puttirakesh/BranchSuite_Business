/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import ts from 'typescript';
import { validateManualRequest } from '../src/shared/validation/request';

function fixture() {
  const logs: unknown[][] = [];
  const source = readFileSync(new URL('../src/core/api/client.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const module: {
    api?: AxiosInstance;
    setAccessToken?: (token: string | null) => void;
    subscribeSessionExpiry?: (listener: () => void) => () => void;
  } = {};
  new Function('require', 'exports', '__DEV__', 'process', 'console', output)(
    (name: string) => {
      if (name === 'axios') return axios;
      if (name === '../../shared/validation/request') return { validateManualRequest };
      throw new Error(`Unexpected dependency: ${name}`);
    }, module, true, { env: { EXPO_PUBLIC_API_URL: 'http://backend.test/api/v1' } },
    { log() {}, error: (...args: unknown[]) => logs.push(args) },
  );
  return { api: module.api!, setAccessToken: module.setAccessToken!, subscribeSessionExpiry: module.subscribeSessionExpiry!, logs };
}

function denied(config: InternalAxiosRequestConfig, status = 401) {
  return new AxiosError('Denied', 'ERR_BAD_REQUEST', config, undefined, {
    data: {}, status, statusText: 'Denied', headers: {}, config,
  });
}

test('a rejected saved session clears its token once without an Expo error log', async () => {
  const { api, setAccessToken, subscribeSessionExpiry, logs } = fixture();
  let calls = 0;
  subscribeSessionExpiry(() => {
    calls++;
    assert.equal(api.defaults.headers.common.Authorization, undefined);
  });
  setAccessToken('saved-token');
  api.defaults.adapter = async config => { throw denied(config); };
  const results = await Promise.allSettled([api.get('/auth/me'), api.get('/tasks')]);
  for (const result of results) {
    assert.equal(result.status, 'rejected');
    if (result.status === 'rejected') assert.equal(result.reason.response.status, 401);
  }
  assert.equal(calls, 1);
  assert.equal(api.defaults.headers.common.Authorization, undefined);
  assert.deepEqual(logs, []);
});

test('a delayed 401 from an older login does not revoke the new session', async () => {
  const { api, setAccessToken, subscribeSessionExpiry } = fixture();
  let calls = 0;
  subscribeSessionExpiry(() => { calls++; });
  setAccessToken('new-token');
  api.defaults.adapter = async config => { throw denied(config); };
  await assert.rejects(api.get('/auth/me', { headers: { Authorization: 'Bearer old-token' } }), AxiosError);
  assert.equal(calls, 0);
  assert.equal(api.defaults.headers.common.Authorization, 'Bearer new-token');
});

test('incorrect login credentials do not expire an existing session or trigger an error overlay', async () => {
  const { api, setAccessToken, subscribeSessionExpiry, logs } = fixture();
  let calls = 0;
  subscribeSessionExpiry(() => { calls++; });
  setAccessToken('current-token');
  api.defaults.adapter = async config => { throw denied(config); };
  await assert.rejects(api.post('/auth/login', { email: 'person@example.com', password: 'incorrect-password', portal: 'staff' }), AxiosError);
  assert.equal(calls, 0);
  assert.equal(api.defaults.headers.common.Authorization, 'Bearer current-token');
  assert.deepEqual(logs, []);
});

test('forbidden actions retain the session and genuine API failures retain safe diagnostics', async () => {
  const { api, setAccessToken, subscribeSessionExpiry, logs } = fixture();
  let calls = 0;
  subscribeSessionExpiry(() => { calls++; });
  setAccessToken('private-token');
  api.defaults.adapter = async config => { throw denied(config, 403); };
  await assert.rejects(api.get('/tasks'), AxiosError);
  assert.equal(calls, 0);
  assert.equal(api.defaults.headers.common.Authorization, 'Bearer private-token');
  assert.equal(logs.length, 1);
  assert.doesNotMatch(JSON.stringify(logs), /private-token|Authorization/);
  assert.match(JSON.stringify(logs), /403/);
});
