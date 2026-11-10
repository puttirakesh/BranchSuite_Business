import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createToastStore } from '../src/ui/toast-store';

test('toast feedback replaces old messages, deduplicates and dismisses on time', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const store = createToastStore();
  store.show('Saved.', 'success');
  const first = store.getSnapshot().toast!.id;
  t.mock.timers.tick(1500);
  store.show('Saved.', 'success');
  assert.equal(store.getSnapshot().toast!.id, first);
  t.mock.timers.tick(1500);
  assert.equal(store.getSnapshot().toast!.message, 'Saved.');
  store.show('Could not save.', 'error');
  const errorId = store.getSnapshot().toast!.id;
  store.dismiss(first);
  assert.equal(store.getSnapshot().toast!.id, errorId, 'an old close event cannot dismiss newer feedback');
  t.mock.timers.tick(1999);
  assert.equal(store.getSnapshot().toast!.kind, 'error');
  t.mock.timers.tick(1);
  assert.equal(store.getSnapshot().toast, null);
  store.show('   ');
  assert.equal(store.getSnapshot().toast, null);
});

test('only the top open modal hosts feedback and closing restores the underlying host', () => {
  const store = createToastStore();
  const closeFirst = store.registerHost('first');
  const closeSecond = store.registerHost('second');
  store.show('Check the form.', 'error');
  assert.equal(store.getSnapshot().host, 'second');
  closeFirst();
  assert.equal(store.getSnapshot().host, 'second');
  closeSecond();
  assert.equal(store.getSnapshot().host, 'root');
  assert.equal(store.getSnapshot().toast!.message, 'Check the form.');
  store.dismiss();
});
