import { Module } from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { TimetableController } from './timetable.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TimetableGateway } from './timetable.gateway';
import { TimetableSolverService } from './solver/timetable-solver.service';
import { TimetableQueueService } from './solver/timetable-queue.service';
import { TimetableProcessor } from './timetable.processor';

@Module({
  imports: [PrismaModule],
  controllers: [TimetableController],
  providers: [
    TimetableService,
    TimetableGateway,
    TimetableSolverService,
    TimetableQueueService,
    TimetableProcessor,
  ],
  exports: [TimetableService, TimetableSolverService, TimetableQueueService],
})
export class TimetableModule {}
