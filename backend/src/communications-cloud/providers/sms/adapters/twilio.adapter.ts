import { Logger } from '@nestjs/common';
import { SmsProvider } from '../../../interfaces/provider.interface';
import { SendSmsOptions, SendResult } from '../../../interfaces/message.interface';
import { TwilioService } from '../../../../../twilio/twilio.service';

export class TwilioAdapter implements SmsProvider {
  private readonly logger = new Logger(TwilioAdapter.name);

  constructor(private twilioService: TwilioService) {}

  async send(options: SendSmsOptions): Promise<SendResult> {
    try {
      this.logger.debug(`send: to=${options.to}`);

      const result = await this.twilioService.sendSms(options.to, options.body);

      if (result.success) {
        return {
          success: true,
          provider: 'twilio',
          messageId: result.messageId || `twilio_${Date.now()}`,
          providerMessageId: result.messageId,
          status: (result.status as SendResult['status']) || 'SENT',
          cost: result.cost,
          rawResponse: result,
        };
      }

      return {
        success: false,
        provider: 'twilio',
        messageId: `twilio_failed_${Date.now()}`,
        status: 'FAILED',
        error: result.error || 'Twilio API returned unsuccessful response',
        rawResponse: result,
      };
    } catch (error) {
      this.logger.error(`send failed: ${error.message}`, error.stack);
      return {
        success: false,
        provider: 'twilio',
        messageId: `twilio_error_${Date.now()}`,
        status: 'FAILED',
        error: error.message,
      };
    }
  }

  async healthCheck(): Promise<{ status: string; latencyMs: number; details?: string }> {
    const startTime = Date.now();
    try {
      const result = await this.twilioService.getBalance();
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
    const result = await this.twilioService.getBalance();
    return {
      balance: result.balance ?? 0,
      currency: result.currency || 'USD',
    };
  }
}
