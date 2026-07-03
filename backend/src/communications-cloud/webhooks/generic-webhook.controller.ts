import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Headers,
  HttpCode,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { DeliveryTrackingService } from '../delivery/delivery-tracking.service';

@Controller('communications-cloud/webhooks')
export class GenericWebhookController {
  private readonly logger = new Logger(GenericWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryTrackingService: DeliveryTrackingService,
  ) {}

  @Get('events')
  @UseGuards(JwtAuthGuard)
  async getWebhookEvents(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('provider') provider?: string,
    @Query('processed') processed?: string,
  ) {
    const where: any = {};
    if (provider) where.providerName = provider;
    if (processed !== undefined) where.processed = processed === 'true';

    const [events, total] = await Promise.all([
      this.prisma.commCloudWebhookEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit, 10) : 50,
        skip: offset ? parseInt(offset, 10) : 0,
      }),
      this.prisma.commCloudWebhookEvent.count({ where }),
    ]);

    return { events, total };
  }

  @Post('delivery/:providerName')
  @HttpCode(200)
  async handleDeliveryWebhook(
    @Param('providerName') providerName: string,
    @Body() payload: any,
    @Headers() headers: any,
  ) {
    this.logger.log(`Webhook received from ${providerName}`);

    await this.prisma.commCloudWebhookEvent
      .create({
        data: {
          providerName,
          providerId: '',
          eventType: 'delivery_receipt',
          rawPayload: payload,
        },
      })
      .catch((err) => this.logger.error('Failed to log webhook event', err));

    switch (providerName.toLowerCase()) {
      case 'twilio':
        return this.handleTwilioWebhook(payload, headers);
      case 'beem':
        return this.handleBeemWebhook(payload);
      case 'africastalking':
        return this.handleAfricaTalkingWebhook(payload);
      case 'infobip':
        return this.handleInfobipWebhook(payload);
      case 'sendgrid':
        return this.handleSendGridWebhook(payload, headers);
      case 'mailgun':
        return this.handleMailgunWebhook(payload, headers);
      default:
        this.logger.warn(`Unknown provider: ${providerName}`);
        return { received: true };
    }
  }

  private async handleTwilioWebhook(payload: any, headers: any) {
    const signature = headers['x-twilio-signature'] as string | undefined;
    const url = headers['x-forwarded-proto']
      ? `${headers['x-forwarded-proto']}://${headers.host}/communications-cloud/webhooks/delivery/twilio`
      : `https://${headers.host}/communications-cloud/webhooks/delivery/twilio`;

    if (!this.verifyTwilioSignature(url, payload, signature)) {
      this.logger.warn('Invalid Twilio webhook signature');
    }

    const messageSid = payload.MessageSid;
    const status = payload.MessageStatus;
    const errorCode = payload.ErrorCode;
    const errorMessage = payload.ErrorMessage;

    if (messageSid) {
      const event = this.mapTwilioEvent(status);
      await this.deliveryTrackingService.updateDeliveryStatus(
        messageSid,
        event,
        {
          statusCode: errorCode,
          description: errorMessage,
        },
      );
    }

    return { code: 0, message: 'success' };
  }

  private verifyTwilioSignature(url: string, payload: any, signature: string | undefined): boolean {
    if (!signature) return false;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      this.logger.warn('TWILIO_AUTH_TOKEN not set, skipping signature verification');
      return true;
    }
    const sortedKeys = Object.keys(payload).sort();
    const params = sortedKeys.map((key) => `${key}${payload[key]}`).join('');
    const sigStr = url + params;
    const expected = createHmac('sha1', authToken).update(sigStr).digest('base64');
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  private async handleBeemWebhook(payload: any) {
    const messageId = payload.message_id || payload.request_id || payload.recipient_id;
    const status = payload.status;

    if (messageId) {
      const event = this.mapBeemEvent(status);
      await this.deliveryTrackingService.updateDeliveryStatus(
        messageId,
        event,
        {
          statusCode: payload.error,
          description: typeof payload.error === 'string' ? payload.error : undefined,
        },
      );
    }

    return { code: 0, message: 'success' };
  }

  private async handleAfricaTalkingWebhook(payload: any) {
    const entries = payload?.deliveryReport?.entries || [];

    for (const entry of entries) {
      const messageId = entry.id || entry.messageId;
      const status = entry.status;
      const failureReason = entry.failureReason;

      if (messageId) {
        const event = this.mapAfricaTalkingEvent(status);
        await this.deliveryTrackingService.updateDeliveryStatus(
          messageId,
          event,
          { description: failureReason },
        );
      }
    }

    return { received: true };
  }

  private async handleInfobipWebhook(payload: any) {
    const results = payload.results || [];

    for (const result of results) {
      const messageId = result.messageId;
      const status = result.status;

      if (messageId) {
        const event = this.mapInfobipEvent(status);
        await this.deliveryTrackingService.updateDeliveryStatus(
          messageId,
          event,
          {
            statusCode: `${status?.groupId ?? ''}`,
            description: status?.description || status?.name,
            cost: result.price?.pricePerMessage,
          },
        );
      }
    }

    return { received: true };
  }

  private async handleSendGridWebhook(payload: any, headers: any) {
    const signature = headers['x-twilio-email-event-webhook-signature'] as string | undefined;
    const timestamp = headers['x-twilio-email-event-webhook-timestamp'] as string | undefined;

    if (!this.verifySendGridSignature(payload, signature, timestamp)) {
      this.logger.warn('Invalid SendGrid webhook signature');
    }

    const events = Array.isArray(payload) ? payload : [];

    for (const event of events) {
      const messageId = event.sg_message_id || event.sg_event_id;
      const eventName = event.event;
      const reason = event.reason;
      const response = event.response;

      if (messageId) {
        const mappedEvent = this.mapSendGridEvent(eventName);
        await this.deliveryTrackingService.updateDeliveryStatus(
          messageId,
          mappedEvent,
          {
            description: reason || response,
            rawResponse: event,
          },
        );
      }
    }

    return { received: true };
  }

  private verifySendGridSignature(
    payload: any,
    signature: string | undefined,
    timestamp: string | undefined,
  ): boolean {
    if (!signature || !timestamp) return false;
    const verificationKey = process.env.SENDGRID_VERIFICATION_KEY;
    if (!verificationKey) {
      this.logger.warn('SENDGRID_VERIFICATION_KEY not set, skipping signature verification');
      return true;
    }
    const payloadStr = `${timestamp}${JSON.stringify(payload)}`;
    const expected = createHmac('sha256', verificationKey).update(payloadStr).digest('base64');
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  private async handleMailgunWebhook(payload: any, headers: any) {
    const signature = payload.signature;

    if (!this.verifyMailgunSignature(signature)) {
      this.logger.warn('Invalid Mailgun webhook signature');
    }

    const eventData = payload['event-data'];
    if (!eventData) return { received: true };

    const messageId = eventData.message?.headers?.['message-id'] || eventData.id;
    const event = eventData.event;
    const deliveryStatus = eventData['delivery-status'];
    const severity = eventData.severity;
    const reason = deliveryStatus?.message || deliveryStatus?.description || eventData.reason;

    if (messageId) {
      const mappedEvent = this.mapMailgunEvent(event, severity);
      await this.deliveryTrackingService.updateDeliveryStatus(
        messageId,
        mappedEvent,
        { description: reason, rawResponse: eventData },
      );
    }

    return { received: true };
  }

  private verifyMailgunSignature(signature: any): boolean {
    if (!signature) return false;
    const { timestamp, token, signature: sig } = signature;
    if (!timestamp || !token || !sig) return false;

    const apiKey = process.env.MAILGUN_API_KEY;
    if (!apiKey) {
      this.logger.warn('MAILGUN_API_KEY not set, skipping signature verification');
      return true;
    }

    const encoded = createHmac('sha256', apiKey)
      .update(`${timestamp}${token}`)
      .digest('hex');

    try {
      return timingSafeEqual(Buffer.from(encoded), Buffer.from(sig));
    } catch {
      return false;
    }
  }

  private mapTwilioEvent(status: string): string {
    const map: Record<string, string> = {
      queued: 'queued',
      accepted: 'queued',
      scheduled: 'queued',
      sending: 'sent',
      sent: 'sent',
      delivered: 'delivered',
      undelivered: 'failed',
      failed: 'failed',
      canceled: 'failed',
      read: 'read',
      partially_delivered: 'delivered',
    };
    return map[status?.toLowerCase()] || 'sent';
  }

  private mapBeemEvent(status: string): string {
    const map: Record<string, string> = {
      pending: 'queued',
      sent: 'sent',
      delivered: 'delivered',
      DELIVRD: 'delivered',
      failed: 'failed',
      FAILED: 'failed',
      rejected: 'failed',
      REJECTD: 'failed',
      expired: 'failed',
      undelivered: 'failed',
    };
    return map[status] || map[status?.toLowerCase()] || 'sent';
  }

  private mapAfricaTalkingEvent(status: string): string {
    const map: Record<string, string> = {
      submitted: 'sent',
      success: 'delivered',
      sent: 'sent',
      failed: 'failed',
      rejected: 'failed',
      expired: 'failed',
      undeliverable: 'failed',
      absent: 'failed',
      buffered: 'sent',
    };
    return map[status?.toLowerCase()] || 'sent';
  }

  private mapInfobipEvent(status: any): string {
    const groupId = status?.groupId;
    const groupName = status?.groupName?.toLowerCase();

    if (groupId === 1 || groupName === 'pending') return 'queued';
    if (groupId === 2 || groupName === 'undeliverable') return 'failed';
    if (groupId === 3 || groupName === 'delivered') return 'delivered';
    if (groupId === 4 || groupName === 'expired') return 'failed';
    if (groupId === 5 || groupName === 'rejected') return 'failed';
    if (groupName === 'sent') return 'sent';

    return status?.name?.toLowerCase() || 'sent';
  }

  private mapSendGridEvent(event: string): string {
    const map: Record<string, string> = {
      processed: 'sent',
      deferred: 'sent',
      delivered: 'delivered',
      open: 'opened',
      click: 'clicked',
      bounce: 'bounced',
      dropped: 'failed',
      spamreport: 'failed',
      unsubscribe: 'failed',
      group_unsubscribe: 'failed',
      group_resubscribe: 'queued',
    };
    return map[event?.toLowerCase()] || event?.toLowerCase() || 'sent';
  }

  private mapMailgunEvent(event: string, severity?: string): string {
    const lower = event?.toLowerCase();

    if (lower === 'delivered') return 'delivered';
    if (lower === 'opened') return 'opened';
    if (lower === 'clicked') return 'clicked';
    if (lower === 'accepted') return 'sent';
    if (lower === 'stored') return 'sent';
    if (lower === 'failed') return severity === 'temporary' ? 'sent' : 'failed';
    if (lower === 'bounced') return 'bounced';
    if (lower === 'complained') return 'failed';
    if (lower === 'unsubscribed') return 'failed';
    if (lower === 'rejected') return 'rejected';

    return lower || 'sent';
  }
}
