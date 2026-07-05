import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface BeemSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: string;
}

export interface BeemWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BeemBalanceResult {
  success: boolean;
  balance?: number;
  currency?: string;
  error?: string;
}

export interface BeemWhatsAppPayload {
  body: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  mediaUrl?: string;
  mediaType?: string;
}

@Injectable()
export class BeemService {
  private readonly logger = new Logger(BeemService.name);
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly senderName: string;
  private readonly whatsappFrom: string;
  private readonly enabled: boolean;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.apiKey = this.configService.get<string>('BEEM_API_KEY', '');
    this.secretKey = this.configService.get<string>('BEEM_SECRET_KEY', '');
    this.senderName = this.configService.get<string>('BEEM_SENDER_NAME', 'SmartTech');
    this.whatsappFrom = this.configService.get<string>('BEEM_WHATSAPP_FROM', '');
    this.enabled = this.configService.get<string>('BEEM_ENABLED', 'false') === 'true';

    if (this.enabled && this.apiKey && this.secretKey) {
      this.logger.log('[Beem] Service initialized successfully');
      if (!this.whatsappFrom) {
        this.logger.warn('[Beem] BEEM_WHATSAPP_FROM not set - WhatsApp messages will fail');
      }
    } else if (!this.enabled) {
      this.logger.warn('[Beem] Service disabled - set BEEM_ENABLED=true');
    } else {
      this.logger.warn('[Beem] Missing credentials (BEEM_API_KEY, BEEM_SECRET_KEY)');
    }
  }

  private async resolveCredentials(channel?: string): Promise<{ apiKey: string; secretKey: string }> {
    if (this.apiKey && this.secretKey) {
      return { apiKey: this.apiKey, secretKey: this.secretKey };
    }
    try {
      const provider = await this.prisma.systemProvider.findFirst({
        where: { channel: channel || 'SMS', isDefault: true },
        select: { apiKey: true, apiSecret: true },
      });
      if (provider?.apiKey && provider?.apiSecret) {
        return { apiKey: provider.apiKey, secretKey: provider.apiSecret };
      }
    } catch {
      // DB not available, fall back to env vars (even if empty)
    }
    return { apiKey: this.apiKey, secretKey: this.secretKey };
  }

  private async getAuthHeader(channel?: string): Promise<string> {
    const creds = await this.resolveCredentials(channel);
    const raw = `${creds.apiKey}:${creds.secretKey}`;
    return `Basic ${Buffer.from(raw).toString('base64')}`;
  }

  private async request<T>(url: string, body: any, method: 'POST' | 'GET' = 'POST', channel?: string): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': await this.getAuthHeader(channel),
    };

    const options: RequestInit = { method, headers };

    if (method === 'POST' && body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Beem API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  async sendSms(to: string, message: string): Promise<BeemSmsResult> {
    if (!this.enabled) {
      return { success: false, error: 'Beem SMS service is disabled' };
    }

    try {
      this.logger.log(`[Beem SMS] Sending to ${to}: ${message.substring(0, 50)}...`);

      const normalizedTo = to.replace(/[+\s\-\(\)]/g, '');
      const result = await this.request<{ success: boolean; message_id?: string; code?: number; error?: string }>(
        'https://apisms.beem.africa/v1/send',
        {
          source_addr: this.senderName,
          encoding: 0,
          schedule_time: '',
          message,
          recipients: [{ recipient_id: Date.now().toString(), dest_addr: normalizedTo }],
        },
        'POST',
        'SMS',
      );

      if (result.success || result.code === 200 || result.code === 0) {
        this.logger.log(`[Beem SMS] Sent successfully to ${to}`);
        return {
          success: true,
          messageId: result.message_id || `beem_${Date.now()}`,
          status: 'sent',
        };
      }

      this.logger.error(`[Beem SMS] API returned error: ${result.error || result.code}`);
      return { success: false, error: result.error || `API error code: ${result.code}` };
    } catch (error) {
      this.logger.error(`[Beem SMS] Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async sendBulkSms(recipients: string[], message: string): Promise<BeemSmsResult> {
    if (!this.enabled) {
      return { success: false, error: 'Beem SMS service is disabled' };
    }

    try {
      this.logger.log(`[Beem Bulk SMS] Sending to ${recipients.length} recipients`);

      const formattedRecipients = recipients.map((phone, i) => ({
        recipient_id: i.toString(),
        dest_addr: phone.replace(/[+\s\-\(\)]/g, ''),
      }));

      const result = await this.request<{ success: boolean; message_id?: string; code?: number; error?: string }>(
        'https://apisms.beem.africa/v1/send',
        {
          source_addr: this.senderName,
          encoding: 0,
          schedule_time: '',
          message,
          recipients: formattedRecipients,
        },
        'POST',
        'SMS',
      );

      if (result.success || result.code === 200 || result.code === 0) {
        this.logger.log(`[Beem Bulk SMS] Sent successfully to ${recipients.length} recipients`);
        return {
          success: true,
          messageId: result.message_id || `beem_bulk_${Date.now()}`,
          status: 'sent',
        };
      }

      return { success: false, error: result.error || `API error code: ${result.code}` };
    } catch (error) {
      this.logger.error(`[Beem Bulk SMS] Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async sendWhatsApp(to: string, message: string, payload?: BeemWhatsAppPayload): Promise<BeemWhatsAppResult> {
    if (!this.enabled) {
      return { success: false, error: 'Beem WhatsApp service is disabled' };
    }

    if (!this.whatsappFrom) {
      return { success: false, error: 'BEEM_WHATSAPP_FROM not configured. Set the verified WhatsApp Business phone number.' };
    }

    try {
      this.logger.log(`[Beem WhatsApp] Sending to ${to}: ${message.substring(0, 50)}...`);

      const normalizedTo = to.replace(/[+\s\-\(\)]/g, '');
      const body: Record<string, unknown> = {
        from: this.whatsappFrom,
        to: normalizedTo,
        channel: 'whatsapp',
        transaction_id: Date.now().toString(),
      };

      if (payload?.templateId) {
        body.message_type = 'template';
        body.template = {
          name: payload.templateId,
          language: { code: 'en' },
        };
        if (payload.templateData) {
          const components: Record<string, unknown>[] = [
            {
              type: 'body',
              parameters: Object.values(payload.templateData).map((v) => ({
                type: 'text',
                text: String(v),
              })),
            },
          ];
          body.template = { ...(body.template as object), components };
        }
      } else if (payload?.mediaUrl) {
        const mediaType = payload.mediaType || 'image';
        body.message_type = mediaType;
        body.media = {
          type: mediaType,
          url: payload.mediaUrl,
          caption: message || undefined,
        };
      } else {
        body.message_type = 'text';
        body.text = message;
      }

      const result = await this.request<{ success: boolean; messageId?: string; code?: number; error?: string }>(
        'https://apichatcore.beem.africa/v1/chatapi',
        body,
        'POST',
        'WHATSAPP',
      );

      if (result.success || result.code === 200 || result.code === 0 || result.code === 201) {
        this.logger.log(`[Beem WhatsApp] Sent successfully to ${to}`);
        return {
          success: true,
          messageId: result.messageId || `beem_wa_${Date.now()}`,
        };
      }

      return { success: false, error: result.error || `API error code: ${result.code}` };
    } catch (error) {
      this.logger.error(`[Beem WhatsApp] Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async getBalance(): Promise<BeemBalanceResult> {
    if (!this.enabled) {
      return { success: false, error: 'Beem service is disabled' };
    }

    try {
      const result = await this.request<{ success: boolean; balance: number; currency: string }>(
        'https://apisms.beem.africa/public/v1/vendors/balance',
        null,
        'GET',
        'SMS',
      );

      if (result.success) {
        return {
          success: true,
          balance: result.balance,
          currency: result.currency || 'TZS',
        };
      }

      return { success: false, error: 'Failed to fetch balance' };
    } catch (error) {
      this.logger.error(`[Beem Balance] Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async isConfigured(): Promise<boolean> {
    if (this.enabled && this.apiKey && this.secretKey) return true;
    try {
      const provider = await this.prisma.systemProvider.findFirst({
        where: { channel: { in: ['SMS', 'WHATSAPP'] }, isDefault: true },
        select: { apiKey: true, apiSecret: true },
      });
      return this.enabled && !!(provider?.apiKey && provider?.apiSecret);
    } catch {
      return false;
    }
  }

  getConfigStatus(): { enabled: boolean; hasApiKey: boolean; hasSecretKey: boolean; hasWhatsAppFrom: boolean; senderName: string } {
    return {
      enabled: this.enabled,
      hasApiKey: !!this.apiKey,
      hasSecretKey: !!this.secretKey,
      hasWhatsAppFrom: !!this.whatsappFrom,
      senderName: this.senderName,
    };
  }
}
