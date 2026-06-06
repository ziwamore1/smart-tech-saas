import { Module } from '@nestjs/common';
import { StaffPositionController } from './staff-position.controller';
import { StaffPositionService } from './staff-position.service';

@Module({
  controllers: [StaffPositionController],
  providers: [StaffPositionService],
  exports: [StaffPositionService],
})
export class StaffPositionModule {}

