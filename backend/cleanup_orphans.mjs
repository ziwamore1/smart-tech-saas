import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const email = 'nteddy262@gmail.com';
const user = await prisma.user.findUnique({
  where: { email },
  include: { userRoles: { include: { role: true } } },
});
if (!user) { console.log('User not found'); process.exit(0); }

const isSuperAdmin = user.userRoles.some(r => r.role.name === 'SuperAdmin');
if (user.schoolId || isSuperAdmin) {
  console.log('User has school or is super admin — not deleting automatically.');
  console.log('User:', user.id, user.email, user.firstName, user.lastName, 'schoolId:', user.schoolId);
  await prisma.$disconnect();
  process.exit(0);
}

console.log('Deleting orphaned user:', user.id, user.email, user.firstName, user.lastName);

const teacher = await prisma.teacher.findUnique({ where: { userId: user.id } });
if (teacher) {
  await prisma.actingPosition.deleteMany({ where: { teacherId: teacher.id } });
  await prisma.lessonRequirement.deleteMany({ where: { teacherId: teacher.id } });
  await prisma.timetableSlot.deleteMany({ where: { teacherId: teacher.id } });
  await prisma.teacher.delete({ where: { id: teacher.id } });
}
await prisma.teachingAssignment.deleteMany({ where: { teacherId: user.id } });
await prisma.userRole.deleteMany({ where: { userId: user.id } });
await prisma.user.delete({ where: { id: user.id } });
console.log('Deleted successfully. You can now register with this email.');

await prisma.$disconnect();
