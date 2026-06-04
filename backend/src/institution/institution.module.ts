import { Module } from '@nestjs/common';
import { InstitutionController } from './institution.controller';
import { InstitutionTypeService } from './institution-type.service';
import { InstitutionProvisioningService } from './institution-provisioning.service';
import { InstitutionRegistrationService } from './institution-registration.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [InstitutionController],
  providers: [
    InstitutionTypeService,
    InstitutionProvisioningService,
    InstitutionRegistrationService,
    PrismaService,
    JwtService,
  ],
  exports: [
    InstitutionTypeService,
    InstitutionProvisioningService,
    InstitutionRegistrationService,
  ],
})
export class InstitutionModule {}
