import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { EmailProvider } from '../../../interfaces/provider.interface';
import type { SendEmailOptions, SendResult } from '../../../interfaces/message.interface';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

export class SmtpAdapter implements EmailProvider {
  private readonly logger = new Logger(SmtpAdapter.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
      tls: { rejectUnauthorized: false },
    });
  }

  async send(options: SendEmailOptions): Promise<SendResult> {
    const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;

    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
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

      this.logger.log(`Email sent via SMTP (${this.config.host}) to ${to} (ID: ${info.messageId})`);

      return {
        success: true,
        provider: 'smtp',
        messageId: info.messageId || `smtp-${Date.now()}`,
        providerMessageId: info.messageId,
        status: 'SENT',
        cost: 0,
        currency: 'USD',
        creditsUsed: 0,
        rawResponse: { messageId: info.messageId, response: info.response },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`SMTP send failed: ${message}`);

      return {
        success: false,
        provider: 'smtp',
        messageId: `smtp-failed-${Date.now()}`,
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
      this.logger.log(`SMTP health check passed (${latencyMs}ms)`);
      return { status: 'healthy', latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`SMTP health check failed: ${message}`);
      return { status: 'unhealthy', latencyMs, details: message };
    }
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    return { balance: -1, currency: 'USD' };
  }
}
