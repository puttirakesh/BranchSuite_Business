import { env } from '../config/env';
import { notConfigured, pendingIntegration } from '../api/api-error';

/**
 * Routes each data operation to the implementation for the current data mode.
 *
 * - api:          calls the shared backend. If `api` is omitted, the endpoint does not
 *                 exist yet and the call fails with a visible "pending integration" error.
 * - preview:      uses the in-memory, non-production sample store (development only).
 * - unconfigured: fails with "no backend connected", so screens show a truthful state.
 */
export function run<T>(impl: {
  api?: () => Promise<T>;
  preview: () => T | Promise<T>;
  /** Endpoint the backend still needs to provide; shown to the user and listed in docs. */
  requiredEndpoint?: string;
}): Promise<T> {
  if (env.dataMode === 'preview') {
    return new Promise((resolve, reject) => {
      // A short delay keeps loading states visible during review.
      setTimeout(() => {
        try {
          resolve(impl.preview());
        } catch (error) {
          reject(error);
        }
      }, 180);
    });
  }
  if (env.dataMode === 'unconfigured') return Promise.reject(notConfigured());
  if (!impl.api) return Promise.reject(pendingIntegration(impl.requiredEndpoint ?? 'Endpoint not defined'));
  return impl.api();
}

export const isPreview = () => env.dataMode === 'preview';

/** Confirmation copy that is honest about where a change was saved. */
export const savedMessage = (action: string) =>
  isPreview() ? action + ' in this preview session only. Nothing was sent to a server.' : action + '.';
