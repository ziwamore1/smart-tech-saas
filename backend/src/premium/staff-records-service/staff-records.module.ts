import { Module } from '@nestjs/common';
import { StaffRecordsController } from './staff-records.controller';
import { StaffRecordsService } from './staff-records.service';
import { StaffTemplateService } from './staff-template.service';
import { StaffExcelService } from './staff-excel.service';
import { StaffSyncEngineModule } from '../../shared/staff-sync-engine/staff-sync-engine.module';
import { FeatureLockModule } from '../../feature-lock/feature-lock.module';

@Module({
  imports: [StaffSyncEngineModule, FeatureLockModule],
  controllers: [StaffRecordsController],
  providers: [StaffRecordsService, StaffTemplateService, StaffExcelService],
  exports: [StaffRecordsService, StaffTemplateService, StaffExcelService],
})
export class StaffRecordsModule {}
