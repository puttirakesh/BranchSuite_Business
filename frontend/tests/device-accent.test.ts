import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import ts from 'typescript';

const load = createRequire(import.meta.url);

async function requestedKeys(auth: { loading: boolean; isAuthenticated: boolean }) {
  const keys: string[] = [];
  let effect: (() => void | (() => void)) | undefined;
  const storage = {
    getItem: async (key: string) => { keys.push(key); return null; },
    setItem: async () => undefined,
  };
  const react = {
    createContext: () => ({ Provider: () => null }),
    useCallback: (callback: unknown) => callback,
    useContext: () => null,
    useEffect: (callback: () => void | (() => void)) => { effect = callback; },
    useMemo: (factory: () => unknown) => factory(),
    useState: (initial: unknown) => [initial, () => undefined],
  };
  const source = readFileSync(new URL('../src/shared/theme/DeviceAccentProvider.tsx', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const component: any = {};
  new Function('require', 'exports', output)((name: string) => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return load('react/jsx-runtime');
    if (name === '../../core/admin/storage') return storage;
    if (name === '../../core/auth/AuthProvider') return { useAuth: () => auth };
    throw new Error(`Unexpected dependency: ${name}`);
  }, component);
  component.DeviceAccentProvider({ children: null });
  effect?.();
  await Promise.resolve();
  await Promise.resolve();
  return keys;
}

test('device accent does not request legacy workspace settings before auth is ready', async () => {
  assert.deepEqual(await requestedKeys({ loading: true, isAuthenticated: false }), []);
  assert.deepEqual(await requestedKeys({ loading: false, isAuthenticated: false }), ['branchsuite:workspace-accent:v2']);
  assert.deepEqual(await requestedKeys({ loading: false, isAuthenticated: true }), [
    'branchsuite:workspace-accent:v2',
    'branchsuite:workspace-settings:v1',
  ]);
});
