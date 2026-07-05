import { Logger } from '@nestjs/common';
import type { WhatsAppProvider } from '../../../interfaces/provider.interface';
import type { SendWhatsAppOptions, SendResult } from '../../../interfaces/message.interface';
import { BeemService, type BeemWhatsAppPayload } from '../../../../beem/beem.service';

export class BeemWhatsAppAdapter implements WhatsAppProvider {
  private readonly logger = new Logger(BeemWhatsAppAdapter.name);
  private readonly providerName = 'beem';

  constructor(private readonly beemService: BeemService) {}

  async send(options: SendWhatsAppOptions): Promise<SendResult> {
    const start = Date.now();
    try {
      this.logger.log(`Sending WhatsApp via Beem to ${options.to}`);

      const waPayload: BeemWhatsAppPayload = {
        body: options.body,
        templateId: options.templateId,
        templateData: options.templateData,
        mediaUrl: options.mediaUrl,
        mediaType: options.mediaType,
      };

      const result = await this.beemService.sendWhatsApp(options.to, options.body, waPayload);

      if (result.success) {
        return {
          success: true,
          provider: this.providerName,
          messageId: options.metadata?.id as string || '',
          providerMessageId: result.messageId,
          status: 'SENT',
          rawResponse: result,
        };
      }

      return {
        success: false,
        provider: this.providerName,
        messageId: options.metadata?.id as string || '',
        status: 'FAILED',
        error: result.error || 'Unknown Beem WhatsApp error',
        rawResponse: result,
      };
    } catch (error) {
      this.logger.error(`Beem WhatsApp send failed: ${error.message}`);
      return {
        success: false,
        provider: this.providerName,
        messageId: options.metadata?.id as string || '',
        status: 'FAILED',
        error: error.message,
      };
    }
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    try {
      const result = await this.beemService.getBalance();
      if (result.success && result.balance !== undefined) {
        return { balance: result.balance, currency: result.currency || 'TZS' };
      }
      return { balance: 0, currency: 'TZS' };
    } catch (error) {
      this.logger.error(`Beem balance check failed: ${error.message}`);
      return { balance: 0, currency: 'TZS' };
    }
  }

  async healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }> {
    const start = Date.now();
    try {
      const config = this.beemService.getConfigStatus();
      if (!config.enabled) {
        return { status: 'unhealthy', latencyMs: Date.now() - start, details: 'Beem disabled' };
      }
      if (!config.hasWhatsAppFrom) {
        return { status: 'unhealthy', latencyMs: Date.now() - start, details: 'BEEM_WHATSAPP_FROM not set' };
      }
      if (!config.hasApiKey || !config.hasSecretKey) {
        return { status: 'unhealthy', latencyMs: Date.now() - start, details: 'Missing API credentials' };
      }
      return { status: 'healthy', latencyMs: Date.now() - start, details: `Configured - from: ${config.senderName}` };
    } catch (error) {
      const latencyMs = Date.now() - start;
      return { status: 'unhealthy', latencyMs, details: error.message };
    }
  }
}
