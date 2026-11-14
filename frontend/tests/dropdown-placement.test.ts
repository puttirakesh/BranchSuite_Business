import assert from 'node:assert/strict';
import test from 'node:test';
import { dropdownPlacement } from '../src/ui/dropdown-placement';

test('menus match narrow input widths, align left and leave an 8px gap below', () => {
  for (const width of [80, 136, 150, 200, 320]) {
    const field = { x: 12, y: 120, width, height: 54 };
    const menu = dropdownPlacement(field, { width: 390, height: 740 });
    assert.equal(menu.width, width);
    assert.equal(menu.left, field.x);
    assert.equal(menu.top, 182);
    assert.equal(menu.bottom, undefined);
  }
});

test('menus stay below lower fields and scroll in remaining space without flipping', () => {
  const menu = dropdownPlacement({ x: 230, y: 620, width: 150, height: 44 }, { width: 390, height: 740 });
  assert.equal(menu.top, 672);
  assert.equal(menu.maxHeight, 60);
  assert.equal(menu.left, 230);
  assert.equal(menu.width, 150);
  assert.equal(menu.bottom, undefined);
});

test('oversized fields remain within viewport margins without a forced minimum height', () => {
  const menu = dropdownPlacement({ x: 0, y: 45, width: 400, height: 44 }, { width: 180, height: 110 });
  assert.equal(menu.width, 164);
  assert.equal(menu.left, 8);
  assert.equal(menu.top, 97);
  assert.equal(menu.maxHeight, 5);
});

test('a keyboard covering the anchor cannot move the menu over the field', () => {
  const menu = dropdownPlacement({ x: 20, y: 520, width: 136, height: 44 }, { width: 390, height: 360 });
  assert.equal(menu.top, 572);
  assert.equal(menu.width, 136);
  assert.equal(menu.maxHeight, 0);
  assert.equal(menu.bottom, undefined);
});
