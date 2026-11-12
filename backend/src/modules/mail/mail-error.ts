// Sanitised mail-delivery failures. Only whitelisted, non-sensitive fields from
// provider errors are read: HTTP status, OAuth error token and API reason.
// Provider messages are never copied, since they can echo addresses or tokens.
export type MailErrorCode =
  | 'CONFIG_MISSING'
  | 'CONFIG_INVALID'
  | 'OAUTH_CLIENT_INVALID'
  | 'OAUTH_TOKEN_REVOKED'
  | 'GMAIL_PERMISSION_DENIED'
  | 'GMAIL_QUOTA_EXCEEDED'
  | 'GMAIL_RATE_LIMITED'
  | 'GMAIL_SENDER_REJECTED'
  | 'MESSAGE_INVALID'
  | 'GMAIL_UPSTREAM_ERROR'
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export class MailError extends Error {
  constructor(
    readonly mailCode: MailErrorCode,
    readonly options: { httpStatus?: number; outcomeUnknown?: boolean } = {},
  ) {
    // The message is the code only, so accidental logging cannot leak details.
    super(mailCode);
    this.name = 'MailError';
  }
  get httpStatus() { return this.options.httpStatus; }
  /** True when Gmail may have accepted the message even though the call failed. */
  get outcomeUnknown() { return this.options.outcomeUnknown === true; }
}

type Raw = {
  code?: unknown;
  status?: unknown;
  response?: { status?: unknown; data?: { error?: unknown; error_description?: unknown } };
};

const NEVER_SENT = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH']);
const TIMEOUTS = new Set(['ETIMEDOUT', 'ECONNABORTED', 'ESOCKETTIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT']);

function statusOf(error: Raw): number | undefined {
  for (const value of [error.response?.status, error.status, error.code]) {
    const number = typeof value === 'string' ? Number(value) : value;
    if (typeof number === 'number' && Number.isInteger(number) && number >= 100 && number <= 599) return number;
  }
  return undefined;
}

function reasonsOf(error: Raw): string[] {
  const data = error.response?.data as { error?: { errors?: { reason?: unknown }[]; status?: unknown } } | undefined;
  const list = data?.error && typeof data.error === 'object' ? data.error.errors : undefined;
  const reasons: unknown[] = Array.isArray(list) ? list.map(item => item?.reason) : [];
  if (data?.error && typeof data.error === 'object' && typeof data.error.status === 'string') reasons.push(data.error.status);
  return reasons.filter((reason): reason is string => typeof reason === 'string');
}

function classifyNetwork(error: Raw, requestMayBeSent: boolean): MailError | undefined {
  const code = typeof error.code === 'string' ? error.code : '';
  if (error.response && statusOf(error) !== undefined) return undefined;
  if (TIMEOUTS.has(code)) return new MailError('NETWORK_TIMEOUT', { outcomeUnknown: requestMayBeSent });
  if (NEVER_SENT.has(code)) return new MailError('NETWORK_ERROR');
  if (code) return new MailError('NETWORK_ERROR', { outcomeUnknown: requestMayBeSent });
  return undefined;
}

/** Failure while exchanging the refresh token for an access token. Nothing was sent. */
export function classifyTokenError(raw: unknown): MailError {
  const error = (raw ?? {}) as Raw;
  const oauth = typeof error.response?.data?.error === 'string' ? error.response.data.error : '';
  if (oauth === 'invalid_grant') return new MailError('OAUTH_TOKEN_REVOKED', { httpStatus: statusOf(error) });
  if (oauth === 'invalid_client' || oauth === 'unauthorized_client') return new MailError('OAUTH_CLIENT_INVALID', { httpStatus: statusOf(error) });
  return classifyNetwork(error, false) ?? new MailError('UNKNOWN', { httpStatus: statusOf(error) });
}

/** Failure of users.messages.send. */
export function classifySendError(raw: unknown): MailError {
  if (raw instanceof MailError) return raw;
  const error = (raw ?? {}) as Raw;
  const status = statusOf(error);
  const reasons = reasonsOf(error);
  const has = (...names: string[]) => reasons.some(reason => names.includes(reason));
  if (error.response && status !== undefined) {
    if (has('dailyLimitExceeded', 'quotaExceeded')) return new MailError('GMAIL_QUOTA_EXCEEDED', { httpStatus: status });
    if (status === 429 || has('rateLimitExceeded', 'userRateLimitExceeded')) return new MailError('GMAIL_RATE_LIMITED', { httpStatus: status });
    if (status === 401) return new MailError('OAUTH_TOKEN_REVOKED', { httpStatus: status });
    if (status === 403) return new MailError(has('insufficientPermissions', 'PERMISSION_DENIED') ? 'GMAIL_PERMISSION_DENIED' : 'GMAIL_SENDER_REJECTED', { httpStatus: status });
    if (status === 400 || status === 413) return new MailError(has('failedPrecondition') ? 'GMAIL_SENDER_REJECTED' : 'MESSAGE_INVALID', { httpStatus: status });
    // A 5xx may be returned after Gmail already accepted the message.
    if (status >= 500) return new MailError('GMAIL_UPSTREAM_ERROR', { httpStatus: status, outcomeUnknown: true });
    return new MailError('UNKNOWN', { httpStatus: status });
  }
  return classifyNetwork(error, true) ?? new MailError('UNKNOWN', { outcomeUnknown: true });
}
