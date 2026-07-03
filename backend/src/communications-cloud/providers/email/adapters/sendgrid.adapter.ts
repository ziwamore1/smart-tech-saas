import { Logger } from '@nestjs/common';
import type { EmailProvider } from '../../../interfaces/provider.interface';
import type { SendEmailOptions, SendResult } from '../../../interfaces/message.interface';

export interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

export class SendGridAdapter implements EmailProvider {
  private readonly logger = new Logger(SendGridAdapter.name);
  private sgMail: any;

  constructor(private readonly config: SendGridConfig) {}

  private async getClient(): Promise<any> {
    if (this.sgMail) return this.sgMail;
    const sgMail = await import('@sendgrid/mail');
    sgMail.default.setApiKey(this.config.apiKey);
    this.sgMail = sgMail.default;
    return this.sgMail;
  }

  async send(options: SendEmailOptions): Promise<SendResult> {
    const to = Array.isArray(options.to) ? options.to : [options.to];

    try {
      const sgMail = await this.getClient();
      const msg: any = {
        to: to.map((addr) => ({ email: addr })),
        from: { email: this.config.fromEmail, name: this.config.fromName },
        subject: options.subject,
        text: options.body,
        html: options.htmlBody,
      };

      if (options.cc) {
        msg.cc = Array.isArray(options.cc)
          ? options.cc.map((addr) => ({ email: addr }))
          : [{ email: options.cc }];
      }
      if (options.bcc) {
        msg.bcc = Array.isArray(options.bcc)
          ? options.bcc.map((addr) => ({ email: addr }))
          : [{ email: options.bcc }];
      }
      if (options.replyTo) {
        msg.replyTo = { email: options.replyTo };
      }
      if (options.attachments?.length) {
        msg.attachments = options.attachments.map((a) => ({
          filename: a.filename,
          content: a.url,
          type: a.type,
        }));
      }

      const [response] = await sgMail.send(msg);

      const providerMessageId = response.headers?.['x-message-id'] || `sg-${Date.now()}`;
      this.logger.log(`Email sent via SendGrid to ${to.join(', ')} (ID: ${providerMessageId})`);

      return {
        success: true,
        provider: 'sendgrid',
        messageId: providerMessageId,
        providerMessageId,
        status: 'SENT',
        cost: 0,
        currency: 'USD',
        creditsUsed: 0,
        rawResponse: { statusCode: response.statusCode, headers: response.headers },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`SendGrid send failed: ${message}`);

      return {
        success: false,
        provider: 'sendgrid',
        messageId: `sg-failed-${Date.now()}`,
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
      const sgMail = await this.getClient();
      const [response] = await sgMail.send({
        to: this.config.fromEmail,
        from: { email: this.config.fromEmail, name: this.config.fromName },
        subject: 'SendGrid Health Check',
        text: 'This is a health check email. If received, ignore.',
        mailSettings: { sandboxMode: { enable: true } },
      });

      const latencyMs = Date.now() - startTime;
      this.logger.log(`SendGrid health check passed (${latencyMs}ms)`);
      return { status: 'healthy', latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`SendGrid health check failed: ${message}`);
      return { status: 'unhealthy', latencyMs, details: message };
    }
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    return { balance: -1, currency: 'USD' };
  }
}
