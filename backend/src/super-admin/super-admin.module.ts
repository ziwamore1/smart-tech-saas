import { Module } from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminSetupController } from './super-admin.controller';
import { AcademicTemplatesController } from './academic-templates.controller';
import { AcademicTemplatesService } from './academic-templates.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagingModule } from '../messaging/messaging.module';
import { CommunicationModule } from '../communication/communication.module';
import { InstitutionModule } from '../institution/institution.module';

@Module({
  imports: [PrismaModule, MessagingModule, CommunicationModule, InstitutionModule],
  controllers: [SuperAdminController, SuperAdminSetupController, AcademicTemplatesController],
  providers: [SuperAdminService, AcademicTemplatesService],
  exports: [SuperAdminService, AcademicTemplatesService],
})
export class SuperAdminModule {}
