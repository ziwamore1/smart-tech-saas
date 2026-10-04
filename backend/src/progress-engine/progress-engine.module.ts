import { Module } from '@nestjs/common';
import { ProgressEngineController } from './progress-engine.controller';
import { ProgressEngineService } from './progress-engine.service';
import { ProgressReportService } from './progress-report.service';

@Module({
  controllers: [ProgressEngineController],
  providers: [ProgressEngineService, ProgressReportService],
  exports: [ProgressEngineService],
})
export class ProgressEngineModule {}
