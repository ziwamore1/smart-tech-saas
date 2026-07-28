import { Module } from '@nestjs/common';
import { GradingEngineService } from './grading-engine.service';
import { StudentSubjectModule } from '../student-subject/student-subject.module';

@Module({
  imports: [StudentSubjectModule],
  providers: [GradingEngineService],
  exports: [GradingEngineService],
})
export class GradingEngineModule {}
