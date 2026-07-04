import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Twilio } from 'twilio';

export interface TwilioSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: string;
  cost?: number;
}

export interface TwilioBalanceResult {
  success: boolean;
  balance?: number;
  currency?: string;
  error?: string;
}

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  private client: Twilio | null = null;
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly apiKeySid: string;
  private readonly apiKeySecret: string;
  private readonly messagingServiceSid: string;
  private readonly fromNumber: string;
  private readonly enabled: boolean;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID', '');
    this.authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN', '');
    this.apiKeySid = this.configService.get<string>('TWILIO_API_KEY_SID', '');
    this.apiKeySecret = this.configService.get<string>('TWILIO_API_KEY_SECRET', '');
    this.messagingServiceSid = this.configService.get<string>('TWILIO_MESSAGING_SERVICE_SID', '');
    this.fromNumber = this.configService.get<string>('TWILIO_FROM_NUMBER', '');
    this.enabled = this.configService.get<string>('TWILIO_ENABLED', 'false') === 'true';

    const useApiKey = this.enabled && this.apiKeySid && this.apiKeySecret;
    const useAuthToken = this.enabled && this.accountSid && this.authToken;

    if (useApiKey) {
      this.client = new Twilio(this.apiKeySid, this.apiKeySecret, { accountSid: this.accountSid });
      this.logger.log('[Twilio] Service initialized with API Key');
    } else if (useAuthToken) {
      this.client = new Twilio(this.accountSid, this.authToken);
      this.logger.log('[Twilio] Service initialized with Auth Token');
    } else if (!this.enabled) {
      this.logger.warn('[Twilio] Service disabled - set TWILIO_ENABLED=true');
    } else {
      this.logger.warn('[Twilio] Missing credentials (TWILIO_API_KEY_SID+TWILIO_API_KEY_SECRET or TWILIO_ACCOUNT_SID+TWILIO_AUTH_TOKEN)');
    }
  }

  private get sid(): string {
    return this.apiKeySid || this.accountSid;
  }

  private get secret(): string {
    return this.apiKeySecret || this.authToken;
  }

  private async resolveCredentials(channel?: string): Promise<{
    sid: string;
    secret: string;
    messagingServiceSid: string;
    fromNumber: string;
  }> {
    if (this.sid && this.secret) {
      return {
        sid: this.sid,
        secret: this.secret,
        messagingServiceSid: this.messagingServiceSid,
        fromNumber: this.fromNumber,
      };
    }
    try {
      const provider = await this.prisma.systemProvider.findFirst({
        where: { channel: channel || 'SMS', isDefault: true },
        select: { apiKey: true, apiSecret: true },
      });
      if (provider?.apiKey && provider?.apiSecret) {
        return {
          sid: provider.apiKey,
          secret: provider.apiSecret,
          messagingServiceSid: this.messagingServiceSid,
          fromNumber: this.fromNumber,
        };
      }
    } catch {
      // DB not available, fall back to env vars
    }
    return {
      sid: this.sid,
      secret: this.secret,
      messagingServiceSid: this.messagingServiceSid,
      fromNumber: this.fromNumber,
    };
  }

  private async getClient(channel?: string): Promise<Twilio> {
    const creds = await this.resolveCredentials(channel);
    if (this.client && creds.sid === this.sid && creds.secret === this.secret) {
      return this.client;
    }
    if (this.apiKeySid && this.apiKeySecret) {
      return new Twilio(creds.sid, creds.secret, { accountSid: this.accountSid });
    }
    return new Twilio(creds.sid, creds.secret);
  }

  async sendSms(to: string, message: string): Promise<TwilioSmsResult> {
    if (!this.enabled) {
      return { success: false, error: 'Twilio SMS service is disabled' };
    }

    try {
      this.logger.log(`[Twilio SMS] Sending to ${to}: ${message.substring(0, 50)}...`);

      const client = await this.getClient('SMS');
      const normalizedTo = to.replace(/[+\s\-\(\)]/g, '');
      const formattedTo = normalizedTo.startsWith('+') ? normalizedTo : `+${normalizedTo}`;

      const payload: any = {
        to: formattedTo,
        body: message,
      };

      if (this.fromNumber) {
        payload.from = this.fromNumber;
      } else if (this.messagingServiceSid) {
        payload.messagingServiceSid = this.messagingServiceSid;
      }

      const twilioMsg = await client.messages.create(payload);

      this.logger.log(`[Twilio SMS] Sent successfully to ${to}, SID: ${twilioMsg.sid}`);
      return {
        success: true,
        messageId: twilioMsg.sid,
        status: twilioMsg.status,
        cost: twilioMsg.price ? parseFloat(twilioMsg.price) : undefined,
      };
    } catch (error) {
      this.logger.error(`[Twilio SMS] Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async sendBulkSms(recipients: string[], message: string): Promise<TwilioSmsResult> {
    if (!this.enabled) {
      return { success: false, error: 'Twilio SMS service is disabled' };
    }

    try {
      this.logger.log(`[Twilio Bulk SMS] Sending to ${recipients.length} recipients`);

      const client = await this.getClient('SMS');
      let successCount = 0;
      const messageIds: string[] = [];

      const payload: any = { body: message };
      if (this.fromNumber) {
        payload.from = this.fromNumber;
      } else if (this.messagingServiceSid) {
        payload.messagingServiceSid = this.messagingServiceSid;
      }

      for (const recipient of recipients) {
        try {
          const normalizedTo = recipient.replace(/[+\s\-\(\)]/g, '');
          const formattedTo = normalizedTo.startsWith('+') ? normalizedTo : `+${normalizedTo}`;
          const result = await client.messages.create({ ...payload, to: formattedTo });
          messageIds.push(result.sid);
          successCount++;
        } catch (err) {
          this.logger.error(`[Twilio Bulk] Failed to send to ${recipient}: ${err.message}`);
        }
      }

      if (successCount > 0) {
        this.logger.log(`[Twilio Bulk SMS] Sent to ${successCount}/${recipients.length} recipients`);
        return {
          success: true,
          messageId: messageIds.join(',') || `twilio_bulk_${Date.now()}`,
          status: 'sent',
        };
      }

      return { success: false, error: 'All messages failed' };
    } catch (error) {
      this.logger.error(`[Twilio Bulk SMS] Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async getBalance(): Promise<TwilioBalanceResult> {
    if (!this.enabled) {
      return { success: false, error: 'Twilio service is disabled' };
    }

    try {
      const client = await this.getClient('SMS');
      const balanceData = await client.api.accounts(this.accountSid || this.sid).balance.fetch();

      return {
        success: true,
        balance: parseFloat(balanceData.balance || '0'),
        currency: balanceData.currency || 'USD',
      };
    } catch (error) {
      this.logger.error(`[Twilio Balance] Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async isConfigured(): Promise<boolean> {
    if (this.enabled && this.sid && this.secret) return true;
    try {
      const provider = await this.prisma.systemProvider.findFirst({
        where: { channel: 'SMS', isDefault: true },
        select: { apiKey: true, apiSecret: true },
      });
      return this.enabled && !!(provider?.apiKey && provider?.apiSecret);
    } catch {
      return false;
    }
  }

  getConfigStatus(): { enabled: boolean; hasAccountSid: boolean; hasAuthToken: boolean; hasApiKeySid: boolean; hasApiKeySecret: boolean; hasMessagingServiceSid: boolean } {
    return {
      enabled: this.enabled,
      hasAccountSid: !!this.accountSid,
      hasAuthToken: !!this.authToken,
      hasApiKeySid: !!this.apiKeySid,
      hasApiKeySecret: !!this.apiKeySecret,
      hasMessagingServiceSid: !!this.messagingServiceSid,
    };
  }
}
