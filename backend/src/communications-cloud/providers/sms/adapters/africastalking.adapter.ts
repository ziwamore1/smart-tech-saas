import { Logger } from '@nestjs/common';
import axios from 'axios';
import { SmsProvider } from '../../../interfaces/provider.interface';
import { SendSmsOptions, SendResult } from '../../../interfaces/message.interface';

export interface AfricasTalkingConfig {
  apiKey: string;
  username: string;
  from?: string;
}

export class AfricasTalkingAdapter implements SmsProvider {
  private readonly logger = new Logger(AfricasTalkingAdapter.name);
  private readonly baseUrl = 'https://api.africastalking.com';
  private readonly apiKey: string;
  private readonly username: string;
  private readonly from: string;

  constructor(config: AfricasTalkingConfig) {
    this.apiKey = config.apiKey;
    this.username = config.username;
    this.from = config.from || 'SMARTTECH';
  }

  async send(options: SendSmsOptions): Promise<SendResult> {
    const startTime = Date.now();
    try {
      this.logger.debug(`send: to=${options.to}`);

      const response = await axios.post(
        `${this.baseUrl}/version1/messaging`,
        new URLSearchParams({
          username: this.username,
          to: options.to,
          message: options.body,
          from: options.senderId || this.from,
        }).toString(),
        {
          headers: {
            apiKey: this.apiKey,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          timeout: 15000,
        },
      );

      const data = response.data?.SMSMessageData;
      const recipient = data?.Recipients?.[0];

      if (recipient?.status === 'Success' || recipient?.status === 'Submitted') {
        return {
          success: true,
          provider: 'africastalking',
          messageId: `at_${recipient.messageId || Date.now()}`,
          providerMessageId: recipient.messageId,
          status: 'SENT',
          cost: recipient.cost ? parseFloat(recipient.cost) : undefined,
          currency: 'KES',
          rawResponse: data,
        };
      }

      return {
        success: false,
        provider: 'africastalking',
        messageId: `at_failed_${Date.now()}`,
        status: 'FAILED',
        error: recipient?.status || data?.Message || 'Unknown error',
        rawResponse: data,
      };
    } catch (error) {
      this.logger.error(`send failed: ${error.message}`);
      return {
        success: false,
        provider: 'africastalking',
        messageId: `at_error_${Date.now()}`,
        status: 'FAILED',
        error: error.response?.data?.message || error.message,
        rawResponse: error.response?.data,
      };
    }
  }

  async healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }> {
    const startTime = Date.now();
    try {
      await axios.get(`${this.baseUrl}/version1/user`, {
        headers: {
          apiKey: this.apiKey,
          Accept: 'application/json',
        },
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
      const response = await axios.get(`${this.baseUrl}/version1/user`, {
        headers: {
          apiKey: this.apiKey,
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      const balanceStr: string = response.data?.UserData?.balance || '0';
      const match = balanceStr.match(/^([\d.]+)\s*(\w+)?/);

      return {
        balance: match ? parseFloat(match[1]) : 0,
        currency: match?.[2] || 'KES',
      };
    } catch (error) {
      this.logger.error(`getBalance failed: ${error.message}`);
      throw error;
    }
  }
}
