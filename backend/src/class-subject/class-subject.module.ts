import { Module } from '@nestjs/common';
import { ClassSubjectService } from './class-subject.service';
import { ClassSubjectController } from './class-subject.controller';

@Module({
  providers: [ClassSubjectService],
  controllers: [ClassSubjectController],
  exports: [ClassSubjectService],
})
export class ClassSubjectModule {}
