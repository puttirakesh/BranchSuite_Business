export type AppErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'server'
  | 'not_configured'
  | 'pending_integration'
  | 'unknown';

/** One error type for the whole UI, so screens never deal with transport details. */
export class AppError extends Error {
  constructor(
    public readonly kind: AppErrorKind,
    message: string,
    public readonly detail?: { endpoint?: string; status?: number; fieldErrors?: string[] },
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notConfigured = () =>
  new AppError('not_configured', 'No backend is connected. Set EXPO_PUBLIC_API_URL to load live records.');

/** Thrown for actions whose backend endpoint does not exist yet. Never fakes success. */
export const pendingIntegration = (endpoint: string) =>
  new AppError('pending_integration', 'This action needs a backend endpoint that is not available yet.', { endpoint });

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function errorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  return 'Something went wrong. Try again.';
}
