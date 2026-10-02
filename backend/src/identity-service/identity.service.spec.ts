import { IdentityService } from './identity.service';

describe('IdentityService parent credential SMS', () => {
  it('records an invalid parent number and blocks delivery before generating credentials', async () => {
    const parent = {
      id: 'parent-1',
      userId: null,
      firstName: 'Pat',
      lastName: 'Guardian',
      phone: '07712',
      email: 'parent@internal.smarttech.edu',
      schoolId: 'school-1',
      children: [{ student: { id: 'student-1' } }],
    };
    const prisma = {
      parent: {
        findFirst: jest.fn().mockResolvedValue(parent),
        update: jest.fn().mockResolvedValue(parent),
      },
      parentCredentialDelivery: { create: jest.fn().mockResolvedValue({ id: 'delivery-1' }) },
      user: { findUnique: jest.fn() },
      teacher: { findFirst: jest.fn() },
    };
    const credentialDelivery = { sendParentBundleSms: jest.fn() };
    const service = new IdentityService(
      prisma as any,
      {} as any,
      {} as any,
      credentialDelivery as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.deliverParentCredentialsBySms('parent-1', 'director-1', 'school-1');

    expect(result).toMatchObject({ success: false, blocked: true, phoneStatus: 'INVALID' });
    expect(prisma.parent.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ phoneStatus: 'INVALID', credentialDeliveryStatus: 'BLOCKED_INVALID_PHONE' }),
    }));
    expect(prisma.parentCredentialDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'BLOCKED_INVALID_PHONE', parentId: 'parent-1' }),
    }));
    expect(credentialDelivery.sendParentBundleSms).not.toHaveBeenCalled();
  });
});
