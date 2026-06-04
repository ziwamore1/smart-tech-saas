import { Module } from '@nestjs/common';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { PasswordGenerationService } from './password-generation.service';
import { UsernameGenerationService } from './username-generation.service';
import { CredentialDeliveryService } from './credential-delivery.service';
import { OtpService } from './otp.service';
import { AccountRecoveryService } from './account-recovery.service';
import { SessionManagementService } from './session-management.service';
import { SecurityAuditService } from './security-audit.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [IdentityController],
  providers: [
    IdentityService,
    PasswordGenerationService,
    UsernameGenerationService,
    CredentialDeliveryService,
    OtpService,
    AccountRecoveryService,
    SessionManagementService,
    SecurityAuditService,
  ],
  exports: [
    IdentityService,
    PasswordGenerationService,
    UsernameGenerationService,
    CredentialDeliveryService,
    OtpService,
    AccountRecoveryService,
    SessionManagementService,
    SecurityAuditService,
  ],
})
export class IdentityModule {}
