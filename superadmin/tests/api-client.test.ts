import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { configureHttp, normalizeError } from '../src/core/api/client';

function unauthorized(message: string | undefined, token?: string): AxiosError {
  const headers = new AxiosHeaders();
  if (token) headers.set('Authorization', 'Bearer ' + token);
  const config = { headers } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, {}, {
    status: 401, statusText: 'Unauthorized', headers: {}, config,
    data: message === undefined ? {} : { statusCode: 401, message, error: 'Unauthorized' },
  });
}

test('failed sign-in (401 without a bearer token) shows the credential message and keeps the session state', () => {
  let expired = 0;
  configureHttp({ getToken: () => null, onUnauthorized: () => { expired += 1; } });
  const error = normalizeError(unauthorized('Invalid email or password'), 'POST /platform/auth/login');
  assert.equal(error.kind, 'unauthorized');
  assert.equal(error.message, 'Invalid email or password');
  assert.doesNotMatch(error.message, /session/i);
  assert.equal(expired, 0);
  assert.equal(normalizeError(unauthorized(undefined), 'POST /platform/auth/login').message, 'Email or password is incorrect.');
});

test('401 on a request that carried a bearer token still ends the session', () => {
  let expired = 0;
  configureHttp({ getToken: () => 'x', onUnauthorized: () => { expired += 1; } });
  const error = normalizeError(unauthorized('Unauthorized', 'stale-token'), 'GET /platform/auth/me');
  assert.equal(error.kind, 'unauthorized');
  assert.equal(error.message, 'Your session has ended. Sign in again.');
  assert.equal(expired, 1);
});
