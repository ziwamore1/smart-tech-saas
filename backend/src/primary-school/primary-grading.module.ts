import { Module } from '@nestjs/common';
import { PrimaryGradingController } from './primary-grading.controller';
import { GradingEngineModule } from '../grading-engine/grading-engine.module';

@Module({
  imports: [GradingEngineModule],
  controllers: [PrimaryGradingController],
})
export class PrimarySchoolModule {}
