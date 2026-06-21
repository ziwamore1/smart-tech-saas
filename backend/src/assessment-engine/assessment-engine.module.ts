import { Module } from '@nestjs/common';
import { AssessmentEngineService } from './assessment-engine.service';
import { AssessmentEngineController } from './assessment-engine.controller';
import { GradingEngineModule } from '../grading-engine/grading-engine.module';
import { MessagingModule } from '../messaging/messaging.module';
import { CompositeSubjectModule } from '../composite-subject/composite-subject.module';

@Module({
  imports: [GradingEngineModule, MessagingModule, CompositeSubjectModule],
  controllers: [AssessmentEngineController],
  providers: [AssessmentEngineService],
  exports: [AssessmentEngineService],
})
export class AssessmentEngineModule {}
