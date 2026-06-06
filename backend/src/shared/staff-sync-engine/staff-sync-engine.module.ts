import { Module, Global } from '@nestjs/common';
import { StaffSyncEngineService } from './staff-sync-engine.service';

@Global()
@Module({
  providers: [StaffSyncEngineService],
  exports: [StaffSyncEngineService],
})
export class StaffSyncEngineModule {}
