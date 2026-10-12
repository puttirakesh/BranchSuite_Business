/// <reference types="node" />
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

const root = path.resolve(__dirname, '..');
const requireRouter = createRequire(path.join(root, 'package.json'));
const { getRoutes } = requireRouter('expo-router/build/getRoutesCore');
const { getReactNavigationConfig } = requireRouter('expo-router/build/getReactNavigationConfig');

type Screen = string | { path: string; screens?: Record<string, Screen> };

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? routeFiles(filename) : /\.[tj]sx?$/.test(entry.name) ? [filename] : [];
  });
}

for (const platform of ['android', 'ios', 'web']) {
  test(`${platform} linking patterns are unique, including legacy teamlead routes`, () => {
    const app = path.join(root, 'app');
    const context = Object.assign(() => ({ default: () => null }), {
      keys: () => routeFiles(app).map(filename => './' + path.relative(app, filename).replaceAll('\\', '/')),
    });
    const config = JSON.parse(readFileSync(path.join(root, 'app.json'), 'utf8'));
    const plugin = config.expo.plugins.find((entry: string | [string, object]) =>
      (Array.isArray(entry) ? entry[0] : entry) === 'expo-router');
    const options = Array.isArray(plugin) ? plugin[1] : {};
    const tree = getRoutes(context, {
      ...options, platform, importMode: 'async', ignoreEntryPoints: true,
      preserveRedirectAndRewrites: true,
      getSystemRoute: ({ defaults, route, type }: { defaults?: object; route: string; type: string }) =>
        defaults || { route, type, contextKey: route, generated: true, internal: true, dynamic: null, children: [], loadRoute: () => ({}) },
    });
    const patterns = new Map<string, string>();
    function check(screens: Record<string, Screen>, prefix = '', parent = '') {
      for (const [name, screen] of Object.entries(screens)) {
        const pattern = [prefix, typeof screen === 'string' ? screen : screen.path].filter(Boolean).join('/');
        const route = [parent, name].filter(Boolean).join(' > ');
        if (typeof screen !== 'string' && Object.keys(screen.screens || {}).length) {
          check(screen.screens!, pattern, route);
        } else {
          assert.equal(patterns.has(pattern), false, `Conflicting pattern ${pattern}: ${patterns.get(pattern)} and ${route}`);
          patterns.set(pattern, route);
        }
      }
    }
    check(getReactNavigationConfig(tree, true).screens);
    assert.ok(patterns.has('admin/teamlead'));
    assert.ok(patterns.has('admin/teamlead/:id'));
    assert.ok(patterns.has('admin/crm/lead-form'));
    assert.ok(patterns.has('admin/crm/lead/:id'));
  });
}
