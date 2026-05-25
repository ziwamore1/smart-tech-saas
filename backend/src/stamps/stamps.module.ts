import { Module } from '@nestjs/common';
import { StampsController } from './stamps.controller';
import { StampsService } from './stamps.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StampsController],
  providers: [StampsService],
  exports: [StampsService],
})
export class StampsModule {}
