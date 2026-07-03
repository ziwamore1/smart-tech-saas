import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { EmailProvider } from '../../../interfaces/provider.interface';
import type { SendEmailOptions, SendResult } from '../../../interfaces/message.interface';

export interface ZohoConfig {
  email: string;
  password: string;
  name: string;
}

export class ZohoAdapter implements EmailProvider {
  private readonly logger = new Logger(ZohoAdapter.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly name: string;

  constructor(private readonly config: ZohoConfig) {
    this.name = config.name;
    this.transporter = nodemailer.createTransport({
      host: 'smtp.zoho.com',
      port: 465,
      secure: true,
      auth: {
        user: config.email,
        pass: config.password,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
      tls: { rejectUnauthorized: false },
    });
  }

  async send(options: SendEmailOptions): Promise<SendResult> {
    const startTime = Date.now();
    const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;

    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${this.name}" <${this.config.email}>`,
        to,
        subject: options.subject,
        text: options.body,
        html: options.htmlBody,
      };

      if (options.cc) {
        mailOptions.cc = Array.isArray(options.cc) ? options.cc.join(', ') : options.cc;
      }
      if (options.bcc) {
        mailOptions.bcc = Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc;
      }
      if (options.replyTo) {
        mailOptions.replyTo = options.replyTo;
      }
      if (options.attachments?.length) {
        mailOptions.attachments = options.attachments.map((a) => ({
          filename: a.filename,
          content: a.url,
        }));
      }

      const info = await this.transporter.sendMail(mailOptions);

      this.logger.log(`Email sent via Zoho to ${to} (ID: ${info.messageId})`);

      return {
        success: true,
        provider: 'zoho',
        messageId: info.messageId || `zoho-${Date.now()}`,
        providerMessageId: info.messageId,
        status: 'SENT',
        cost: 0,
        currency: 'USD',
        creditsUsed: 0,
        rawResponse: { messageId: info.messageId, response: info.response },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Zoho send failed: ${message}`);

      return {
        success: false,
        provider: 'zoho',
        messageId: `zoho-failed-${Date.now()}`,
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
      await this.transporter.verify();
      const latencyMs = Date.now() - startTime;
      this.logger.log(`Zoho health check passed (${latencyMs}ms)`);
      return { status: 'healthy', latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Zoho health check failed: ${message}`);
      return { status: 'unhealthy', latencyMs, details: message };
    }
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    return { balance: -1, currency: 'USD' };
  }
}
