import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdmissionNumberService } from './admission-number.service';

@Module({
  imports: [PrismaModule],
  providers: [AdmissionNumberService],
  exports: [AdmissionNumberService],
})
export class AdmissionNumberModule {}
