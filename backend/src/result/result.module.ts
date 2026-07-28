import { Module } from '@nestjs/common';
import { ResultController } from './result.controller';
import { ResultService } from './result.service';
import { StudentSubjectModule } from '../student-subject/student-subject.module';

@Module({
  imports: [StudentSubjectModule],
  controllers: [ResultController],
  providers: [ResultService],
})
export class ResultModule {}
