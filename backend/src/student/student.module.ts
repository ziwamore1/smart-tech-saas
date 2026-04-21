import { Module } from '@nestjs/common';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EnrollmentModule } from '../enrollment/enrollment.module'; // <-- import here

@Module({
  imports: [PrismaModule, EnrollmentModule], // <-- add here
  controllers: [StudentController],
  providers: [StudentService],
})
export class StudentModule {}
