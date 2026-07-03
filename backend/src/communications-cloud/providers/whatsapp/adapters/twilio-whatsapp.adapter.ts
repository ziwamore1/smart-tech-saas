import { Logger } from '@nestjs/common';
import { Twilio } from 'twilio';
import type { WhatsAppProvider } from '../../../interfaces/provider.interface';
import type { SendWhatsAppOptions, SendResult } from '../../../interfaces/message.interface';

export interface TwilioWhatsAppConfig {
  accountSid: string;
  authToken: string;
  from: string;
}

export class TwilioWhatsAppAdapter implements WhatsAppProvider {
  private readonly logger = new Logger(TwilioWhatsAppAdapter.name);
  private readonly providerName = 'twilio';
  private readonly client: Twilio;
  private readonly from: string;

  constructor(config: TwilioWhatsAppConfig) {
    this.client = new Twilio(config.accountSid, config.authToken);
    this.from = config.from.startsWith('whatsapp:') ? config.from : `whatsapp:${config.from}`;
  }

  async send(options: SendWhatsAppOptions): Promise<SendResult> {
    try {
      this.logger.log(`Sending WhatsApp via Twilio to ${options.to}`);

      const formattedTo = options.to.startsWith('whatsapp:') ? options.to : `whatsapp:${options.to.replace(/[^0-9+]/g, '')}`;

      const payload: Record<string, unknown> = {
        to: formattedTo,
        from: this.from,
      };

      if (options.mediaUrl) {
        payload.body = options.body || '';
        payload.mediaUrl = [options.mediaUrl];
      } else if (options.templateId) {
        payload.body = options.body;
        payload.contentSid = options.templateId;
        if (options.templateData) {
          payload.contentVariables = JSON.stringify(
            Object.values(options.templateData).reduce((acc, v, i) => {
              acc[String(i + 1)] = String(v);
              return acc;
            }, {} as Record<string, string>),
          );
        }
      } else {
        payload.body = options.body;
      }

      const message = await this.client.messages.create(payload as any);

      return {
        success: true,
        provider: this.providerName,
        messageId: options.metadata?.id as string || '',
        providerMessageId: message.sid,
        status: 'SENT',
        cost: message.price ? parseFloat(message.price) : undefined,
        currency: message.priceUnit,
        rawResponse: { sid: message.sid, status: message.status },
      };
    } catch (error) {
      this.logger.error(`Twilio WhatsApp send failed: ${error.message}`);
      return {
        success: false,
        provider: this.providerName,
        messageId: options.metadata?.id as string || '',
        status: 'FAILED',
        error: error.message,
      };
    }
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    try {
      const balanceData = await this.client.api.accounts(this.client.accountSid).balance.fetch();
      return {
        balance: parseFloat(balanceData.balance || '0'),
        currency: balanceData.currency || 'USD',
      };
    } catch (error) {
      this.logger.error(`Twilio balance check failed: ${error.message}`);
      return { balance: 0, currency: 'USD' };
    }
  }

  async healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }> {
    const start = Date.now();
    try {
      const account = await this.client.api.accounts(this.client.accountSid).fetch();
      const latencyMs = Date.now() - start;
      if (account.status === 'active') {
        return { status: 'healthy', latencyMs, details: `Account: ${account.friendlyName}` };
      }
      return { status: 'degraded', latencyMs, details: `Account status: ${account.status}` };
    } catch (error) {
      const latencyMs = Date.now() - start;
      return { status: 'unhealthy', latencyMs, details: error.message };
    }
  }
}
