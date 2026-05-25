import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LaafficSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: string;
}

export interface LaafficVoiceOtpResult {
  success: boolean;
  taskId?: string;
  error?: string;
}

export interface LaafficWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface LaafficBalanceResult {
  success: boolean;
  balance?: number;
  currency?: string;
  error?: string;
}

@Injectable()
export class LaafficService {
  private readonly logger = new Logger(LaafficService.name);
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly appId: string;
  private readonly baseUrl: string;
  private readonly smsSenderId: string;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('LAAFFIC_API_KEY', '');
    this.apiSecret = this.configService.get<string>('LAAFFIC_API_SECRET', '');
    this.appId = this.configService.get<string>('LAAFFIC_APP_ID', '');
    this.baseUrl = this.configService.get<string>('LAAFFIC_API_URL', 'https://api.laaffic.com');
    this.smsSenderId = this.configService.get<string>('LAAFFIC_SMS_SENDER_ID', 'SmartTech');
    this.enabled = this.configService.get<string>('LAAFFIC_ENABLED', 'false') === 'true';

    if (this.enabled && this.apiKey && this.apiSecret && this.appId) {
      this.logger.log('[Laaffic] Service initialized successfully');
    } else if (!this.enabled) {
      this.logger.warn('[Laaffic] Service disabled - set LAAFFIC_ENABLED=true');
    } else {
      this.logger.warn('[Laaffic] Missing credentials (API_KEY, API_SECRET, APP_ID)');
    }
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
    return `Basic ${credentials}`;
  }

  private async request<T>(endpoint: string, body: any, method: 'POST' | 'GET' = 'POST'): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': this.getAuthHeader(),
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (method === 'POST' && body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Laaffic API error (${response.status}): ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  async sendSms(to: string, message: string): Promise<LaafficSmsResult> {
    if (!this.enabled) {
      return { success: false, error: 'Laaffic SMS service is disabled' };
    }

    try {
      this.logger.log(`[Laaffic SMS] Sending to ${to}: ${message.substring(0, 50)}...`);

      const result = await this.request<{ code: number; data: { taskId: string } }>('/v2/sms/sendSms', {
        appId: this.appId,
        to: to.startsWith('+') ? to : `+${to}`,
        content: message,
        senderId: this.smsSenderId,
      });

      if (result.code === 0 || result.code === 200) {
        this.logger.log(`[Laaffic SMS] Sent successfully, taskId: ${result.data?.taskId}`);
        return {
          success: true,
          messageId: result.data?.taskId,
          status: 'sent',
        };
      }

      this.logger.error(`[Laaffic SMS] API returned error code: ${result.code}`);
      return { success: false, error: `API error code: ${result.code}` };
    } catch (error) {
      this.logger.error(`[Laaffic SMS] Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async sendBulkSms(recipients: string[], message: string): Promise<LaafficSmsResult> {
    if (!this.enabled) {
      return { success: false, error: 'Laaffic SMS service is disabled' };
    }

    try {
      this.logger.log(`[Laaffic Bulk SMS] Sending to ${recipients.length} recipients`);

      const formattedRecipients = recipients.map(phone =>
        phone.startsWith('+') ? phone : `+${phone}`
      );

      const result = await this.request<{ code: number; data: { taskId: string } }>('/v2/sms/sendSmsBatch', {
        appId: this.appId,
        to: formattedRecipients,
        content: message,
        senderId: this.smsSenderId,
      });

      if (result.code === 0 || result.code === 200) {
        this.logger.log(`[Laaffic Bulk SMS] Sent successfully, taskId: ${result.data?.taskId}`);
        return {
          success: true,
          messageId: result.data?.taskId,
          status: 'sent',
        };
      }

      return { success: false, error: `API error code: ${result.code}` };
    } catch (error) {
      this.logger.error(`[Laaffic Bulk SMS] Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async sendWhatsApp(to: string, message: string): Promise<LaafficWhatsAppResult> {
    if (!this.enabled) {
      return { success: false, error: 'Laaffic WhatsApp service is disabled' };
    }

    try {
      this.logger.log(`[Laaffic WhatsApp] Sending to ${to}: ${message.substring(0, 50)}...`);

      const result = await this.request<{ code: number; data: { messageId: string } }>('/v2/whatsapp/send', {
        appId: this.appId,
        to: to.startsWith('+') ? to : `+${to}`,
        content: message,
      });

      if (result.code === 0 || result.code === 200) {
        this.logger.log(`[Laaffic WhatsApp] Sent successfully, messageId: ${result.data?.messageId}`);
        return {
          success: true,
          messageId: result.data?.messageId,
        };
      }

      return { success: false, error: `API error code: ${result.code}` };
    } catch (error) {
      this.logger.error(`[Laaffic WhatsApp] Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async sendVoiceOtp(to: string, otp: string, language: string = 'en'): Promise<LaafficVoiceOtpResult> {
    if (!this.enabled) {
      return { success: false, error: 'Laaffic Voice OTP service is disabled' };
    }

    try {
      this.logger.log(`[Laaffic Voice OTP] Calling ${to} with OTP: ${otp}`);

      const ttsText = language === 'en'
        ? `Your Smart Tech verification code is ${otp}. This code expires in 5 minutes.`
        : `Your Smart Tech verification code is ${otp}.`;

      const result = await this.request<{ code: number; data: { taskId: string } }>('/v2/voice/sendCode', {
        appId: this.appId,
        to: to.startsWith('+') ? to : `+${to}`,
        ttsContent: ttsText,
        lang: language,
        playTimes: 2,
      });

      if (result.code === 0 || result.code === 200) {
        this.logger.log(`[Laaffic Voice OTP] Call initiated, taskId: ${result.data?.taskId}`);
        return {
          success: true,
          taskId: result.data?.taskId,
        };
      }

      return { success: false, error: `API error code: ${result.code}` };
    } catch (error) {
      this.logger.error(`[Laaffic Voice OTP] Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async sendVoiceNotification(to: string, message: string, playTimes: number = 1): Promise<LaafficVoiceOtpResult> {
    if (!this.enabled) {
      return { success: false, error: 'Laaffic Voice service is disabled' };
    }

    try {
      this.logger.log(`[Laaffic Voice] Calling ${to}: ${message.substring(0, 50)}...`);

      const result = await this.request<{ code: number; data: { taskId: string } }>('/v2/voice/sendCode', {
        appId: this.appId,
        to: to.startsWith('+') ? to : `+${to}`,
        ttsContent: message,
        playTimes,
      });

      if (result.code === 0 || result.code === 200) {
        this.logger.log(`[Laaffic Voice] Call initiated, taskId: ${result.data?.taskId}`);
        return {
          success: true,
          taskId: result.data?.taskId,
        };
      }

      return { success: false, error: `API error code: ${result.code}` };
    } catch (error) {
      this.logger.error(`[Laaffic Voice] Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async getBalance(): Promise<LaafficBalanceResult> {
    if (!this.enabled) {
      return { success: false, error: 'Laaffic service is disabled' };
    }

    try {
      const result = await this.request<{ code: number; data: { balance: number; currency: string } }>('/v2/account/getBalance', {});

      if (result.code === 0 || result.code === 200) {
        return {
          success: true,
          balance: result.data?.balance,
          currency: result.data?.currency || 'USD',
        };
      }

      return { success: false, error: `API error code: ${result.code}` };
    } catch (error) {
      this.logger.error(`[Laaffic Balance] Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async getSmsReport(taskId: string): Promise<any> {
    if (!this.enabled) {
      return { success: false, error: 'Laaffic service is disabled' };
    }

    try {
      const result = await this.request<{ code: number; data: any }>('/v2/sms/getReport', {
        taskId,
      });

      if (result.code === 0 || result.code === 200) {
        return { success: true, data: result.data };
      }

      return { success: false, error: `API error code: ${result.code}` };
    } catch (error) {
      this.logger.error(`[Laaffic SMS Report] Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  isConfigured(): boolean {
    return this.enabled && !!this.apiKey && !!this.apiSecret && !!this.appId;
  }

  getConfigStatus(): { enabled: boolean; hasApiKey: boolean; hasApiSecret: boolean; hasAppId: boolean } {
    return {
      enabled: this.enabled,
      hasApiKey: !!this.apiKey,
      hasApiSecret: !!this.apiSecret,
      hasAppId: !!this.appId,
    };
  }
}
