import { Module } from '@nestjs/common';
import { GradingEngineService } from './grading-engine.service';

@Module({
  providers: [GradingEngineService],
  exports: [GradingEngineService],
})
export class GradingEngineModule {}
