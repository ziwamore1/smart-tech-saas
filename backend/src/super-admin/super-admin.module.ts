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
import { ReportTemplateBuilderModule } from '../report-template-builder/report-template-builder.module';

@Module({
  imports: [PrismaModule, MessagingModule, CommunicationModule, InstitutionModule, ReportTemplateBuilderModule],
  controllers: [SuperAdminController, SuperAdminSetupController, AcademicTemplatesController],
  providers: [SuperAdminService, AcademicTemplatesService],
  exports: [SuperAdminService, AcademicTemplatesService],
})
export class SuperAdminModule {}
