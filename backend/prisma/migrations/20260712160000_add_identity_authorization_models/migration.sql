-- CreateSchema: public

-- CreateTable: SchoolRoleAssignment
CREATE TABLE "SchoolRoleAssignment" (
    "id" TEXT NOT NULL,
    "schoolMembershipId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlatformRoleAssignment
CREATE TABLE "PlatformRoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ClassTeacherAssignment
CREATE TABLE "ClassTeacherAssignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassTeacherAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DepartmentAssignment
CREATE TABLE "DepartmentAssignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "position" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ClubAssignment
CREATE TABLE "ClubAssignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "clubName" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "role" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CommitteeAssignment
CREATE TABLE "CommitteeAssignment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "committeeName" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "role" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitteeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: SchoolRoleAssignment
CREATE INDEX "SchoolRoleAssignment_schoolMembershipId_idx" ON "SchoolRoleAssignment"("schoolMembershipId");

-- CreateIndex: SchoolRoleAssignment
CREATE INDEX "SchoolRoleAssignment_role_idx" ON "SchoolRoleAssignment"("role");

-- CreateIndex: SchoolRoleAssignment
CREATE INDEX "SchoolRoleAssignment_isActive_idx" ON "SchoolRoleAssignment"("isActive");

-- CreateIndex: PlatformRoleAssignment
CREATE UNIQUE INDEX "PlatformRoleAssignment_userId_role_key" ON "PlatformRoleAssignment"("userId", "role");

-- CreateIndex: PlatformRoleAssignment
CREATE INDEX "PlatformRoleAssignment_userId_idx" ON "PlatformRoleAssignment"("userId");

-- CreateIndex: ClassTeacherAssignment
CREATE UNIQUE INDEX "ClassTeacherAssignment_teacherId_classId_academicYearId_key" ON "ClassTeacherAssignment"("teacherId", "classId", "academicYearId");

-- CreateIndex: ClassTeacherAssignment
CREATE INDEX "ClassTeacherAssignment_classId_academicYearId_idx" ON "ClassTeacherAssignment"("classId", "academicYearId");

-- CreateIndex: ClassTeacherAssignment
CREATE INDEX "ClassTeacherAssignment_teacherId_idx" ON "ClassTeacherAssignment"("teacherId");

-- CreateIndex: DepartmentAssignment
CREATE INDEX "DepartmentAssignment_teacherId_schoolId_idx" ON "DepartmentAssignment"("teacherId", "schoolId");

-- CreateIndex: DepartmentAssignment
CREATE INDEX "DepartmentAssignment_departmentId_idx" ON "DepartmentAssignment"("departmentId");

-- CreateIndex: ClubAssignment
CREATE INDEX "ClubAssignment_teacherId_schoolId_idx" ON "ClubAssignment"("teacherId", "schoolId");

-- CreateIndex: CommitteeAssignment
CREATE INDEX "CommitteeAssignment_teacherId_schoolId_idx" ON "CommitteeAssignment"("teacherId", "schoolId");

-- AddForeignKey: SchoolRoleAssignment -> SchoolUser
ALTER TABLE "SchoolRoleAssignment" ADD CONSTRAINT "SchoolRoleAssignment_schoolMembershipId_fkey" FOREIGN KEY ("schoolMembershipId") REFERENCES "SchoolUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: SchoolRoleAssignment -> User
ALTER TABLE "SchoolRoleAssignment" ADD CONSTRAINT "SchoolRoleAssignment_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: PlatformRoleAssignment -> User
ALTER TABLE "PlatformRoleAssignment" ADD CONSTRAINT "PlatformRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ClassTeacherAssignment -> User
ALTER TABLE "ClassTeacherAssignment" ADD CONSTRAINT "ClassTeacherAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: ClassTeacherAssignment -> Class
ALTER TABLE "ClassTeacherAssignment" ADD CONSTRAINT "ClassTeacherAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: ClassTeacherAssignment -> AcademicYear
ALTER TABLE "ClassTeacherAssignment" ADD CONSTRAINT "ClassTeacherAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: ClassTeacherAssignment -> School
ALTER TABLE "ClassTeacherAssignment" ADD CONSTRAINT "ClassTeacherAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: DepartmentAssignment -> User
ALTER TABLE "DepartmentAssignment" ADD CONSTRAINT "DepartmentAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: DepartmentAssignment -> Department
ALTER TABLE "DepartmentAssignment" ADD CONSTRAINT "DepartmentAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: DepartmentAssignment -> School
ALTER TABLE "DepartmentAssignment" ADD CONSTRAINT "DepartmentAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: ClubAssignment -> User
ALTER TABLE "ClubAssignment" ADD CONSTRAINT "ClubAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: ClubAssignment -> School
ALTER TABLE "ClubAssignment" ADD CONSTRAINT "ClubAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CommitteeAssignment -> User
ALTER TABLE "CommitteeAssignment" ADD CONSTRAINT "CommitteeAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: CommitteeAssignment -> School
ALTER TABLE "CommitteeAssignment" ADD CONSTRAINT "CommitteeAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
