import { Module } from '@nestjs/common';
import { SyncEngineService } from './sync-engine.service';
import { SyncEngineController } from './sync-engine.controller';
import { AssessmentEngineModule } from '../assessment-engine/assessment-engine.module';

@Module({
  imports: [AssessmentEngineModule],
  controllers: [SyncEngineController],
  providers: [SyncEngineService],
  exports: [SyncEngineService],
})
export class SyncEngineModule {}
