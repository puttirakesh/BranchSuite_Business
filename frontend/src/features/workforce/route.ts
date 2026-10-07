import { resources } from './resources';
import { Resource } from './types';
export function resourceParam(value: string | string[] | undefined): Resource | null {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(resources, value) ? value as Resource : null;
}
export function idParam(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
