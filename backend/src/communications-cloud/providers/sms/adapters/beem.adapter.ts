import { Logger } from '@nestjs/common';
import { SmsProvider } from '../../../interfaces/provider.interface';
import { SendSmsOptions, SendResult } from '../../../interfaces/message.interface';
import { BeemService } from '../../../../../beem/beem.service';

export class BeemAdapter implements SmsProvider {
  private readonly logger = new Logger(BeemAdapter.name);

  constructor(private beemService: BeemService) {}

  async send(options: SendSmsOptions): Promise<SendResult> {
    const startTime = Date.now();
    try {
      this.logger.debug(`send: to=${options.to}`);

      const result = await this.beemService.sendSms(options.to, options.body);

      if (result.success) {
        return {
          success: true,
          provider: 'beem',
          messageId: result.messageId || `beem_${Date.now()}`,
          providerMessageId: result.messageId,
          status: (result.status as SendResult['status']) || 'SENT',
          rawResponse: result,
        };
      }

      return {
        success: false,
        provider: 'beem',
        messageId: `beem_failed_${Date.now()}`,
        status: 'FAILED',
        error: result.error || 'Beem API returned unsuccessful response',
        rawResponse: result,
      };
    } catch (error) {
      this.logger.error(`send failed: ${error.message}`, error.stack);
      return {
        success: false,
        provider: 'beem',
        messageId: `beem_error_${Date.now()}`,
        status: 'FAILED',
        error: error.message,
      };
    }
  }

  async healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }> {
    const startTime = Date.now();
    try {
      const result = await this.beemService.getBalance();
      const latencyMs = Date.now() - startTime;

      if (result.success) {
        return { status: 'ok', latencyMs };
      }

      return {
        status: 'degraded',
        latencyMs,
        details: result.error || 'Balance check returned unsuccessful',
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - startTime,
        details: error.message,
      };
    }
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    const result = await this.beemService.getBalance();
    return {
      balance: result.balance ?? 0,
      currency: result.currency || 'TZS',
    };
  }
}
