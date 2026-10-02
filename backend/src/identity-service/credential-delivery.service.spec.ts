import { CredentialDeliveryService } from './credential-delivery.service';

describe('CredentialDeliveryService SMS delivery', () => {
  it('never calls the SMS provider for missing or invalid numbers', async () => {
    const prisma = { credentialDeliveryLog: { create: jest.fn() } };
    const unifiedMessaging = { sendSMS: jest.fn().mockResolvedValue({ success: true, messageId: 'provider-id' }) };
    const service = new CredentialDeliveryService(prisma as any, {} as any, unifiedMessaging as any);

    await expect(service.sendSmsMessage('', 'credentials')).resolves.toMatchObject({ success: false });
    await expect(service.sendSmsMessage('07712', 'credentials')).resolves.toMatchObject({ success: false });

    expect(unifiedMessaging.sendSMS).not.toHaveBeenCalled();
  });

  it('sends a valid normalized phone through the real messaging provider', async () => {
    const prisma = { credentialDeliveryLog: { create: jest.fn() } };
    const unifiedMessaging = { sendSMS: jest.fn().mockResolvedValue({ success: true, messageId: 'provider-id' }) };
    const service = new CredentialDeliveryService(prisma as any, {} as any, unifiedMessaging as any);

    await expect(service.sendSmsMessage('0977 123 456', 'credentials')).resolves.toEqual({ success: true, messageId: 'provider-id' });
    expect(unifiedMessaging.sendSMS).toHaveBeenCalledWith('+260977123456', 'credentials');
  });
});
