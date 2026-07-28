import { Module } from '@nestjs/common';
import { StudentSubjectController } from './student-subject.controller';
import { StudentSubjectService } from './student-subject.service';

@Module({
  controllers: [StudentSubjectController],
  providers: [StudentSubjectService],
  exports: [StudentSubjectService],
})
export class StudentSubjectModule {}
