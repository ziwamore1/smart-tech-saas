import { Module } from '@nestjs/common';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarSyncController } from './calendar-sync.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CalendarSyncController],
  providers: [CalendarSyncService],
  exports: [CalendarSyncService],
})
export class CalendarSyncModule {}
