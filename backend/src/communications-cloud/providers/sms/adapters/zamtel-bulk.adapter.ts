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
 * Zamtel Bulk SMS adapter using the bulk SMS API.
 * Compatible with the zamtel-smsjs npm package.
 * API: https://bulksms.zamtel.co.zm/api/v2.1/action/send/
 */
export class ZamtelBulkSmsAdapter implements SmsProvider {
  private readonly logger = new Logger(ZamtelBulkSmsAdapter.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly senderId: string;

  constructor(config: ZamtelBulkSmsConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://bulksms.zamtel.co.zm').replace(/\/+$/, '');
    this.senderId = config.senderId || 'SMARTTECH';
  }

  private get authHeaders(): Record<string, string> {
    return {
      Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  async send(options: SendSmsOptions): Promise<SendResult> {
    try {
      this.logger.debug(`ZamtelBulkSms send: to=${options.to}`);

      const phone = options.to.replace(/^\+/, '').replace(/^0/, '260');

      const params = new URLSearchParams();
      params.append('sender', options.senderId || this.senderId);
      params.append('message', options.body);
      params.append('recipients', phone);

      const response = await axios.post(
        `${this.baseUrl}/api/v2.1/action/send/`,
        params.toString(),
        {
          headers: this.authHeaders,
          timeout: 15000,
        },
      );

      const data = response.data;

      if (data?.status === 'success' || data?.successful === true || data?.code === 200) {
        return {
          success: true,
          provider: 'zamtel-bulk',
          messageId: `zamtel_bulk_${data?.message_id || data?.request_id || Date.now()}`,
          providerMessageId: data?.message_id || data?.request_id,
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
        error: data?.error || data?.message || 'Unknown error',
        rawResponse: data,
      };
    } catch (error) {
      this.logger.error(`ZamtelBulkSms send failed: ${error.message}`);
      return {
        success: false,
        provider: 'zamtel-bulk',
        messageId: `zamtel_bulk_error_${Date.now()}`,
        status: 'FAILED',
        error: error.response?.data?.error || error.response?.data?.message || error.message,
        rawResponse: error.response?.data,
      };
    }
  }

  async healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }> {
    const startTime = Date.now();
    try {
      await axios.get(`${this.baseUrl}/api/v2.1/action/balance/`, {
        headers: this.authHeaders,
        timeout: 10000,
      });
      return { status: 'ok', latencyMs: Date.now() - startTime };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - startTime,
        details: error.message,
      };
    }
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v2.1/action/balance/`, {
        headers: this.authHeaders,
        timeout: 10000,
      });

      const data = response.data;
      return {
        balance: data?.balance ?? data?.data?.balance ?? 0,
        currency: data?.currency || 'ZMW',
      };
    } catch (error) {
      this.logger.error(`ZamtelBulkSms getBalance failed: ${error.message}`);
      throw error;
    }
  }
}
