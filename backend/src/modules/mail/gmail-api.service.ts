import { Injectable } from '@nestjs/common';
import { auth, gmail } from 'googleapis/build/src/apis/gmail';
import { classifySendError, classifyTokenError, MailError } from './mail-error';

// Only the gmail.send scope is used; it is fixed by the refresh token's grant.
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const REQUEST_TIMEOUT_MS = 15000;

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  senderEmail: string;
  senderName: string;
}

export interface GmailClients {
  oauth: { getAccessToken(): Promise<unknown> };
  gmail: { users: { messages: { send(params: unknown, options?: unknown): Promise<{ data?: { id?: string | null } }> } } };
}

export function loadGmailConfig(env: NodeJS.ProcessEnv = process.env): GmailConfig {
  const read = (name: string) => env[name]?.trim() || '';
  const clientId = read('GMAIL_CLIENT_ID');
  const clientSecret = read('GMAIL_CLIENT_SECRET');
  const refreshToken = read('GMAIL_REFRESH_TOKEN');
  const senderEmail = read('GMAIL_SENDER_EMAIL');
  if (!clientId || !clientSecret || !refreshToken || !senderEmail) throw new MailError('CONFIG_MISSING');
  if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(senderEmail)) throw new MailError('CONFIG_INVALID');
  // Display names are stripped of control characters and quotes (header safety).
  const senderName = (read('GMAIL_SENDER_NAME') || 'BranchSuite Business').replace(/[\r\n"<>\\]/g, ' ').trim().slice(0, 80);
  return { clientId, clientSecret, refreshToken, senderEmail, senderName };
}

@Injectable()
export class GmailApiService {
  private clients?: GmailClients;

  /** Overridable in tests; builds the real Google OAuth2 + Gmail clients. */
  clientFactory: (config: GmailConfig) => GmailClients = config => {
    // No redirect URI is needed: the refresh token was issued beforehand.
    const oauth = new auth.OAuth2(config.clientId, config.clientSecret);
    // google-auth-library refreshes and caches access tokens on demand.
    oauth.setCredentials({ refresh_token: config.refreshToken });
    return { oauth, gmail: gmail({ version: 'v1', auth: oauth as never }) as never };
  };

  /** Sends a base64url-encoded RFC 2822 message through users.messages.send. */
  async send(raw: string): Promise<{ id?: string }> {
    const config = loadGmailConfig();
    this.clients ||= this.clientFactory(config);
    const { oauth, gmail: api } = this.clients;
    // Fetch the access token separately: a failure here proves nothing was sent.
    try {
      await this.withTimeout(oauth.getAccessToken(), false);
    } catch (error) {
      throw error instanceof MailError ? error : classifyTokenError(error);
    }
    try {
      const response = await this.withTimeout(api.users.messages.send(
        { userId: 'me', requestBody: { raw } },
        // POST is not retried by the client library; avoid duplicate sends.
        { timeout: REQUEST_TIMEOUT_MS, retry: false },
      ), true);
      return { id: response.data?.id ?? undefined };
    } catch (error) {
      throw classifySendError(error);
    }
  }

  private withTimeout<T>(work: Promise<T>, requestMayBeSent: boolean): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new MailError('NETWORK_TIMEOUT', { outcomeUnknown: requestMayBeSent })), REQUEST_TIMEOUT_MS + 2000);
    });
    return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
  }
}
