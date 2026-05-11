import { Module } from '@nestjs/common';
import { GradingSystemController } from './grading-system.controller';
import { GradingSystemService } from './grading-system.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [GradingSystemController],
  providers: [GradingSystemService, PrismaService],
  exports: [GradingSystemService],
})
export class GradingSystemModule {}
