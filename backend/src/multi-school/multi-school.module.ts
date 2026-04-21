import { Module } from '@nestjs/common';
import { MultiSchoolService } from './multi-school.service';
import { MultiSchoolController } from './multi-school.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MultiSchoolController],
  providers: [MultiSchoolService],
  exports: [MultiSchoolService],
})
export class MultiSchoolModule {}
