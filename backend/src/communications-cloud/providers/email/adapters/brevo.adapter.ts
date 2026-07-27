import { Logger } from '@nestjs/common';
import type { EmailProvider } from '../../../interfaces/provider.interface';
import type { SendEmailOptions, SendResult } from '../../../interfaces/message.interface';

export interface BrevoConfig {
  apiKey: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpLogin?: string;
  smtpPassword?: string;
  smtpKey?: string;
  fromEmail: string;
  fromName: string;
}

export class BrevoAdapter implements EmailProvider {
  private readonly logger = new Logger(BrevoAdapter.name);
  private readonly BREVO_API = 'https://api.brevo.com/v3/smtp/email';

  constructor(private readonly config: BrevoConfig) {}

  async send(options: SendEmailOptions): Promise<SendResult> {
    const to = Array.isArray(options.to) ? options.to : [options.to];

    try {
      const toRecipients = to.map((addr) => ({ email: addr }));

      const body: any = {
        sender: { email: this.config.fromEmail, name: this.config.fromName },
        to: toRecipients,
        subject: options.subject,
      };

      if (options.htmlBody) {
        body.htmlContent = options.htmlBody;
      }
      if (options.body) {
        body.textContent = options.body;
      }
      if (options.cc) {
        const ccAddrs = Array.isArray(options.cc) ? options.cc : [options.cc];
        body.cc = ccAddrs.map((addr) => ({ email: addr }));
      }
      if (options.bcc) {
        const bccAddrs = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
        body.bcc = bccAddrs.map((addr) => ({ email: addr }));
      }
      if (options.replyTo) {
        body.replyTo = { email: options.replyTo };
      }
      if (options.attachments?.length) {
        body.attachment = options.attachments.map((a) => ({
          name: a.filename,
          content: a.url,
        }));
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(this.BREVO_API, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'accept': 'application/json',
          'api-key': this.config.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      clearTimeout(timeout);

      if (res.ok) {
        const result = await res.json();
        const messageId = result.messageId || `brevo-${Date.now()}`;
        this.logger.log(`Email sent via Brevo to ${to.join(', ')} (ID: ${messageId})`);

        return {
          success: true,
          provider: 'brevo',
          messageId,
          providerMessageId: messageId,
          status: 'SENT',
          cost: 0,
          currency: 'USD',
          creditsUsed: 0,
          rawResponse: result,
        };
      }

      const errorBody = await res.text();
      let parsed: any;
      try { parsed = JSON.parse(errorBody); } catch { parsed = null; }

      const errorMessage = parsed?.message || parsed?.error || `Brevo API ${res.status}: ${errorBody}`;
      this.logger.error(`Brevo send failed (${res.status}): ${errorMessage}`);

      return {
        success: false,
        provider: 'brevo',
        messageId: `brevo-failed-${Date.now()}`,
        status: 'FAILED',
        error: errorMessage,
        cost: 0,
        currency: 'USD',
        creditsUsed: 0,
        rawResponse: parsed || errorBody,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Brevo send failed: ${message}`);

      return {
        success: false,
        provider: 'brevo',
        messageId: `brevo-failed-${Date.now()}`,
        status: 'FAILED',
        error: message,
        cost: 0,
        currency: 'USD',
        creditsUsed: 0,
      };
    }
  }

  async healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }> {
    const startTime = Date.now();
    try {
      const res = await fetch('https://api.brevo.com/v3/account', {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'api-key': this.config.apiKey,
        },
      });

      const latencyMs = Date.now() - startTime;

      if (res.ok) {
        this.logger.log(`Brevo health check passed (${latencyMs}ms)`);
        return { status: 'healthy', latencyMs };
      }

      const body = await res.text();
      this.logger.error(`Brevo health check failed (${res.status}): ${body}`);
      return { status: 'unhealthy', latencyMs, details: `HTTP ${res.status}: ${body}` };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Brevo health check failed: ${message}`);
      return { status: 'unhealthy', latencyMs, details: message };
    }
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    try {
      const res = await fetch('https://api.brevo.com/v3/account', {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'api-key': this.config.apiKey,
        },
      });

      if (res.ok) {
        const account = await res.json();
        const plan = account.plan?.[0];
        const credits = plan?.credits ?? -1;
        return { balance: credits, currency: 'USD' };
      }
    } catch {}

    return { balance: -1, currency: 'USD' };
  }
}
