import { Logger } from '@nestjs/common';
import axios from 'axios';
import { SmsProvider } from '../../../interfaces/provider.interface';
import { SendSmsOptions, SendResult } from '../../../interfaces/message.interface';

export interface ZamtelConfig {
  apiKey: string;
  baseUrl?: string;
  senderId?: string;
}

export class ZamtelAdapter implements SmsProvider {
  private readonly logger = new Logger(ZamtelAdapter.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly senderId: string;

  constructor(config: ZamtelConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://api.zamtel.zm').replace(/\/+$/, '');
    this.senderId = config.senderId || 'SMARTTECH';
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async send(options: SendSmsOptions): Promise<SendResult> {
    try {
      this.logger.debug(`send: to=${options.to}`);

      const response = await axios.post(
        `${this.baseUrl}/api/v1/sms/send`,
        {
          from: options.senderId || this.senderId,
          to: options.to,
          message: options.body,
        },
        {
          headers: this.headers,
          timeout: 15000,
        },
      );

      const data = response.data;

      if (data?.status === 'success' || data?.success || data?.code === 200) {
        return {
          success: true,
          provider: 'zamtel',
          messageId: `zamtel_${data?.messageId || data?.id || Date.now()}`,
          providerMessageId: data?.messageId || data?.id,
          status: 'SENT',
          cost: data?.cost ? parseFloat(data.cost) : undefined,
          currency: 'ZMW',
          rawResponse: data,
        };
      }

      return {
        success: false,
        provider: 'zamtel',
        messageId: `zamtel_failed_${Date.now()}`,
        status: 'FAILED',
        error: data?.error || data?.message || 'Unknown error',
        rawResponse: data,
      };
    } catch (error) {
      this.logger.error(`send failed: ${error.message}`);
      return {
        success: false,
        provider: 'zamtel',
        messageId: `zamtel_error_${Date.now()}`,
        status: 'FAILED',
        error: error.response?.data?.error || error.response?.data?.message || error.message,
        rawResponse: error.response?.data,
      };
    }
  }

  async healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }> {
    const startTime = Date.now();
    try {
      await axios.get(`${this.baseUrl}/api/v1/health`, {
        headers: this.headers,
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
      const response = await axios.get(`${this.baseUrl}/api/v1/account/balance`, {
        headers: this.headers,
        timeout: 10000,
      });

      const data = response.data;
      return {
        balance: data?.balance ?? data?.data?.balance ?? 0,
        currency: data?.currency || 'ZMW',
      };
    } catch (error) {
      this.logger.error(`getBalance failed: ${error.message}`);
      throw error;
    }
  }
}
