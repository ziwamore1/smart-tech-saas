import { Module } from '@nestjs/common';
import { AssessmentEngineService } from './assessment-engine.service';
import { AssessmentEngineController } from './assessment-engine.controller';
import { GradingEngineModule } from '../grading-engine/grading-engine.module';

@Module({
  imports: [GradingEngineModule],
  controllers: [AssessmentEngineController],
  providers: [AssessmentEngineService],
  exports: [AssessmentEngineService],
})
export class AssessmentEngineModule {}
