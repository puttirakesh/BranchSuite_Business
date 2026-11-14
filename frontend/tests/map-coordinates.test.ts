import assert from 'node:assert/strict';
import test from 'node:test';
import { mapTiles, project, unproject } from '../src/core/map-coordinates';

test('map pin projection round-trips valid locations', () => {
  const point = { latitude: 17.385, longitude: 78.4867 };
  const projected = project(point, 12);
  const result = unproject(projected.x, projected.y, 12);
  assert.ok(Math.abs(result.latitude - point.latitude) < 1e-8);
  assert.ok(Math.abs(result.longitude - point.longitude) < 1e-8);
});

test('visible map tiles include a free OSM-based fallback for blocked primary tiles', () => {
  const tiles = mapTiles({ latitude: 20.5937, longitude: 78.9629 }, 5, 320, 320);
  assert.ok(tiles.length > 0);
  assert.ok(tiles.every(tile => tile.uri.startsWith('https://tile.openstreetmap.org/')));
  assert.ok(tiles.every(tile => tile.fallbackUri.startsWith('https://tile.openstreetmap.de/')));
});
