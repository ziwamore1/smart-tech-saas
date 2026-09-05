import { Logger } from '@nestjs/common';
import axios from 'axios';
import { SmsProvider } from '../../../interfaces/provider.interface';
import { SendSmsOptions, SendResult } from '../../../interfaces/message.interface';

export interface ZamtelBulkSmsConfig {
  apiKey: string;
  senderId?: string;
  baseUrl?: string;
}

/**
 * Zamtel Bulk SMS gateway — https://bulksms.zamtel.co.zm
 *
 * Official (documented in the platform's own API guide and confirmed live) contract:
 *   Base URL: https://bulksms.zamtel.co.zm/api/
 *   POST /v3/action/send    Send SMS  (Authorization: Bearer <api_key>)
 *   GET  /v3/sms/balance    SMS credit balance (Authorization: Bearer <api_key>)
 *   GET  /sms/balance?key=<api_key>  (legacy)
 *
 * The API key is sent in the `Authorization: Bearer` header and NEVER embedded in the URL.
 * The previous implementation used a fabricated `/api/v2.1/action/send/api_key/...` scheme
 * that the server answered with the SPA index.html (HTTP 200), so every send was reported as
 * "successful" and the balance always parsed to 0.
 */
export class ZamtelBulkSmsAdapter implements SmsProvider {
  private readonly logger = new Logger(ZamtelBulkSmsAdapter.name);
  private readonly apiBase: string;
  private readonly apiKey: string;
  private readonly senderId: string;

  constructor(config: ZamtelBulkSmsConfig) {
    this.apiKey = config.apiKey;
    this.apiBase = (config.baseUrl || 'https://bulksms.zamtel.co.zm/api').replace(/\/+$/, '');
    this.senderId = config.senderId || 'SMARTTECH';
  }

  private normalizePhone(to: string): string {
    const digits = String(to || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return '260' + digits.slice(1);
    if (digits.startsWith('260')) return digits;
    return '260' + digits;
  }

  async send(options: SendSmsOptions): Promise<SendResult> {
    try {
      this.logger.debug(`ZamtelBulkSms send: to=${options.to}`);

      const phone = this.normalizePhone(options.to);
      if (!phone) {
        return {
          success: false,
          provider: 'zamtel-bulk',
          messageId: `zamtel_bulk_failed_${Date.now()}`,
          status: 'FAILED',
          error: 'Invalid recipient phone number',
        };
      }

      const payload = {
        sender_id: options.senderId || this.senderId,
        contacts: phone,
        message: options.body,
      };

      const response = await axios.post(`${this.apiBase}/v3/action/send`, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      const data: any = response.data;
      const errorText = data?.responseText || data?.message || data?.error || '';
      const ok =
        response.status >= 200 &&
        response.status < 300 &&
        data?.success !== false &&
        !data?.error &&
        !/invalid|denied|failed|blocked|insufficient/i.test(String(errorText));

      if (ok) {
        return {
          success: true,
          provider: 'zamtel-bulk',
          messageId: `zamtel_bulk_${data?.request_id || data?.message_id || data?.id || Date.now()}`,
          providerMessageId: data?.request_id || data?.message_id || data?.id,
          status: 'SENT',
          cost: data?.cost ? parseFloat(data.cost) : undefined,
          currency: 'ZMW',
          rawResponse: data,
        };
      }

      return {
        success: false,
        provider: 'zamtel-bulk',
        messageId: `zamtel_bulk_failed_${Date.now()}`,
        status: 'FAILED',
        error: errorText || `Zamtel rejected the request (HTTP ${response.status})`,
        rawResponse: data,
      };
    } catch (error) {
      this.logger.error(`ZamtelBulkSms send failed: ${(error as any)?.response?.data?.responseText || (error as any)?.message}`);
      return {
        success: false,
        provider: 'zamtel-bulk',
        messageId: `zamtel_bulk_error_${Date.now()}`,
        status: 'FAILED',
        error:
          (error as any)?.response?.data?.responseText ||
          (error as any)?.response?.data?.message ||
          (error as any)?.response?.data?.error ||
          (error as any).message,
        rawResponse: (error as any)?.response?.data,
      };
    }
  }

  async healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }> {
    const startTime = Date.now();
    try {
      const balance = await this.getBalance();
      return { status: 'ok', latencyMs: Date.now() - startTime, details: `${balance.balance} SMS credits available` };
    } catch (error) {
      return { status: 'down', latencyMs: Date.now() - startTime, details: (error as Error).message };
    }
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    try {
      const response = await axios.get(`${this.apiBase}/v3/sms/balance`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: 10000,
      });

      const data: any = response.data;
      if (data && typeof data === 'object') {
        const balance = Number(data?.sms_balance ?? data?.balance ?? data?.responseObject?.sms_balance ?? data?.data?.sms_balance ?? data?.data?.balance);
        if (!Number.isNaN(balance) && data?.success !== false) {
          return { balance, currency: data?.currency || 'ZMW' };
        }
        throw new Error(data?.responseText || data?.message || `Balance response was not parseable: ${JSON.stringify(data)}`);
      }

      // Legacy plain-text response (e.g. "972" or "972 SMS credits").
      const textMatch = String(data ?? '').match(/(\d+(?:\.\d+)?)/);
      if (textMatch) return { balance: parseFloat(textMatch[1]), currency: 'ZMW' };
      throw new Error(`Unexpected balance response: ${JSON.stringify(data)}`);
    } catch (error: any) {
      // Fall back to the legacy query-string endpoint if v3 is not available on this deployment.
      if (error?.response?.status === 404 || error?.response?.status === 405) {
        try {
          const legacy = await axios.get(`${this.apiBase}/sms/balance`, {
            params: { key: this.apiKey },
            timeout: 10000,
          });
          const legacyData: any = legacy.data;
          const balance =
            Number(
              legacyData?.sms_balance ??
              legacyData?.balance ??
              legacyData?.data?.sms_balance ??
              legacyData?.data?.balance ??
              (typeof legacyData === 'string' ? legacyData.match(/(\d+(?:\.\d+)?)/)?.[1] : undefined),
            );
          if (!Number.isNaN(balance)) return { balance, currency: legacyData?.currency || 'ZMW' };
        } catch (legacyError) {
          this.logger.error(`ZamtelBulkSms legacy getBalance failed: ${(legacyError as Error).message}`);
        }
      }
      this.logger.error(`ZamtelBulkSms getBalance failed: ${error?.response?.data?.responseText || error?.message}`);
      throw error;
    }
  }
}