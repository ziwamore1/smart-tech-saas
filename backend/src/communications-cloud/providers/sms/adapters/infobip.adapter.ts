import { Logger } from '@nestjs/common';
import axios from 'axios';
import { SmsProvider } from '../../../interfaces/provider.interface';
import { SendSmsOptions, SendResult } from '../../../interfaces/message.interface';

export interface InfobipConfig {
  apiKey: string;
  baseUrl: string;
  from?: string;
}

export class InfobipAdapter implements SmsProvider {
  private readonly logger = new Logger(InfobipAdapter.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly from: string;

  constructor(config: InfobipConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.from = config.from || 'SMARTTECH';
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `App ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async send(options: SendSmsOptions): Promise<SendResult> {
    try {
      this.logger.debug(`send: to=${options.to}`);

      const response = await axios.post(
        `${this.baseUrl}/sms/2/text/advanced`,
        {
          messages: [
            {
              from: options.senderId || this.from,
              destinations: [{ to: options.to }],
              text: options.body,
            },
          ],
        },
        {
          headers: this.headers,
          timeout: 15000,
        },
      );

      const message = response.data?.messages?.[0];

      if (message?.status?.groupName === 'PENDING' || message?.status?.groupId === 1) {
        return {
          success: true,
          provider: 'infobip',
          messageId: `ib_${message.messageId || Date.now()}`,
          providerMessageId: message.messageId,
          status: 'SENT',
          rawResponse: response.data,
        };
      }

      return {
        success: false,
        provider: 'infobip',
        messageId: `ib_failed_${Date.now()}`,
        status: 'FAILED',
        error: message?.status?.description || 'Unknown error',
        rawResponse: response.data,
      };
    } catch (error) {
      this.logger.error(`send failed: ${error.message}`);
      return {
        success: false,
        provider: 'infobip',
        messageId: `ib_error_${Date.now()}`,
        status: 'FAILED',
        error: error.response?.data?.requestError?.serviceException?.text || error.message,
        rawResponse: error.response?.data,
      };
    }
  }

  async healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }> {
    const startTime = Date.now();
    try {
      await axios.get(`${this.baseUrl}/sms/1/reports?limit=1`, {
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
      const response = await axios.get(`${this.baseUrl}/account/1/balance`, {
        headers: this.headers,
        timeout: 10000,
      });

      return {
        balance: response.data?.balance ?? 0,
        currency: response.data?.currency || 'USD',
      };
    } catch (error) {
      this.logger.error(`getBalance failed: ${error.message}`);
      throw error;
    }
  }
}
