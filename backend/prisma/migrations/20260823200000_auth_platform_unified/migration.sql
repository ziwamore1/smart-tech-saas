-- Document Authentication Platform: unified pipeline models
-- StampInstance = immutable stamp applied to one document
-- DocumentAuthentication = unified record spanning stamp + cryptographic signature
-- AuthVerificationEvent = append-only public verification attempt log

-- CreateTable
CREATE TABLE "StampInstance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "documentVerificationId" TEXT,
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "configSnapshot" JSONB,
    "serialNumber" TEXT,
    "verificationCode" TEXT,
    "renderedSvgHash" TEXT,
    "hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StampInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAuthentication" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "organizationRef" TEXT,
    "documentId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentVersion" INTEGER NOT NULL DEFAULT 1,
    "documentSerial" TEXT,
    "verificationCode" TEXT,
    "originalHash" TEXT,
    "finalHash" TEXT,
    "finalPdfHash" TEXT,
    "stampInstanceId" TEXT,
    "documentVerificationId" TEXT,
    "signatureServiceId" TEXT,
    "signaturesJson" JSONB,
    "signingKeyId" TEXT,
    "signerId" TEXT,
    "issuedBy" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "supersededById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "verificationCount" INTEGER NOT NULL DEFAULT 0,
    "lastVerifiedAt" TIMESTAMP(3),
    "pipelineTrace" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentAuthentication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthVerificationEvent" (
    "id" TEXT NOT NULL,
    "authenticationId" TEXT,
    "code" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthVerificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StampInstance_documentVerificationId_key" ON "StampInstance"("documentVerificationId");

-- CreateIndex
CREATE INDEX "StampInstance_schoolId_status_idx" ON "StampInstance"("schoolId", "status");

-- CreateIndex
CREATE INDEX "StampInstance_templateId_idx" ON "StampInstance"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAuthentication_schoolId_documentId_documentVersion_key" ON "DocumentAuthentication"("schoolId", "documentId", "documentVersion");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAuthentication_documentVerificationId_key" ON "DocumentAuthentication"("documentVerificationId");

-- CreateIndex
CREATE INDEX "DocumentAuthentication_status_idx" ON "DocumentAuthentication"("status");

-- CreateIndex
CREATE INDEX "DocumentAuthentication_documentSerial_idx" ON "DocumentAuthentication"("documentSerial");

-- CreateIndex
CREATE INDEX "AuthVerificationEvent_code_createdAt_idx" ON "AuthVerificationEvent"("code", "createdAt");

-- CreateIndex
CREATE INDEX "AuthVerificationEvent_authenticationId_idx" ON "AuthVerificationEvent"("authenticationId");

-- AddForeignKey
ALTER TABLE "StampInstance" ADD CONSTRAINT "StampInstance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StampInstance" ADD CONSTRAINT "StampInstance_documentVerificationId_fkey" FOREIGN KEY ("documentVerificationId") REFERENCES "DocumentVerification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
