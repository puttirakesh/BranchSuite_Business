export type MapPoint = { latitude: number; longitude: number };
export type MapLocation = MapPoint & { address: string };
export const TILE_SIZE = 256;
const MAX_LATITUDE = 85.05112878;

export function project(point: MapPoint, zoom: number) {
  const size = TILE_SIZE * 2 ** zoom;
  const lat = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, point.latitude)) * Math.PI / 180;
  return { x: (point.longitude + 180) / 360 * size, y: (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2 * size };
}
export function unproject(x: number, y: number, zoom: number): MapPoint {
  const size = TILE_SIZE * 2 ** zoom;
  const boundedY = Math.max(0, Math.min(size, y));
  return { longitude: ((x / size * 360) % 360 + 360) % 360 - 180, latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * boundedY / size))) * 180 / Math.PI };
}
export function mapTiles(center: MapPoint, zoom: number, width: number, height: number) {
  const point = project(center, zoom), count = 2 ** zoom;
  const left = point.x - width / 2, top = point.y - height / 2;
  const tiles: { key: string; x: number; y: number; left: number; top: number; uri: string; fallbackUri: string }[] = [];
  for (let x = Math.floor(left / TILE_SIZE); x <= Math.floor((left + width) / TILE_SIZE); x++) {
    for (let y = Math.floor(top / TILE_SIZE); y <= Math.floor((top + height) / TILE_SIZE); y++) {
      if (y < 0 || y >= count) continue;
      const wrappedX = (x % count + count) % count;
      tiles.push({
        key: `${zoom}-${x}-${y}`, x: wrappedX, y, left: x * TILE_SIZE - left, top: y * TILE_SIZE - top,
        uri: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        fallbackUri: `https://tile.openstreetmap.de/${zoom}/${wrappedX}/${y}.png`,
      });
    }
  }
  return tiles;
}
