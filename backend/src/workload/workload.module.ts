import { Module } from '@nestjs/common';
import { WorkloadService } from './workload.service';
import { WorkloadController } from './workload.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WorkloadController],
  providers: [WorkloadService],
  exports: [WorkloadService],
})
export class WorkloadModule {}
