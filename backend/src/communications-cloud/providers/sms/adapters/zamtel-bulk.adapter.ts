import { Logger } from '@nestjs/common';
import axios from 'axios';
import { SmsProvider } from '../../../interfaces/provider.interface';
import { SendSmsOptions, SendResult } from '../../../interfaces/message.interface';

export interface ZamtelBulkSmsConfig {
  apiKey: string;
  senderId?: string;
  baseUrl?: string;
}

export class ZamtelBulkSmsAdapter implements SmsProvider {
  private readonly logger = new Logger(ZamtelBulkSmsAdapter.name);
  private readonly apiBase: string;
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly apiVersion = 'v2.1';

  constructor(config: ZamtelBulkSmsConfig) {
    this.apiKey = config.apiKey;
    this.apiBase = (config.baseUrl || 'https://bulksms.zamtel.co.zm').replace(/\/+$/, '');
    this.senderId = config.senderId || 'SMARTTECH';
  }

  async send(options: SendSmsOptions): Promise<SendResult> {
    try {
      this.logger.debug(`ZamtelBulkSms send: to=${options.to}`);

      const phone = options.to.replace(/^\+/, '').replace(/^0/, '260');
      const contacts = `[${phone}]`;
      const sender = options.senderId || this.senderId;

      const url = `${this.apiBase}/api/${this.apiVersion}/action/send/api_key/${this.apiKey}/contacts/${encodeURIComponent(contacts)}/senderId/${encodeURIComponent(sender)}/message/${encodeURIComponent(options.body)}`;

      const response = await axios.get(url, { timeout: 15000 });

      const data = response.data;

      if (response.status >= 200 && response.status < 300 && !data?.error) {
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
      await axios.get(
        `${this.apiBase}/api/${this.apiVersion}/action/balance/api_key/${this.apiKey}`,
        { timeout: 10000 },
      );
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
      const response = await axios.get(
        `${this.apiBase}/api/${this.apiVersion}/action/balance/api_key/${this.apiKey}`,
        { timeout: 10000 },
      );

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
