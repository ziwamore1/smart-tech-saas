import { RolesGuard } from './roles.guard';

describe('RolesGuard role aliases', () => {
  it.each([
    ['HOD', 'Head of Department'],
    ['Deputy Director', 'DEPUTY_DIRECTOR'],
    ['Deputy Head', 'DEPUTY_HEAD_TEACHER'],
  ])('allows %s when the assigned role is %s', async (requiredRole, assignedRole) => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([requiredRole]) };
    const prisma = {
      userRole: { findMany: jest.fn() },
      schoolUser: { findFirst: jest.fn() },
      schoolRoleAssignment: { findMany: jest.fn() },
    };
    const guard = new RolesGuard(prisma as any, reflector as any);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'user-1', schoolId: 'school-1', roles: [assignedRole] } }) }),
    } as any;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.userRole.findMany).not.toHaveBeenCalled();
  });
});
