import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Identity & Authorization Data Migration ===\n');

  // Step 1: Ensure all users with schoolId have a SchoolUser record
  console.log('Step 1: Creating SchoolUser records for users with schoolId...');
  const usersWithSchool = await prisma.user.findMany({
    where: {
      schoolId: { not: null },
      schoolUsers: { none: {} },
    },
    select: { id: true, schoolId: true },
  });

  for (const user of usersWithSchool) {
    await prisma.schoolUser.create({
      data: {
        userId: user.id,
        schoolId: user.schoolId!,
        isPrimary: true,
      },
    });
  }
  console.log(`  Created ${usersWithSchool.length} SchoolUser records\n`);

  // Step 2: Create SchoolRoleAssignment from existing UserRole + User.schoolId
  console.log('Step 2: Creating SchoolRoleAssignment from existing UserRole...');
  const userRoles = await prisma.userRole.findMany({
    include: { role: true, user: { select: { schoolId: true } } },
    where: { user: { schoolId: { not: null } } },
  });

  // School-level roles that should become SchoolRoleAssignment
  const schoolRoles = ['Director', 'Deputy Director', 'Head Teacher', 'Deputy', 'Teacher', 'Class Teacher', 'HOD', 'Accountant', 'Secretary', 'Lower Primary Senior Teacher', 'Upper Primary Senior Teacher'];
  let schoolRoleCount = 0;

  for (const ur of userRoles) {
    if (!schoolRoles.includes(ur.role.name)) continue;
    if (!ur.user.schoolId) continue;

    // Find the SchoolUser record
    const membership = await prisma.schoolUser.findFirst({
      where: { userId: ur.userId, schoolId: ur.user.schoolId },
    });

    if (!membership) continue;

    // Check if assignment already exists
    const existing = await prisma.schoolRoleAssignment.findFirst({
      where: {
        schoolMembershipId: membership.id,
        role: ur.role.name,
      },
    });

    if (existing) continue;

    await prisma.schoolRoleAssignment.create({
      data: {
        schoolMembershipId: membership.id,
        role: ur.role.name,
        isActive: true,
      },
    });
    schoolRoleCount++;
  }
  console.log(`  Created ${schoolRoleCount} SchoolRoleAssignment records\n`);

  // Step 3: Create PlatformRoleAssignment for SuperAdmin users
  console.log('Step 3: Creating PlatformRoleAssignment for SuperAdmin users...');
  const superAdminRole = await prisma.role.findFirst({
    where: { name: { equals: 'SuperAdmin', mode: 'insensitive' } },
  });

  let platformRoleCount = 0;
  if (superAdminRole) {
    const superAdminUserRoles = await prisma.userRole.findMany({
      where: { roleId: superAdminRole.id },
      select: { userId: true },
    });

    for (const ur of superAdminUserRoles) {
      const existing = await prisma.platformRoleAssignment.findFirst({
        where: { userId: ur.userId, role: 'SuperAdmin' },
      });

      if (existing) continue;

      await prisma.platformRoleAssignment.create({
        data: {
          userId: ur.userId,
          role: 'SuperAdmin',
          isActive: true,
        },
      });
      platformRoleCount++;
    }
  }
  console.log(`  Created ${platformRoleCount} PlatformRoleAssignment records\n`);

  // Step 4: Create ClassTeacherAssignment from Class.classTeacherId
  console.log('Step 4: Creating ClassTeacherAssignment from Class.classTeacherId...');
  const classesWithTeacher = await prisma.class.findMany({
    where: { classTeacherId: { not: null } },
    select: {
      id: true,
      classTeacherId: true,
      schoolId: true,
    },
  });

  // Get current academic year for each school
  let classTeacherCount = 0;
  for (const cls of classesWithTeacher) {
    if (!cls.classTeacherId) continue;

    const currentYear = await prisma.academicYear.findFirst({
      where: { schoolId: cls.schoolId, isCurrent: true },
    });

    if (!currentYear) continue;

    // Check if assignment already exists
    const existing = await prisma.classTeacherAssignment.findFirst({
      where: {
        teacherId: cls.classTeacherId,
        classId: cls.id,
        academicYearId: currentYear.id,
      },
    });

    if (existing) continue;

    await prisma.classTeacherAssignment.create({
      data: {
        teacherId: cls.classTeacherId,
        classId: cls.id,
        academicYearId: currentYear.id,
        schoolId: cls.schoolId,
        isPrimary: true,
        isActive: true,
      },
    });
    classTeacherCount++;
  }
  console.log(`  Created ${classTeacherCount} ClassTeacherAssignment records\n`);

  // Step 5: Create DepartmentAssignment from Teacher.departmentId
  console.log('Step 5: Creating DepartmentAssignment from Teacher.departmentId...');
  const teachersWithDept = await prisma.teacher.findMany({
    where: { departmentId: { not: null } },
    select: {
      id: true,
      userId: true,
      departmentId: true,
      schoolId: true,
      department: true,
    },
  });

  let deptAssignmentCount = 0;
  for (const teacher of teachersWithDept) {
    if (!teacher.departmentId) continue;

    const existing = await prisma.departmentAssignment.findFirst({
      where: {
        teacherId: teacher.userId,
        departmentId: teacher.departmentId,
        isActive: true,
      },
    });

    if (existing) continue;

    await prisma.departmentAssignment.create({
      data: {
        teacherId: teacher.userId,
        departmentId: teacher.departmentId,
        schoolId: teacher.schoolId,
        position: teacher.department || undefined,
        isActive: true,
      },
    });
    deptAssignmentCount++;
  }
  console.log(`  Created ${deptAssignmentCount} DepartmentAssignment records\n`);

  console.log('=== Migration Complete ===');
  console.log(`Summary:`);
  console.log(`  SchoolUser records: ${usersWithSchool.length}`);
  console.log(`  SchoolRoleAssignment records: ${schoolRoleCount}`);
  console.log(`  PlatformRoleAssignment records: ${platformRoleCount}`);
  console.log(`  ClassTeacherAssignment records: ${classTeacherCount}`);
  console.log(`  DepartmentAssignment records: ${deptAssignmentCount}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('Migration failed:', e);
    prisma.$disconnect();
    process.exit(1);
  });
