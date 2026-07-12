import { Module } from '@nestjs/common';
import { ClassTeacherAssignmentService } from './class-teacher-assignment.service';
import { ClassTeacherAssignmentController } from './class-teacher-assignment.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [ClassTeacherAssignmentController],
  providers: [ClassTeacherAssignmentService, PrismaService],
  exports: [ClassTeacherAssignmentService],
})
export class ClassTeacherAssignmentModule {}
