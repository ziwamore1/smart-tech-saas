import { Module } from '@nestjs/common';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EnrollmentModule } from '../enrollment/enrollment.module';
import { IdentityModule } from '../identity-service/identity.module';
import { AdmissionNumberModule } from '../admission-number/admission-number.module';

@Module({
  imports: [PrismaModule, EnrollmentModule, IdentityModule, AdmissionNumberModule],
  controllers: [StudentController],
  providers: [StudentService],
})
export class StudentModule {}
