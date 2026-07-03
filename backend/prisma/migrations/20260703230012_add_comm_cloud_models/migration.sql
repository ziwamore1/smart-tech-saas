-- CreateEnum
CREATE TYPE "CommCloudChannel" AS ENUM ('SMS', 'EMAIL', 'WHATSAPP', 'PUSH', 'IN_APP');

-- CreateEnum
CREATE TYPE "CommCloudMessageStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'READ', 'OPENED', 'CLICKED', 'CANCELLED', 'SCHEDULED');

-- CreateTable
CREATE TABLE "CommCloudProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CommCloudChannel" NOT NULL,
    "providerType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "credentials" JSONB,
    "capabilities" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastError" TEXT,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "avgLatencyMs" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "costPerMessage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "rateLimit" INTEGER NOT NULL DEFAULT 10,
    "maxConcurrent" INTEGER NOT NULL DEFAULT 5,
    "config" JSONB,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommCloudProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommCloudRoutingRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CommCloudChannel" NOT NULL,
    "ruleType" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB,
    "providerOrder" TEXT[],
    "preferredProviderId" TEXT,
    "fallbackProviderIds" TEXT[],
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "retryDelayMs" INTEGER NOT NULL DEFAULT 2000,
    "retryBackoff" TEXT NOT NULL DEFAULT 'exponential',
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommCloudRoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommCloudMessage" (
    "id" TEXT NOT NULL,
    "channel" "CommCloudChannel" NOT NULL,
    "messageType" TEXT NOT NULL,
    "status" "CommCloudMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "senderId" TEXT,
    "senderIdentity" TEXT,
    "recipient" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientMetadata" JSONB,
    "subject" TEXT,
    "body" TEXT,
    "htmlBody" TEXT,
    "templateId" TEXT,
    "templateData" JSONB,
    "attachments" JSONB,
    "metadata" JSONB,
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "providerId" TEXT,
    "providerName" TEXT,
    "providerMessageId" TEXT,
    "cost" DOUBLE PRECISION,
    "currency" TEXT,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "schoolId" TEXT,
    "userId" TEXT,
    "createdById" TEXT,
    "batchId" TEXT,
    "inAppNotificationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommCloudMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommCloudDeliveryLog" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "providerId" TEXT,
    "providerName" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "event" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusCode" TEXT,
    "description" TEXT,
    "cost" DOUBLE PRECISION,
    "latencyMs" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "rawResponse" JSONB,
    "errorDetails" JSONB,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommCloudDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommCloudCreditWallet" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "smsBalance" INTEGER NOT NULL DEFAULT 0,
    "emailBalance" INTEGER NOT NULL DEFAULT 0,
    "whatsappBalance" INTEGER NOT NULL DEFAULT 0,
    "pushBalance" INTEGER NOT NULL DEFAULT 0,
    "prepaidBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "monthlyLimit" DOUBLE PRECISION,
    "overageAllowed" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommCloudCreditWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommCloudBillingTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "channel" "CommCloudChannel",
    "units" INTEGER,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "balanceBefore" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "invoiceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "performedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommCloudBillingTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommCloudTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CommCloudChannel" NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "htmlBody" TEXT,
    "variables" JSONB,
    "whatsappTemplateId" TEXT,
    "whatsappNamespace" TEXT,
    "whatsappLanguage" TEXT NOT NULL DEFAULT 'en_US',
    "headerType" TEXT,
    "headerMediaUrl" TEXT,
    "footerText" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'platform',
    "schoolId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "tags" TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommCloudTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommCloudSenderIdentity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CommCloudChannel" NOT NULL,
    "senderId" TEXT,
    "senderName" TEXT,
    "senderEmail" TEXT,
    "senderPhone" TEXT,
    "businessAccountId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "scope" TEXT NOT NULL DEFAULT 'platform',
    "schoolId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommCloudSenderIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommCloudAnalytics" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "channel" "CommCloudChannel" NOT NULL,
    "schoolId" TEXT,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "totalBounced" INTEGER NOT NULL DEFAULT 0,
    "totalRead" INTEGER NOT NULL DEFAULT 0,
    "totalOpened" INTEGER NOT NULL DEFAULT 0,
    "totalClicked" INTEGER NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCreditsUsed" INTEGER NOT NULL DEFAULT 0,
    "avgLatencyMs" DOUBLE PRECISION,
    "deliveryRate" DOUBLE PRECISION,
    "failureRate" DOUBLE PRECISION,
    "byProvider" JSONB,
    "byCountry" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommCloudAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommCloudWebhookEvent" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "rawPayload" JSONB,
    "messageId" TEXT,
    "providerMessageId" TEXT,
    "status" TEXT,
    "statusCode" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommCloudWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommCloud" (
    "id" TEXT NOT NULL,
    "platformName" TEXT NOT NULL DEFAULT 'SmartTech Communications Cloud',
    "platformEmail" TEXT,
    "platformPhone" TEXT,
    "platformWebsite" TEXT,
    "defaultSmsSenderId" TEXT,
    "defaultEmailSender" TEXT,
    "defaultEmailName" TEXT,
    "defaultWhatsAppSender" TEXT,
    "defaultRoutingStrategy" TEXT NOT NULL DEFAULT 'priority',
    "brandingConfig" JSONB,
    "allowSchoolProviders" BOOLEAN NOT NULL DEFAULT false,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "autoRetryFailed" BOOLEAN NOT NULL DEFAULT true,
    "maxRetryAttempts" INTEGER NOT NULL DEFAULT 3,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommCloud_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommCloudProvider_channel_idx" ON "CommCloudProvider"("channel");

