import { StaffRecordsService } from './staff-records.service';

describe('StaffRecordsService advanced staff profile saves', () => {
  it('returns success after saving the profile and draft return', async () => {
    const profile = {
      id: 'profile-1',
      staffId: 'teacher-1',
      teacherName: 'Test Teacher',
      dynamicFields: {},
      dateOfBirth: null,
    };
    const submission = {
      id: 'submission-1',
      data: [{ staffId: 'teacher-1', values: {}, missing: [], status: 'INCOMPLETE' }],
      snapshot: {},
      template: {
        name: 'Staff Return',
        columns: [{ columnName: 'staff.gender', columnLabel: 'Sex', isEditable: true, isRequired: false }],
      },
    };
    const tx = {
      staffHrProfile: { update: jest.fn().mockResolvedValue({ ...profile, gender: 'Female' }) },
      staffReturnSubmission: { update: jest.fn().mockResolvedValue(submission) },
    };
    const prisma = {
      teacher: { findFirst: jest.fn().mockResolvedValue({ id: 'teacher-1' }) },
      staffHrProfile: { findUnique: jest.fn().mockResolvedValue(profile) },
      staffReturnSubmission: { findMany: jest.fn().mockResolvedValue([submission]) },
      staffAuditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new StaffRecordsService(prisma as any, {} as any);

    const result = await service.updateMyAdvancedProfile('user-1', 'school-1', { gender: 'Female' });

    expect(result).toMatchObject({ editable: true, syncedDraftReturns: 1 });
    expect(tx.staffHrProfile.update).toHaveBeenCalled();
    expect(tx.staffReturnSubmission.update).toHaveBeenCalled();
    expect(prisma.staffAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'STAFF_SELF_UPDATE', profileId: 'profile-1' }),
    }));
  });

  it('does not turn a successful save into a server error when audit logging fails', async () => {
    const profile = { id: 'profile-1', staffId: 'teacher-1', teacherName: 'Test Teacher', dynamicFields: {} };
    const submission = {
      id: 'submission-1',
      data: [{ staffId: 'teacher-1', values: {}, missing: [], status: 'INCOMPLETE' }],
      snapshot: {},
      template: { name: 'Staff Return', columns: [] },
    };
    const tx = {
      staffHrProfile: { update: jest.fn().mockResolvedValue(profile) },
      staffReturnSubmission: { update: jest.fn().mockResolvedValue(submission) },
    };
    const prisma = {
      teacher: { findFirst: jest.fn().mockResolvedValue({ id: 'teacher-1' }) },
      staffHrProfile: { findUnique: jest.fn().mockResolvedValue(profile) },
      staffReturnSubmission: { findMany: jest.fn().mockResolvedValue([submission]) },
      staffAuditLog: { create: jest.fn().mockRejectedValue(new Error('audit database unavailable')) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new StaffRecordsService(prisma as any, {} as any);

    await expect(service.updateMyAdvancedProfile('user-1', 'school-1', { gender: 'Female' })).resolves.toMatchObject({
      editable: true,
      syncedDraftReturns: 1,
    });
  });
});
