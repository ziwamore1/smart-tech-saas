import { Logger } from '@nestjs/common';
import {
  SESClient,
  SendEmailCommand,
  GetSendQuotaCommand,
} from '@aws-sdk/client-ses';
import type { EmailProvider } from '../../../interfaces/provider.interface';
import type { SendEmailOptions, SendResult } from '../../../interfaces/message.interface';

export interface AmazonSESConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  fromEmail: string;
}

export class AmazonSESAdapter implements EmailProvider {
  private readonly logger = new Logger(AmazonSESAdapter.name);
  private readonly client: SESClient;
  private readonly fromEmail: string;

  constructor(private readonly config: AmazonSESConfig) {
    this.fromEmail = config.fromEmail;
    this.client = new SESClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async send(options: SendEmailOptions): Promise<SendResult> {
    const toAddresses = Array.isArray(options.to) ? options.to : [options.to];

    try {
      const destination: Record<string, string[]> = {
        ToAddresses: toAddresses,
      };

      if (options.cc) {
        destination.CcAddresses = Array.isArray(options.cc) ? options.cc : [options.cc];
      }
      if (options.bcc) {
        destination.BccAddresses = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
      }

      const message: Record<string, any> = {
        Subject: { Data: options.subject, Charset: 'UTF-8' },
      };

      if (options.htmlBody) {
        message.Html = { Data: options.htmlBody, Charset: 'UTF-8' };
      }
      if (options.body) {
        message.Body = { Text: { Data: options.body, Charset: 'UTF-8' } };
      }

      const command = new SendEmailCommand({
        Source: this.fromEmail,
        Destination: destination,
        Message: message,
        ReplyToAddresses: options.replyTo ? [options.replyTo] : undefined,
      });

      const result = await this.client.send(command);

      const providerMessageId = result.MessageId || `ses-${Date.now()}`;
      this.logger.log(`Email sent via SES to ${toAddresses.join(', ')} (ID: ${providerMessageId})`);

      return {
        success: true,
        provider: 'amazon-ses',
        messageId: providerMessageId,
        providerMessageId,
        status: 'SENT',
        cost: 0,
        currency: 'USD',
        creditsUsed: 0,
        rawResponse: { messageId: result.MessageId, requestId: result.$metadata?.requestId },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`SES send failed: ${message}`);

      return {
        success: false,
        provider: 'amazon-ses',
        messageId: `ses-failed-${Date.now()}`,
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
      const command = new GetSendQuotaCommand({});
      const response = await this.client.send(command);
      const latencyMs = Date.now() - startTime;

      const max24HourSend = response.Max24HourSend ?? 0;
      const sentLast24Hours = response.SentLast24Hours ?? 0;
      const remaining = Math.max(0, max24HourSend - sentLast24Hours);

      this.logger.log(`SES health check passed (${latencyMs}ms, ${remaining} remaining)`);

      return {
        status: remaining > 0 ? 'healthy' : 'degraded',
        latencyMs,
        details: remaining > 0
          ? `Send quota remaining: ${remaining}`
          : 'Send quota exhausted',
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`SES health check failed: ${message}`);
      return { status: 'unhealthy', latencyMs, details: message };
    }
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    try {
      const command = new GetSendQuotaCommand({});
      const response = await this.client.send(command);
      const max24HourSend = response.Max24HourSend ?? 0;
      const sentLast24Hours = response.SentLast24Hours ?? 0;
      const remaining = Math.max(0, max24HourSend - sentLast24Hours);

      this.logger.log(`SES quota: ${remaining} remaining of ${max24HourSend}`);

      return { balance: remaining, currency: 'USD' };
    } catch (error) {
      this.logger.warn(`SES getBalance failed, returning mock: ${error instanceof Error ? error.message : 'Unknown'}`);
      return { balance: -1, currency: 'USD' };
    }
  }
}
