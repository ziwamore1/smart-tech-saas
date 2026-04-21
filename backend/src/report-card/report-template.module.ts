import { Module } from '@nestjs/common';
import { ReportTemplateController } from './report-template.controller';
import { ReportTemplateService } from './report-template.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ReportTemplateController],
  providers: [ReportTemplateService, PrismaService],
  exports: [ReportTemplateService],
})
export class ReportTemplateModule {}
