import { Module } from '@nestjs/common';
import { ReportCardEngineService } from './report-card-engine.service';
import { ReportCardEngineController } from './report-card-engine.controller';
import { CompositeSubjectModule } from '../composite-subject/composite-subject.module';

@Module({
  imports: [CompositeSubjectModule],
  controllers: [ReportCardEngineController],
  providers: [ReportCardEngineService],
  exports: [ReportCardEngineService],
})
export class ReportCardEngineModule {}
