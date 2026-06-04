export class GeneratePasswordDto {
  role?: string;
  length?: number;
  includeSpecial?: boolean;
}

export class GenerateUsernameDto {
  firstName: string;
  lastName: string;
  role: string;
  schoolId?: string;
}

export class CreateUserCredentialsDto {
  userId: string;
  deliveryChannel?: 'SMS' | 'EMAIL' | 'WHATSAPP';
}

export class DeliverCredentialDto {
  userCredentialId?: string;
  userId: string;
  channel: 'SMS' | 'EMAIL' | 'WHATSAPP';
}

export class ResetPasswordDto {
  token: string;
  newPassword: string;
}

export class ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export class ForgotPasswordDto {
  email: string;
}

export class RecoverUsernameDto {
  email: string;
}

export class ForcePasswordChangeDto {
  userId: string;
}

export class VerifyOtpDto {
  userId: string;
  otpCode: string;
  purpose: string;
}

export class SendOtpDto {
  userId: string;
  purpose: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP';
  recipient: string;
}

export class LockAccountDto {
  userId: string;
  reason?: string;
}

export class UnlockAccountDto {
  userId: string;
  reason?: string;
}

export class UpdateProfileDto {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export class BulkCreateCredentialsDto {
  userIds: string[];
  deliveryChannel?: 'SMS' | 'EMAIL' | 'WHATSAPP';
}

export class BulkDeliverCredentialsDto {
  userIds: string[];
  channel: 'SMS' | 'EMAIL' | 'WHATSAPP';
}

export class AuditLogQueryDto {
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  schoolId?: string;
  page?: number;
  limit?: number;
}

export class RegisterDeviceDto {
  deviceId: string;
  deviceName?: string;
  deviceType?: string;
  platform?: string;
  os?: string;
  browser?: string;
  pushToken?: string;
}

export class InvalidateSessionDto {
  sessionId?: string;
  allDevices?: boolean;
}
