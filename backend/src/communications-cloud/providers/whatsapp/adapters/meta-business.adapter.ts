import { Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import type { WhatsAppProvider } from '../../../interfaces/provider.interface';
import type { SendWhatsAppOptions, SendResult } from '../../../interfaces/message.interface';

export interface MetaBusinessConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
  apiVersion?: string;
}

export class MetaBusinessAdapter implements WhatsAppProvider {
  private readonly logger = new Logger(MetaBusinessAdapter.name);
  private readonly providerName = 'meta';
  private readonly client: AxiosInstance;
  private readonly phoneNumberId: string;
  private readonly businessAccountId?: string;
  private readonly accessToken: string;

  constructor(config: MetaBusinessConfig) {
    this.phoneNumberId = config.phoneNumberId;
    this.businessAccountId = config.businessAccountId;
    this.accessToken = config.accessToken;

    const version = config.apiVersion || 'v22.0';
    this.client = axios.create({
      baseURL: `https://graph.facebook.com/${version}`,
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async send(options: SendWhatsAppOptions): Promise<SendResult> {
    const start = Date.now();
    try {
      this.logger.log(`Sending WhatsApp via Meta to ${options.to}`);

      const body: Record<string, unknown> = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: options.to.replace(/[^0-9]/g, ''),
      };

      if (options.templateId) {
        body.type = 'template';
        body.template = {
          name: options.templateId,
          language: { code: 'en' },
        };
        if (options.templateData) {
          const components: Record<string, unknown>[] = [
            {
              type: 'body',
              parameters: Object.values(options.templateData).map((v) => ({
                type: 'text',
                text: String(v),
              })),
            },
          ];
          if (options.headerMediaUrl) {
            components.unshift({
              type: 'header',
              parameters: [
                {
                  type: 'image',
                  image: { link: options.headerMediaUrl },
                },
              ],
            });
          }
          body.template = { ...(body.template as object), components };
        }
      } else if (options.mediaUrl) {
        body.type = options.mediaType?.startsWith('image/') ? 'image'
          : options.mediaType?.startsWith('video/') ? 'video'
          : options.mediaType?.startsWith('audio/') ? 'audio'
          : options.mediaType?.startsWith('application/') ? 'document'
          : 'text';
        if (body.type === 'text') {
          body.text = { body: options.body, preview_url: options.previewUrl ?? false };
        } else {
          body[body.type as string] = {
            link: options.mediaUrl,
            caption: options.body || undefined,
          };
        }
      } else {
        body.type = 'text';
        body.text = {
          body: options.body,
          preview_url: options.previewUrl ?? false,
        };
      }

      const response = await this.client.post(`/${this.phoneNumberId}/messages`, body);

      const waId = response.data?.messages?.[0]?.id;

      return {
        success: true,
        provider: this.providerName,
        messageId: options.metadata?.id as string || '',
        providerMessageId: waId,
        status: 'SENT',
        rawResponse: response.data,
      };
    } catch (error) {
      const latencyMs = Date.now() - start;
      const errData = error?.response?.data;
      this.logger.error(`Meta WhatsApp send failed: ${errData ? JSON.stringify(errData) : error.message}`);

      return {
        success: false,
        provider: this.providerName,
        messageId: options.metadata?.id as string || '',
        status: 'FAILED',
        error: errData?.error?.message || error.message,
        rawResponse: errData,
      };
    }
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    try {
      if (this.businessAccountId) {
        const response = await this.client.get(`/${this.businessAccountId}`, {
          params: { fields: 'name,id' },
        });
        this.logger.log(`Meta Business Account: ${response.data?.name}`);
      }
    } catch (error) {
      this.logger.warn(`Meta business account check failed: ${error.message}`);
    }
    return { balance: 0, currency: 'USD' };
  }

  async healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }> {
    const start = Date.now();
    try {
      const response = await this.client.get(`/${this.phoneNumberId}`, {
        params: { fields: 'id,name,display_phone_number' },
      });
      const latencyMs = Date.now() - start;
      if (response.data) {
        return {
          status: 'healthy',
          latencyMs,
          details: `Phone: ${response.data.display_phone_number || response.data.name}`,
        };
      }
      return { status: 'degraded', latencyMs, details: 'Unexpected response' };
    } catch (error) {
      const latencyMs = Date.now() - start;
      return {
        status: 'unhealthy',
        latencyMs,
        details: error?.response?.data?.error?.message || error.message,
      };
    }
  }
}
