import { Controller, Post, Body, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('beem')
export class BeemWebhookController {
  private readonly logger = new Logger(BeemWebhookController.name);

  constructor(private prisma: PrismaService) {}

  @Post('webhook/sms')
  handleSmsWebhook(@Body() body: any) {
    this.logger.log('[Beem SMS Webhook] Received delivery report');
    this.logger.debug(`[Beem SMS Webhook] Payload: ${JSON.stringify(body)}`);

    try {
      const { message_id, recipient_id, dest_addr, status, error } = body;

      if (message_id) {
        this.prisma.notificationLog.updateMany({
          where: {
            channel: 'sms',
            message: { contains: message_id },
          },
          data: {
            status: status === 'DELIVRD' || status === 'sent' || status === 'delivered' ? 'delivered' : status === 'FAILED' || status === 'failed' ? 'failed' : (status || 'sent').toLowerCase(),
            error: error || undefined,
          },
        }).catch(err => this.logger.error(`Failed to update notification log: ${err.message}`));
      }

      return { code: 0, message: 'success' };
    } catch (error) {
      this.logger.error(`[Beem SMS Webhook] Error: ${error.message}`);
      return { code: 1, message: error.message };
    }
  }

  @Post('webhook/whatsapp')
  handleWhatsAppWebhook(@Body() body: any) {
    this.logger.log('[Beem WhatsApp Webhook] Received delivery report');
    this.logger.debug(`[Beem WhatsApp Webhook] Payload: ${JSON.stringify(body)}`);

    try {
      const { messageId, to, status, error } = body;

      if (messageId) {
        this.prisma.notificationLog.updateMany({
          where: {
            channel: 'whatsapp',
            message: { contains: messageId },
          },
          data: {
            status: status === 'read' || status === 'delivered' ? 'delivered' : (status || 'sent').toLowerCase(),
            error: error || undefined,
          },
        }).catch(err => this.logger.error(`Failed to update notification log: ${err.message}`));
      }

      return { code: 0, message: 'success' };
    } catch (error) {
      this.logger.error(`[Beem WhatsApp Webhook] Error: ${error.message}`);
      return { code: 1, message: error.message };
    }
  }
}
