import { Controller, Post, Body, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('twilio')
export class TwilioWebhookController {
  private readonly logger = new Logger(TwilioWebhookController.name);

  constructor(private prisma: PrismaService) {}

  @Post('webhook/sms')
  handleSmsWebhook(@Body() body: any) {
    this.logger.log('[Twilio SMS Webhook] Received status callback');
    this.logger.debug(`[Twilio SMS Webhook] Payload: ${JSON.stringify(body)}`);

    try {
      const {
        MessageSid,
        MessageStatus,
        To,
        ErrorCode,
        ErrorMessage,
      } = body;

      if (MessageSid) {
        const statusMap: Record<string, string> = {
          queued: 'pending',
          sent: 'sent',
          delivered: 'delivered',
          undelivered: 'failed',
          failed: 'failed',
          canceled: 'failed',
          accepted: 'pending',
          scheduled: 'pending',
          read: 'delivered',
          partially_delivered: 'delivered',
        };

        this.prisma.notificationLog
          .updateMany({
            where: {
              channel: 'sms',
              message: { contains: MessageSid },
            },
            data: {
              status: statusMap[MessageStatus] || 'sent',
              error: ErrorMessage || ErrorCode ? `Error ${ErrorCode}: ${ErrorMessage}` : undefined,
            },
          })
          .catch((err) => this.logger.error(`Failed to update notification log: ${err.message}`));
      }

      return { code: 0, message: 'success' };
    } catch (error) {
      this.logger.error(`[Twilio SMS Webhook] Error: ${error.message}`);
      return { code: 1, message: error.message };
    }
  }
}
