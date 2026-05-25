import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('laaffic')
export class LaafficWebhookController {
  private readonly logger = new Logger(LaafficWebhookController.name);

  constructor(private prisma: PrismaService) {}

  @Post('webhook/sms')
  handleSmsWebhook(@Body() body: any, @Headers() headers: Record<string, string>) {
    this.logger.log('[SMS Webhook] Received delivery report');
    this.logger.debug(`[SMS Webhook] Payload: ${JSON.stringify(body)}`);

    try {
      const { taskId, to, status, errorCode, errorMsg } = body;

      if (taskId) {
        this.prisma.notificationLog.updateMany({
          where: {
            channel: 'sms',
            message: { contains: taskId },
          },
          data: {
            status: status === 'DELIVRD' ? 'delivered' : status === 'FAILED' ? 'failed' : status.toLowerCase(),
            error: errorCode ? `${errorCode}: ${errorMsg}` : undefined,
          },
        }).catch(err => this.logger.error(`Failed to update notification log: ${err.message}`));
      }

      return { code: 0, message: 'success' };
    } catch (error) {
      this.logger.error(`[SMS Webhook] Error: ${error.message}`);
      return { code: 1, message: error.message };
    }
  }

  @Post('webhook/voice')
  handleVoiceWebhook(@Body() body: any) {
    this.logger.log('[Voice Webhook] Received call report');
    this.logger.debug(`[Voice Webhook] Payload: ${JSON.stringify(body)}`);

    try {
      const { taskId, to, status, duration, errorCode } = body;

      if (taskId) {
        this.prisma.notificationLog.updateMany({
          where: {
            channel: 'voice',
            message: { contains: taskId },
          },
          data: {
            status: status === 'answered' ? 'delivered' : status.toLowerCase(),
            error: errorCode ? `Error code: ${errorCode}` : undefined,
          },
        }).catch(err => this.logger.error(`Failed to update notification log: ${err.message}`));
      }

      return { code: 0, message: 'success' };
    } catch (error) {
      this.logger.error(`[Voice Webhook] Error: ${error.message}`);
      return { code: 1, message: error.message };
    }
  }

  @Post('webhook/whatsapp')
  handleWhatsAppWebhook(@Body() body: any) {
    this.logger.log('[WhatsApp Webhook] Received delivery report');
    this.logger.debug(`[WhatsApp Webhook] Payload: ${JSON.stringify(body)}`);

    try {
      const { messageId, to, status, errorCode } = body;

      if (messageId) {
        this.prisma.notificationLog.updateMany({
          where: {
            channel: 'whatsapp',
            message: { contains: messageId },
          },
          data: {
            status: status === 'read' || status === 'delivered' ? 'delivered' : status.toLowerCase(),
            error: errorCode ? `Error code: ${errorCode}` : undefined,
          },
        }).catch(err => this.logger.error(`Failed to update notification log: ${err.message}`));
      }

      return { code: 0, message: 'success' };
    } catch (error) {
      this.logger.error(`[WhatsApp Webhook] Error: ${error.message}`);
      return { code: 1, message: error.message };
    }
  }
}
