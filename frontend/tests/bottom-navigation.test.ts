import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import React from 'react';
import ts from 'typescript';
import * as roleCapabilities from '../src/core/admin/role-capabilities';

const load = createRequire(import.meta.url);
const { renderToStaticMarkup } = load('react-dom/server') as { renderToStaticMarkup: (node: React.ReactNode) => string };

function renderNavigation(keyboardVisible: boolean, webNavigation = false, persistent = false) {
  const flatten = (style: any): any => typeof style === 'function' ? flatten(style({ pressed: false })) : Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style || {};
  const container = ({ children, accessibilityLabel, style }: any) => React.createElement('div', { 'aria-label': accessibilityLabel, style: flatten(style) }, children);
  const dependencies: Record<string, unknown> = {
    react: React,
    'react/jsx-runtime': load('react/jsx-runtime'),
    'react-native': { Platform: { OS: 'web' }, Pressable: container, Text: container, View: container, StyleSheet: { create: (styles: unknown) => styles } },
    'react-native-safe-area-context': { SafeAreaView: container },
    'expo-router': { useFocusEffect() {}, useGlobalSearchParams: () => ({}), usePathname: () => '/admin/employees/create', useRouter: () => ({ navigate() {} }) },
    './AppIcon': { AppIcon: () => null },
    './useAdminViewport': { useAdminViewport: () => ({ keyboardVisible, webNavigation, fontScale: 1 }) },
    '../core/auth/AuthProvider': { useAuth: () => ({ session: { memberships: [{ companyId: 'company', role: 'BUSINESS_OWNER' }] } }) },
    '../core/admin/role-capabilities': roleCapabilities,
    '../core/admin/scope': { useAdminScope: () => ({ companyId: 'company' }) },
    '../core/admin/access': { canOpenAdminPath: () => true },
    '../shared/theme/colors': { colors: { primary: '#3157D5', primaryLight: '#E5ECFF', background: '#EDF2FA', surface: '#FFFFFF', muted: '#586D8B', border: '#D6E0EF' } },
  };
  const source = readFileSync(new URL('../src/ui/AdminBottomNavigation.tsx', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const component: any = {};
  new Function('require', 'exports', output)((name: string) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, component);
  const content = persistent
    ? React.createElement(component.AdminBottomNavigationProvider, null,
      React.createElement(component.AdminBottomNavigation),
      React.createElement(component.AdminBottomNavigation))
    : React.createElement(component.AdminBottomNavigation);
  return renderToStaticMarkup(content);
}

test('mobile bottom navigation stays mounted throughout keyboard opening and dismissal', () => {
  const closed = renderNavigation(false);
  assert.match(closed, /Admin bottom navigation/);
  assert.match(closed, /People/);
  const editing = renderNavigation(true);
  assert.match(editing, /Admin bottom navigation/);
  assert.match(editing, /display:none/);
  assert.doesNotMatch(closed, /display:none/);
  assert.equal(renderNavigation(false), closed);
});

test('web layouts with sidebar or drawer navigation omit the bottom tabs', () => {
  assert.equal(renderNavigation(false, true), '');
  assert.equal(renderNavigation(true, true), '');
});

test('page-level navigation controls share a single persistent bar', () => {
  const markup = renderNavigation(false, false, true);
  assert.equal((markup.match(/Admin bottom navigation/g) ?? []).length, 1);
  assert.equal((markup.match(/aria-label="People"/g) ?? []).length, 1);
  const editing = renderNavigation(true, false, true);
  assert.equal((editing.match(/Admin bottom navigation/g) ?? []).length, 1);
  assert.match(editing, /display:none/);
  assert.doesNotMatch(renderNavigation(false, true, true), /Admin bottom navigation/);
});
