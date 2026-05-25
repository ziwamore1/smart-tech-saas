import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

@Injectable()
export class BeemService {
  private readonly logger = new Logger(BeemService.name);
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly senderName: string;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('BEEM_API_KEY', '');
    this.secretKey = this.configService.get<string>('BEEM_SECRET_KEY', '');
    this.senderName = this.configService.get<string>('BEEM_SENDER_NAME', 'SmartTech');
    this.enabled = this.configService.get<string>('BEEM_ENABLED', 'false') === 'true';

    if (this.enabled && this.apiKey && this.secretKey) {
      this.logger.log('[Beem] Service initialized successfully');
    } else if (!this.enabled) {
      this.logger.warn('[Beem] Service disabled - set BEEM_ENABLED=true');
    } else {
      this.logger.warn('[Beem] Missing credentials (BEEM_API_KEY, BEEM_SECRET_KEY)');
    }
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64');
    return `Basic ${credentials}`;
  }

  private async request<T>(url: string, body: any, method: 'POST' | 'GET' = 'POST'): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': this.getAuthHeader(),
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

  async sendWhatsApp(to: string, message: string): Promise<BeemWhatsAppResult> {
    if (!this.enabled) {
      return { success: false, error: 'Beem WhatsApp service is disabled' };
    }

    try {
      this.logger.log(`[Beem WhatsApp] Sending to ${to}: ${message.substring(0, 50)}...`);

      const normalizedTo = to.replace(/[+\s\-\(\)]/g, '');
      const result = await this.request<{ success: boolean; messageId?: string; code?: number; error?: string }>(
        'https://apichatcore.beem.africa/v1/chatapi',
        {
          from: this.senderName,
          to: normalizedTo,
          channel: 'whatsapp',
          transaction_id: Date.now().toString(),
          message_type: 'text',
          text: message,
        },
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

  isConfigured(): boolean {
    return this.enabled && !!this.apiKey && !!this.secretKey;
  }

  getConfigStatus(): { enabled: boolean; hasApiKey: boolean; hasSecretKey: boolean } {
    return {
      enabled: this.enabled,
      hasApiKey: !!this.apiKey,
      hasSecretKey: !!this.secretKey,
    };
  }
}
