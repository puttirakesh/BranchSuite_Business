// Fast logins keep the waiting state visible; slow requests are never delayed
// by another full second. Failed requests surface immediately.
export async function withMinimumWait<T>(operation: Promise<T>, milliseconds = 1000): Promise<T> {
  const started = Date.now();
  const result = await operation;
  const remaining = milliseconds - (Date.now() - started);
  if (remaining > 0) await new Promise<void>(resolve => setTimeout(resolve, remaining));
  return result;
}
