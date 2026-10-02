import * as bcrypt from 'bcrypt';
import { AccountRecoveryService } from './account-recovery.service';

describe('AccountRecoveryService password storage', () => {
  it('stores changed passwords as bcrypt hashes that match the login verifier', async () => {
    const oldPasswordHash = await bcrypt.hash('OldPass123', 4);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1', password: oldPasswordHash }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data })),
      },
      passwordHistory: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      accountSecurityLog: { create: jest.fn() },
      systemUser: { findUnique: jest.fn() },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const service = new AccountRecoveryService(prisma as any, {} as any, { validatePasswordStrength: () => ({ valid: true, errors: [] }) } as any, {} as any);

    await service.changePassword('user-1', 'OldPass123', 'NewPass456');

    const passwordUpdate = prisma.user.update.mock.calls[0][0].data.password;
    expect(passwordUpdate).not.toBe('NewPass456');
    expect(await bcrypt.compare('NewPass456', passwordUpdate)).toBe(true);
  });

  it('stores token-reset passwords using the same bcrypt format as login', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1', password: 'legacy-hash', resetToken: 'reset-1' }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data })),
      },
      passwordHistory: { create: jest.fn() },
      accountSecurityLog: { create: jest.fn() },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const service = new AccountRecoveryService(prisma as any, {} as any, { validatePasswordStrength: () => ({ valid: true, errors: [] }) } as any, {} as any);

    await service.resetPasswordWithToken('reset-1', 'ResetPass456');

    const passwordUpdate = prisma.user.update.mock.calls[0][0].data.password;
    expect(await bcrypt.compare('ResetPass456', passwordUpdate)).toBe(true);
  });
});
