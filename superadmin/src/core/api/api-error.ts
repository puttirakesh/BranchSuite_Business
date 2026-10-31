import axios from 'axios';

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Cannot connect to the server. Check your connection and try again.';
    if (error.response.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.response.status === 403) return 'Your account does not have permission to perform this action.';
    const message: unknown = error.response.data?.message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) return message.join('\n');
    return fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
