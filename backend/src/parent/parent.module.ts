import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ParentService } from './parent.service';
import { ParentController } from './parent.controller';
import { ReportCardModule } from '../report-card/report-card.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [PrismaModule, ReportCardModule, MessagingModule],
  providers: [ParentService],
  controllers: [ParentController],
})
export class ParentModule {}
