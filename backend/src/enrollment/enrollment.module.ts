import { Module } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { EnrollmentController } from './enrollment.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AdmissionNumberModule } from '../admission-number/admission-number.module';

@Module({
  imports: [PrismaModule, AdmissionNumberModule],
  controllers: [EnrollmentController],
  providers: [EnrollmentService],
  exports: [EnrollmentService], // important for promotion logic
})
export class EnrollmentModule {}
