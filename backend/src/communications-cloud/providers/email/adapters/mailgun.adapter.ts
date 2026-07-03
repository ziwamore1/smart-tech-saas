import { Logger } from '@nestjs/common';
import axios from 'axios';
import type { EmailProvider } from '../../../interfaces/provider.interface';
import type { SendEmailOptions, SendResult } from '../../../interfaces/message.interface';

export interface MailgunConfig {
  apiKey: string;
  domain: string;
  fromEmail: string;
  fromName: string;
}

export class MailgunAdapter implements EmailProvider {
  private readonly logger = new Logger(MailgunAdapter.name);
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(private readonly config: MailgunConfig) {
    this.baseUrl = `https://api.mailgun.net/v3/${config.domain}`;
    this.authHeader = `Basic ${Buffer.from(`api:${config.apiKey}`).toString('base64')}`;
  }

  async send(options: SendEmailOptions): Promise<SendResult> {
    const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;

    try {
      const formData = new URLSearchParams();
      formData.append('from', `"${this.config.fromName}" <${this.config.fromEmail}>`);
      formData.append('to', to);
      formData.append('subject', options.subject);

      if (options.body) {
        formData.append('text', options.body);
      }
      if (options.htmlBody) {
        formData.append('html', options.htmlBody);
      }
      if (options.cc) {
        formData.append('cc', Array.isArray(options.cc) ? options.cc.join(', ') : options.cc);
      }
      if (options.bcc) {
        formData.append('bcc', Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc);
      }
      if (options.replyTo) {
        formData.append('h:Reply-To', options.replyTo);
      }
      if (options.attachments?.length) {
        for (const attachment of options.attachments) {
          formData.append('attachment', attachment.url);
        }
      }

      const response = await axios.post(`${this.baseUrl}/messages`, formData.toString(), {
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000,
      });

      const body = response.data as { id?: string; message?: string };
      const providerMessageId = body.id || `mg-${Date.now()}`;

      this.logger.log(`Email sent via Mailgun to ${to} (ID: ${providerMessageId})`);

      return {
        success: true,
        provider: 'mailgun',
        messageId: providerMessageId,
        providerMessageId,
        status: 'SENT',
        cost: 0,
        currency: 'USD',
        creditsUsed: 0,
        rawResponse: body,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Mailgun send failed: ${message}`);

      return {
        success: false,
        provider: 'mailgun',
        messageId: `mg-failed-${Date.now()}`,
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
      const response = await axios.get(`${this.baseUrl}/domains/${this.config.domain}`, {
        headers: { Authorization: this.authHeader },
        timeout: 10000,
      });

      const latencyMs = Date.now() - startTime;
      const domain = response.data?.domain as Record<string, any> | undefined;
      const state = domain?.state as string | undefined;

      this.logger.log(`Mailgun health check passed (${latencyMs}ms)`);

      return {
        status: state === 'active' ? 'healthy' : 'degraded',
        latencyMs,
        details: state ? `Domain state: ${state}` : undefined,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Mailgun health check failed: ${message}`);
      return { status: 'unhealthy', latencyMs, details: message };
    }
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    return { balance: -1, currency: 'USD' };
  }
}
