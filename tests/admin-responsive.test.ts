/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { adminGrid, adminPageSpacing } from '../src/ui/adminResponsive';

test('common phones keep two overview cards with normal and moderately enlarged text', () => {
  for (const width of [320, 360, 375, 390, 412, 430]) {
    const content = width - adminPageSpacing(width) * 2;
    for (const scale of [1, 1.15, 1.3]) assert.equal(adminGrid(content, scale, 'overview').columns, 2, `${width}px, font scale ${scale}`);
  }
});

test('very narrow screens and large accessibility text have a single-column fallback', () => {
  assert.equal(adminGrid(256, 1, 'overview').columns, 1);
  assert.equal(adminGrid(328, 2, 'overview').columns, 1);
  assert.equal(adminGrid(328, 2, 'workspace').columns, 1);
  assert.equal(adminGrid(720, 2, 'records').columns, 1);
});

test('record grids use tablet and desktop space without exceeding the content area', () => {
  assert.equal(adminGrid(592).columns, 2);
  assert.equal(adminGrid(976).columns, 3);
  for (const width of [0, 200, 288, 328, 552, 592, 720, 976, 1216]) {
    for (const scale of [1, 1.3, 1.5, 2]) {
      for (const kind of ['overview', 'workspace', 'records'] as const) {
        const { columns, cardWidth } = adminGrid(width, scale, kind);
        assert.ok(Number.isFinite(cardWidth) && cardWidth >= 0);
        assert.ok(Math.abs(columns * cardWidth + (columns - 1) * 12 - width) < 0.001);
        if (kind === 'records' && columns > 1) assert.ok(cardWidth >= 280 * scale);
      }
    }
  }
});
