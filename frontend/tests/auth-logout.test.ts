import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import axios from 'axios';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function fixture() {
  const effects: (() => (() => void) | void)[] = [];
  const states: unknown[] = [];
  const restore = deferred<unknown>();
  const started = deferred<void>();
  const logout = deferred<void>();
  const api = { defaults: { headers: { common: { Authorization: 'Bearer saved-token' as string | undefined } } } };
  let restoreSignal: AbortSignal | undefined;
  let revoked: unknown;
  let stored: string | null = 'saved-token';
  let context: any;
  const deps: Record<string, unknown> = {
    react: { createContext: () => ({ Provider: 'provider' }), useCallback: (fn: unknown) => fn,
      useEffect: (fn: () => void) => effects.push(fn), useRef: (value: unknown) => ({ current: value }),
      useState: (value: unknown) => { const index = states.push(value) - 1; return [value, (next: unknown) => { states[index] = next; }]; } },
    'react/jsx-runtime': { jsx: (_: unknown, props: any) => { context = props.value; return null; } },
    'react-native': { Platform: { OS: 'android' } },
    'expo-secure-store': { getItemAsync: async () => stored, deleteItemAsync: async () => { stored = null; }, setItemAsync: async (_: string, value: string) => { stored = value; } },
    axios,
    '../api/client': { api, setAccessToken: (value: string | null) => { api.defaults.headers.common.Authorization = value ? `Bearer ${value}` : undefined; },
      getSessionApi: (signal: AbortSignal) => { restoreSignal = signal; started.resolve(); return restore.promise; },
      logoutApi: (authorization: string) => { revoked = authorization; assert.equal(api.defaults.headers.common.Authorization, undefined); return logout.promise; },
      subscribeSessionExpiry: () => () => {},
    },
    '../admin/scope': { resetAdminWorkspace: () => { assert.equal(api.defaults.headers.common.Authorization, undefined); } },
    '../../ui/toast-store': { toast: { info: () => {}, error: () => {} } },
  };
  const source = readFileSync(new URL('../src/core/auth/AuthProvider.tsx', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const loaded: any = {};
  new Function('require', 'exports', output)((name: string) => {
    if (!(name in deps)) throw new Error(`Unexpected dependency: ${name}`);
    return deps[name];
  }, loaded);
  loaded.AuthProvider({ children: null });
  effects.forEach(effect => effect());
  return { api, context, restore, started: started.promise, logout, states, signal: () => restoreSignal, revoked: () => revoked, stored: () => stored };
}

test('logout clears local auth before revocation and a pending restore cannot sign the user back in', async () => {
  const f = fixture();
  await f.started; // The saved token has been read and auth/me is now pending.
  assert.equal(f.signal()?.aborted, false);
  const signingOut = f.context.signOut();
  assert.equal(f.api.defaults.headers.common.Authorization, undefined);
  assert.equal(f.stored(), null);
  assert.equal(f.revoked(), 'Bearer saved-token');
  assert.equal(f.signal()?.aborted, true);
  assert.equal(f.states[0], null);
  f.restore.resolve({ user: { id: 'old-user' }, memberships: [{ branches: [{ id: 'branch' }] }] });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.states[0], null);
  f.logout.resolve(); await signingOut;
  assert.equal(f.states[0], null);
});
