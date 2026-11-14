import { BadGatewayException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';

export type LocationChoice = { latitude: number; longitude: number; address: string };
type Feature = { geometry?: { coordinates?: unknown[] }; properties?: Record<string, unknown> };

/** Photon uses GeoJSON [longitude, latitude]. The base URL is configurable for
 * a self-hosted instance; public-demo availability is not guaranteed.
 */
@Injectable()
export class BranchGeocodingService {
  private cache = new Map<string, { until: number; value: LocationChoice[] }>();
  private pending = new Map<string, Promise<LocationChoice[]>>();
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequest = 0;

  private choices(body: { features?: Feature[] }): LocationChoice[] {
    if (!Array.isArray(body?.features)) throw new BadGatewayException('Location search returned an invalid response.');
    return body.features.flatMap(feature => {
      const [longitude, latitude] = feature.geometry?.coordinates ?? [];
      if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
      const p = feature.properties ?? {};
      const street = [p.housenumber, p.street].filter(v => typeof v === 'string').join(' ');
      const parts = [p.name, street, p.district, p.city, p.state, p.postcode, p.country].filter((v): v is string => typeof v === 'string' && !!v.trim());
      return [{ latitude, longitude, address: [...new Set(parts)].join(', ').slice(0, 240) || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` }];
    }).slice(0, 5);
  }

  private lookup(path: string, params: Record<string, string>): Promise<LocationChoice[]> {
    const base = process.env.BRANCH_GEOCODER_URL || 'https://photon.komoot.io/';
    const url = new URL(path, base.endsWith('/') ? base : base + '/');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new BadGatewayException('Location search is not configured correctly.');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set('limit', '5'); url.searchParams.set('lang', 'en');
    const key = url.toString(), cached = this.cache.get(key);
    if (cached && cached.until > Date.now()) return Promise.resolve(cached.value);
    const pending = this.pending.get(key);
    if (pending) return pending;
    if (this.pending.size >= 10) throw new HttpException('Location search is busy. Please try again shortly.', HttpStatus.TOO_MANY_REQUESTS);
    const work = this.queue.then(async () => {
      await delay(Math.max(0, 1000 - (Date.now() - this.lastRequest)));
      this.lastRequest = Date.now();
      try {
        const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'BranchSuiteBusiness/0.1 (+https://github.com/puttirakesh/BranchSuite_Business)' }, signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error('Provider unavailable');
        const value = this.choices(await response.json());
        if (this.cache.size >= 300) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, { until: Date.now() + 24 * 60 * 60 * 1000, value });
        return value;
      } catch { throw new BadGatewayException('Location search is unavailable. Try again, or choose the branch pin on the map.'); }
    });
    this.queue = work.catch(() => {});
    this.pending.set(key, work);
    void work.finally(() => this.pending.delete(key)).catch(() => {});
    return work;
  }
  search(query: string) { return this.lookup('api/', { q: query.trim() }); }
  async reverse(latitude: number, longitude: number): Promise<LocationChoice> {
    const choices = await this.lookup('reverse', { lat: String(latitude), lon: String(longitude) });
    // Reverse lookup describes nearby OSM data; never replace the chosen pin
    // with the provider's (potentially different) feature coordinates.
    return { latitude, longitude, address: choices[0]?.address ?? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` };
  }
}
