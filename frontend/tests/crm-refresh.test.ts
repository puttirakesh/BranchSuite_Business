import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const screens = ['customers-live', 'deals-live', 'quotes-live'];

for (const name of screens) {
  test(`${name} has no manual Refresh button but offers pull-to-refresh and Retry`, () => {
    const source = readFileSync(new URL(`../app/admin/crm/${name}.tsx`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /onRefresh=\{/, 'AdminPageHeading must not receive onRefresh');
    assert.doesNotMatch(source, /refreshDisabled=/);
    assert.doesNotMatch(source, /<Text>Refresh<\/Text>/);
    assert.match(source, /refreshControl=\{pullToRefresh\(/);
    assert.match(source, /<RetryNotice /);
    assert.match(source, /setReload(Key)?\(/, 'reload counter must remain');
  });
}

test('quotes pull-to-refresh and retry never reset an in-progress edit', () => {
  const source = readFileSync(new URL('../app/admin/crm/quotes-live.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('const reloadQuotes');
  assert.ok(start > 0);
  assert.doesNotMatch(source.slice(start, source.indexOf('\n', start)), /reset\(\)/);
});
