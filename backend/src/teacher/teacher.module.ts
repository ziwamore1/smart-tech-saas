import { Module } from '@nestjs/common';
import { TeacherController } from './teacher.controller';
import { TeacherService } from './teacher.service';
import { MessagingModule } from '../messaging/messaging.module';
import { GradingEngineModule } from '../grading-engine/grading-engine.module';
import { StaffPositionModule } from '../staff-position/staff-position.module';

@Module({
  imports: [MessagingModule, GradingEngineModule, StaffPositionModule],
  controllers: [TeacherController],
  providers: [TeacherService],
  exports: [TeacherService],
})
export class TeacherModule {}
