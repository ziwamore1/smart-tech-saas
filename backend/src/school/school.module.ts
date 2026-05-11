import { Module } from '@nestjs/common';
import { SchoolService } from './school.service';
import { SchoolController } from './school.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingModule } from '../messaging/messaging.module';
import { GradingSystemModule } from '../grading-system/grading-system.module';

@Module({
  imports: [MessagingModule, GradingSystemModule],
  providers: [SchoolService, PrismaService],
  controllers: [SchoolController],
})
export class SchoolModule {}
