CREATE TABLE IF NOT EXISTS "StudentLeadershipAppointment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "schoolId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "classId" TEXT, "roleCode" TEXT NOT NULL, "roleTitle" TEXT NOT NULL,
  "institutionTier" TEXT NOT NULL DEFAULT 'SECONDARY_SCHOOL', "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3), "status" TEXT NOT NULL DEFAULT 'ACTIVE', "appointedBy" TEXT NOT NULL,
  "recommendation" TEXT, "totalPoints" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentLeadershipAppointment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentLeadershipAppointment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentLeadershipAppointment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentLeadershipAppointment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "StudentLeadershipAppointment_schoolId_roleCode_status_idx" ON "StudentLeadershipAppointment"("schoolId", "roleCode", "status");
CREATE INDEX IF NOT EXISTS "StudentLeadershipAppointment_studentId_startDate_idx" ON "StudentLeadershipAppointment"("studentId", "startDate");

CREATE TABLE IF NOT EXISTS "StudentLeadershipDuty" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "appointmentId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT, "pointsPossible" INTEGER NOT NULL DEFAULT 10, "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "completedAt" TIMESTAMP(3), "verifiedBy" TEXT, "evidence" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentLeadershipDuty_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentLeadershipDuty_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "StudentLeadershipAppointment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "StudentLeadershipDuty_appointmentId_status_idx" ON "StudentLeadershipDuty"("appointmentId", "status");

CREATE TABLE IF NOT EXISTS "StudentSportsParticipation" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(), "schoolId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "sportCategory" TEXT NOT NULL, "eventLevel" TEXT NOT NULL DEFAULT 'SCHOOL', "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3), "status" TEXT NOT NULL DEFAULT 'ACTIVE', "teacherRecommended" BOOLEAN NOT NULL DEFAULT false,
  "recommendedBy" TEXT, "recommendation" TEXT, "pointsAwarded" INTEGER NOT NULL DEFAULT 0, "evidence" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentSportsParticipation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentSportsParticipation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentSportsParticipation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "StudentSportsParticipation_schoolId_sportCategory_status_idx" ON "StudentSportsParticipation"("schoolId", "sportCategory", "status");
CREATE INDEX IF NOT EXISTS "StudentSportsParticipation_studentId_teacherRecommended_idx" ON "StudentSportsParticipation"("studentId", "teacherRecommended");
