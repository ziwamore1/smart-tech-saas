-- CreateTable
CREATE TABLE "SchoolRegistrationRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "directorUserId" TEXT,
    "schoolName" TEXT NOT NULL,
    "directorFirstName" TEXT NOT NULL,
    "directorLastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "institutionType" TEXT NOT NULL,
    "registrationPurpose" TEXT,
    "expectedLearners" INTEGER,
    "contactPreference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "ownerNotes" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolRegistrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolRegistrationMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "senderEmail" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolRegistrationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolRegistrationRequest_schoolId_key" ON "SchoolRegistrationRequest"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolRegistrationRequest_status_idx" ON "SchoolRegistrationRequest"("status");

-- CreateIndex
CREATE INDEX "SchoolRegistrationRequest_email_idx" ON "SchoolRegistrationRequest"("email");

-- CreateIndex
CREATE INDEX "SchoolRegistrationRequest_createdAt_idx" ON "SchoolRegistrationRequest"("createdAt");

-- CreateIndex
CREATE INDEX "SchoolRegistrationMessage_requestId_createdAt_idx" ON "SchoolRegistrationMessage"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "SchoolRegistrationRequest" ADD CONSTRAINT "SchoolRegistrationRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolRegistrationMessage" ADD CONSTRAINT "SchoolRegistrationMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SchoolRegistrationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;