-- CreateIndex
CREATE INDEX "CommCloudProvider_providerType_idx" ON "CommCloudProvider"("providerType");

-- CreateIndex
CREATE INDEX "CommCloudProvider_isActive_idx" ON "CommCloudProvider"("isActive");

-- CreateIndex
CREATE INDEX "CommCloudProvider_priority_idx" ON "CommCloudProvider"("priority");

-- CreateIndex
CREATE INDEX "CommCloudProvider_status_idx" ON "CommCloudProvider"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CommCloudProvider_name_channel_key" ON "CommCloudProvider"("name", "channel");

-- CreateIndex
CREATE INDEX "CommCloudRoutingRule_channel_idx" ON "CommCloudRoutingRule"("channel");

-- CreateIndex
CREATE INDEX "CommCloudRoutingRule_ruleType_idx" ON "CommCloudRoutingRule"("ruleType");

-- CreateIndex
CREATE INDEX "CommCloudRoutingRule_isActive_idx" ON "CommCloudRoutingRule"("isActive");

-- CreateIndex
CREATE INDEX "CommCloudMessage_channel_idx" ON "CommCloudMessage"("channel");

-- CreateIndex
CREATE INDEX "CommCloudMessage_status_idx" ON "CommCloudMessage"("status");

-- CreateIndex
CREATE INDEX "CommCloudMessage_schoolId_idx" ON "CommCloudMessage"("schoolId");

-- CreateIndex
CREATE INDEX "CommCloudMessage_userId_idx" ON "CommCloudMessage"("userId");

-- CreateIndex
CREATE INDEX "CommCloudMessage_providerId_idx" ON "CommCloudMessage"("providerId");

-- CreateIndex
CREATE INDEX "CommCloudMessage_batchId_idx" ON "CommCloudMessage"("batchId");

-- CreateIndex
CREATE INDEX "CommCloudMessage_createdAt_idx" ON "CommCloudMessage"("createdAt");

-- CreateIndex
CREATE INDEX "CommCloudMessage_scheduledAt_idx" ON "CommCloudMessage"("scheduledAt");

-- CreateIndex
CREATE INDEX "CommCloudMessage_recipient_idx" ON "CommCloudMessage"("recipient");

-- CreateIndex
CREATE INDEX "CommCloudDeliveryLog_messageId_idx" ON "CommCloudDeliveryLog"("messageId");

-- CreateIndex
CREATE INDEX "CommCloudDeliveryLog_providerId_idx" ON "CommCloudDeliveryLog"("providerId");

-- CreateIndex
CREATE INDEX "CommCloudDeliveryLog_event_idx" ON "CommCloudDeliveryLog"("event");

-- CreateIndex
CREATE INDEX "CommCloudDeliveryLog_status_idx" ON "CommCloudDeliveryLog"("status");

-- CreateIndex
CREATE INDEX "CommCloudDeliveryLog_loggedAt_idx" ON "CommCloudDeliveryLog"("loggedAt");

-- CreateIndex
CREATE INDEX "CommCloudCreditWallet_ownerType_idx" ON "CommCloudCreditWallet"("ownerType");

