import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueuesService } from '../queues/queues.service';
import { CommunicationsCloudController } from './communications-cloud.controller';
import { CommunicationsCloudService } from './communications-cloud.service';
import { RoutingEngineService } from './routing/routing-engine.service';
import { RoutingRulesService } from './routing/routing-rules.service';
import { RoutingRulesController } from './routing/routing-rules.controller';
import { CommunicationQueueService } from './queue/communication-queue.service';
import { CommunicationQueueController } from './queue/communication-queue.controller';
import { CommunicationQueueWorker } from './queue/communication-queue.worker';
import { DeliveryTrackingService } from './delivery/delivery-tracking.service';
import { DeliveryTrackingController } from './delivery/delivery-tracking.controller';
import { CreditWalletService } from './billing/credit-wallet.service';
import { BillingService } from './billing/billing.service';
import { BillingController } from './billing/billing.controller';
import { CommunicationsAnalyticsService } from './analytics/communications-analytics.service';
import { CommunicationsAnalyticsController } from './analytics/communications-analytics.controller';
import { AuditLogService } from './security/audit-log.service';
import { EncryptionService } from './security/encryption.service';
import { SmsProviderFactory } from './providers/sms/sms-provider.factory';
import { EmailProviderFactory } from './providers/email/email-provider.factory';
import { WhatsAppProviderFactory } from './providers/whatsapp/whatsapp-provider.factory';
import { PushProviderFactory } from './providers/push/push-provider.factory';
import { ProviderManagementService } from './provider-management/provider-management.service';
import { ProviderManagementController } from './provider-management/provider-management.controller';
import { TemplateLibraryService } from './templates/template-library.service';
import { TemplateLibraryController } from './templates/template-library.controller';
import { SenderIdentityService } from './sender-identity/sender-identity.service';
import { SenderIdentityController } from './sender-identity/sender-identity.controller';
import { GenericWebhookController } from './webhooks/generic-webhook.controller';

@Module({
  controllers: [
    CommunicationsCloudController,
    DeliveryTrackingController,
    BillingController,
    CommunicationsAnalyticsController,
    ProviderManagementController,
    TemplateLibraryController,
    SenderIdentityController,
    GenericWebhookController,
    RoutingRulesController,
    CommunicationQueueController,
  ],
  providers: [
    CommunicationsCloudService,
    PrismaService,
    QueuesService,
    RoutingEngineService,
    RoutingRulesService,
    CommunicationQueueService,
    CommunicationQueueWorker,
    DeliveryTrackingService,
    CreditWalletService,
    BillingService,
    CommunicationsAnalyticsService,
    AuditLogService,
    EncryptionService,
    SmsProviderFactory,
    EmailProviderFactory,
    WhatsAppProviderFactory,
    PushProviderFactory,
    ProviderManagementService,
    TemplateLibraryService,
    SenderIdentityService,
  ],
  exports: [CommunicationsCloudService, SmsProviderFactory],
})
export class CommunicationsCloudModule {}
