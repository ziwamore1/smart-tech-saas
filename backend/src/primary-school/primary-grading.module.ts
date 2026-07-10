import { Module } from '@nestjs/common';
import { PrimaryGradingController } from './primary-grading.controller';
import { GradingEngineModule } from '../grading-engine/grading-engine.module';
import { GradingSystemModule } from '../grading-system/grading-system.module';

@Module({
  imports: [GradingEngineModule, GradingSystemModule],
  controllers: [PrimaryGradingController],
})
export class PrimarySchoolModule {}
