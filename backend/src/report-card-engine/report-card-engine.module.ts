import { Module } from '@nestjs/common';
import { ReportCardEngineService } from './report-card-engine.service';
import { ReportCardEngineController } from './report-card-engine.controller';

@Module({
  controllers: [ReportCardEngineController],
  providers: [ReportCardEngineService],
  exports: [ReportCardEngineService],
})
export class ReportCardEngineModule {}
