import { Module } from '@nestjs/common';
import { HolidayService } from './holiday.service';
import { HolidayController } from './holiday.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [HolidayService],
  controllers: [HolidayController],
  exports: [HolidayService],
})
export class HolidayModule {}
