import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import ts from 'typescript';

const load = createRequire(import.meta.url);
const { renderToStaticMarkup } = load('react-dom/server');
function renderShell(platform: string, keyboardVisible: boolean) {
  const flatten = (style: any): any => Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {};
  const dependencies: Record<string, unknown> = {
    react: React, 'react/jsx-runtime': load('react/jsx-runtime'),
    'react-native': { Platform: { OS: platform }, View: ({ style, children }: any) => React.createElement('div', { style: flatten(style) }, children), StyleSheet: { create: (value: unknown) => value } },
    'expo-router': { usePathname: () => '/admin/my-tasks', useRouter: () => ({ replace() {} }) },
    './InputInteractionContext': load('../src/ui/InputInteractionContext'),
    './AdminWorkspaceHeader': { AdminWorkspaceHeader: () => React.createElement('span', null, 'Workspace header') },
    './WorkspaceNavigation': { WorkspaceNavigation: () => null, WorkspaceNavigationDrawer: () => null },
    './workspace-navigation': { getAdminSidebarDestinations: () => [] },
    './useAdminViewport': { useAdminViewport: () => ({ desktop: false, webNavigation: platform === 'web', persistentSidebar: false, sidebarWidth: 0, keyboardVisible, insets: { top: 24, left: 12, right: 8, bottom: 16 } }) },
    '../core/auth/AuthProvider': { useAuth: () => ({ session: null, signOut() {} }) },
    '../core/admin/scope': { useAdminScope: () => null },
    '../shared/theme/colors': { colors: { background: '#f6f8fd', surface: '#fff' } },
  };
  const output = ts.transpileModule(readFileSync(new URL('../src/ui/AdminWebShell.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const component: any = {};
  new Function('require', 'exports', output)((name: string) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, component);
  return renderToStaticMarkup(React.createElement(component.AdminWebShell, null, 'Page content')) as string;
}
test('native admin header respects top and landscape safe areas without hiding page content for the keyboard', () => {
  for (const platform of ['android', 'ios']) {
    const resting = renderShell(platform, false);
    assert.match(resting, /Workspace header/);
    assert.match(resting, /padding-top:24px;padding-left:12px;padding-right:8px/);
    const editing = renderShell(platform, true);
    assert.match(editing, /Workspace header/, 'The header stays mounted so keyboard animation does not reflow the whole form.');
    assert.match(editing, /Page content/);
    assert.match(editing, /padding-top:24px/);
  }
});
test('web retains workspace controls without adding native safe-area padding', () => {
  const html = renderShell('web', true);
  assert.match(html, /Workspace header/);
  assert.doesNotMatch(html, /padding-left:12px/);
});