-- CreateIndex
CREATE INDEX "CommCloudCreditWallet_ownerId_idx" ON "CommCloudCreditWallet"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "CommCloudCreditWallet_ownerType_ownerId_key" ON "CommCloudCreditWallet"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "CommCloudBillingTransaction_walletId_idx" ON "CommCloudBillingTransaction"("walletId");

-- CreateIndex
CREATE INDEX "CommCloudBillingTransaction_transactionType_idx" ON "CommCloudBillingTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "CommCloudBillingTransaction_channel_idx" ON "CommCloudBillingTransaction"("channel");

-- CreateIndex
CREATE INDEX "CommCloudBillingTransaction_status_idx" ON "CommCloudBillingTransaction"("status");

-- CreateIndex
CREATE INDEX "CommCloudBillingTransaction_createdAt_idx" ON "CommCloudBillingTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "CommCloudTemplate_channel_idx" ON "CommCloudTemplate"("channel");

-- CreateIndex
CREATE INDEX "CommCloudTemplate_type_idx" ON "CommCloudTemplate"("type");

-- CreateIndex
CREATE INDEX "CommCloudTemplate_scope_idx" ON "CommCloudTemplate"("scope");

-- CreateIndex
CREATE INDEX "CommCloudTemplate_schoolId_idx" ON "CommCloudTemplate"("schoolId");

-- CreateIndex
CREATE INDEX "CommCloudTemplate_isActive_idx" ON "CommCloudTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CommCloudTemplate_name_channel_scope_schoolId_key" ON "CommCloudTemplate"("name", "channel", "scope", "schoolId");

-- CreateIndex
CREATE INDEX "CommCloudSenderIdentity_channel_idx" ON "CommCloudSenderIdentity"("channel");

-- CreateIndex
CREATE INDEX "CommCloudSenderIdentity_scope_idx" ON "CommCloudSenderIdentity"("scope");

-- CreateIndex
CREATE INDEX "CommCloudSenderIdentity_schoolId_idx" ON "CommCloudSenderIdentity"("schoolId");

-- CreateIndex
CREATE INDEX "CommCloudSenderIdentity_isActive_idx" ON "CommCloudSenderIdentity"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CommCloudSenderIdentity_name_channel_scope_schoolId_key" ON "CommCloudSenderIdentity"("name", "channel", "scope", "schoolId");

-- CreateIndex
CREATE INDEX "CommCloudAnalytics_period_idx" ON "CommCloudAnalytics"("period");

-- CreateIndex
CREATE INDEX "CommCloudAnalytics_periodStart_idx" ON "CommCloudAnalytics"("periodStart");

-- CreateIndex
CREATE INDEX "CommCloudAnalytics_channel_idx" ON "CommCloudAnalytics"("channel");

-- CreateIndex
CREATE INDEX "CommCloudAnalytics_schoolId_idx" ON "CommCloudAnalytics"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "CommCloudAnalytics_period_periodStart_channel_schoolId_key" ON "CommCloudAnalytics"("period", "periodStart", "channel", "schoolId");

-- CreateIndex
CREATE INDEX "CommCloudWebhookEvent_providerId_idx" ON "CommCloudWebhookEvent"("providerId");

-- CreateIndex
CREATE INDEX "CommCloudWebhookEvent_eventType_idx" ON "CommCloudWebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "CommCloudWebhookEvent_processed_idx" ON "CommCloudWebhookEvent"("processed");

-- CreateIndex
CREATE INDEX "CommCloudWebhookEvent_createdAt_idx" ON "CommCloudWebhookEvent"("createdAt");

-- CreateIndex
CREATE INDEX "CommCloud_platformName_idx" ON "CommCloud"("platformName");

-- AddForeignKey
ALTER TABLE "CommCloudRoutingRule" ADD CONSTRAINT "CommCloudRoutingRule_preferredProviderId_fkey" FOREIGN KEY ("preferredProviderId") REFERENCES "CommCloudProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommCloudDeliveryLog" ADD CONSTRAINT "CommCloudDeliveryLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CommCloudMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommCloudDeliveryLog" ADD CONSTRAINT "CommCloudDeliveryLog_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "CommCloudProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommCloudBillingTransaction" ADD CONSTRAINT "CommCloudBillingTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CommCloudCreditWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
