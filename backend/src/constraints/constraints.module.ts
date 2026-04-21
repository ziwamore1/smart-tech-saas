import { Module } from '@nestjs/common';
import { ConstraintsService } from './constraints.service';
import { ConstraintsController } from './constraints.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ConstraintsController],
  providers: [ConstraintsService, PrismaService],
})
export class ConstraintsModule {}
