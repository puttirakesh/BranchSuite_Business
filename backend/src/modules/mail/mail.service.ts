import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { GmailApiService, loadGmailConfig } from './gmail-api.service';
import { MailError } from './mail-error';

export interface OutboundMail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; path: string; cid?: string; contentDisposition?: 'inline' | 'attachment' }[];
}

export type EmailProvider = 'gmail_api' | 'smtp';

const SAFE_ADDRESS = /^[^\s<>()[\]\\,;:@"]+@[^\s<>()[\]\\,;:@"]+\.[^\s<>()[\]\\,;:@"]+$/;

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  /** Pause before the single bounded retry of an HTTP 429. Overridable in tests. */
  retryDelayMs = 1000;

  constructor(private readonly gmail: GmailApiService = new GmailApiService()) {}

  provider(): EmailProvider {
    const value = (process.env.EMAIL_PROVIDER || 'smtp').trim().toLowerCase();
    if (value === 'gmail_api' || value === 'smtp') return value;
    throw new MailError('CONFIG_INVALID');
  }

  /** The mailbox that sends mail; used by the development redirect. */
  senderAddress(): string {
    if (this.provider() === 'gmail_api') return loadGmailConfig().senderEmail;
    const user = process.env.SMTP_USER?.trim();
    if (!user) throw new MailError('CONFIG_MISSING');
    return user;
  }

  onModuleInit() {
    // Report misconfiguration once at boot without stopping unrelated routes.
    try {
      if (this.provider() === 'gmail_api') loadGmailConfig();
    } catch (error) {
      const code = error instanceof MailError ? error.mailCode : 'UNKNOWN';
      this.logger.error(`Email provider is not ready (code=${code}); OTP delivery will fail until configured`);
    }
  }

  async send(mail: OutboundMail): Promise<void> {
    if (!SAFE_ADDRESS.test(mail.to) || mail.to.length > 254) throw new MailError('MESSAGE_INVALID');
    if (this.provider() === 'smtp') return this.sendSmtp(mail);
    const raw = await this.composeRaw(mail);
    for (let attempt = 0; ; attempt++) {
      try {
        await this.gmail.send(raw);
        return;
      } catch (error) {
        // Retry only an explicit HTTP 429: Gmail rejected the request, so the
        // message cannot have been sent. Ambiguous outcomes are never retried.
        const retryable = error instanceof MailError && error.mailCode === 'GMAIL_RATE_LIMITED' &&
          error.httpStatus === 429 && !error.outcomeUnknown;
        if (!retryable || attempt >= 1) throw error;
        await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
      }
    }
  }

  /** Builds the MIME message with Nodemailer's stream transport (no network). */
  private async composeRaw(mail: OutboundMail): Promise<string> {
    const config = loadGmailConfig();
    try {
      const composer = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
      const info = await composer.sendMail({
        from: { name: config.senderName, address: config.senderEmail },
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachments: mail.attachments,
      });
      return (info.message as Buffer).toString('base64url');
    } catch {
      throw new MailError('MESSAGE_INVALID');
    }
  }

  private async sendSmtp(mail: OutboundMail): Promise<void> {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass) throw new MailError('CONFIG_MISSING');
    const port = Number(process.env.SMTP_PORT || 465);
    await nodemailer.createTransport({ host, port, secure: port === 465,
      auth: { user, pass }, dnsTimeout: 10000, connectionTimeout: 10000,
      greetingTimeout: 10000, socketTimeout: 15000,
    }).sendMail({ from: process.env.SMTP_FROM || user, ...mail });
  }
}
