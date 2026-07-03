import { Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import type { PushProvider } from '../../../interfaces/provider.interface';
import type { SendPushOptions, SendResult } from '../../../interfaces/message.interface';

export interface ExpoConfig {
  accessToken?: string;
}

interface ExpoPushMessage {
  to: string | string[];
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: string;
  badge?: number;
  channelId?: string;
  icon?: string;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number;
  expiration?: number;
  display?: 'default' | 'system';
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: Record<string, unknown>;
}

interface ExpoPushResponse {
  data: ExpoPushTicket[];
  errors?: Array<{ code: string; message: string }>;
}

export class ExpoAdapter implements PushProvider {
  private readonly logger = new Logger(ExpoAdapter.name);
  private readonly providerName = 'expo';
  private readonly client: AxiosInstance;

  constructor(config: ExpoConfig = {}) {
    this.client = axios.create({
      baseURL: 'https://exp.host/--/api/v2',
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(config.accessToken ? { 'Authorization': `Bearer ${config.accessToken}` } : {}),
      },
    });
  }

  async send(options: SendPushOptions): Promise<SendResult> {
    try {
      this.logger.log(`Sending push via Expo to ${Array.isArray(options.to) ? options.to.length : 1} recipient(s)`);

      const messages: ExpoPushMessage[] = (Array.isArray(options.to) ? options.to : [options.to]).map((token) => ({
        to: token,
        title: options.title,
        body: options.body,
        data: options.data as Record<string, unknown> | undefined,
        sound: options.sound || 'default',
        badge: options.badge,
        channelId: options.channelId,
        icon: options.icon,
        priority: options.priority === 'HIGH' || options.priority === 'CRITICAL' ? 'high'
          : options.priority === 'LOW' ? 'default'
          : 'normal',
        ttl: 2419200,
        display: 'default',
      }));

      const response = await this.client.post<ExpoPushResponse>('/push/send', messages);

      const tickets = response.data?.data || [];
      const successCount = tickets.filter((t) => t.status === 'ok').length;
      const errors = tickets.filter((t) => t.status === 'error');

      return {
        success: successCount > 0,
        provider: this.providerName,
        messageId: options.metadata?.id as string || '',
        providerMessageId: tickets.find((t) => t.id)?.id,
        status: successCount > 0 ? 'SENT' : 'FAILED',
        creditsUsed: successCount,
        error: errors.length > 0 ? errors.map((e) => e.message).join('; ') : undefined,
        rawResponse: response.data,
      };
    } catch (error) {
      const errData = error?.response?.data;
      this.logger.error(`Expo send failed: ${errData ? JSON.stringify(errData) : error.message}`);
      return {
        success: false,
        provider: this.providerName,
        messageId: options.metadata?.id as string || '',
        status: 'FAILED',
        error: errData?.errors?.[0]?.message || error.message,
        rawResponse: errData,
      };
    }
  }

  async healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }> {
    const start = Date.now();
    try {
      const response = await this.client.get('/push/getReceipts', {
        params: { ticketIds: 'healthcheck' },
        validateStatus: (status) => status < 500,
      });
      const latencyMs = Date.now() - start;
      return {
        status: 'healthy',
        latencyMs,
        details: 'Expo Push API reachable',
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      return { status: 'unhealthy', latencyMs, details: error.message };
    }
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    return { balance: 0, currency: 'N/A' };
  }
}
