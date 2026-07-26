import { Module } from '@nestjs/common';
import { ReportCardEngineService } from './report-card-engine.service';
import { ReportCardEngineController } from './report-card-engine.controller';
import { CompositeSubjectModule } from '../composite-subject/composite-subject.module';
import { GradingEngineModule } from '../grading-engine/grading-engine.module';

@Module({
  imports: [CompositeSubjectModule, GradingEngineModule],
  controllers: [ReportCardEngineController],
  providers: [ReportCardEngineService],
  exports: [ReportCardEngineService],
})
export class ReportCardEngineModule {}
