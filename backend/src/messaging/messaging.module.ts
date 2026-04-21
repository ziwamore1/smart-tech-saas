import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UnifiedMessagingService } from './unified-messaging.service';

@Module({
  imports: [PrismaModule],
  providers: [MessagingService, UnifiedMessagingService],
  controllers: [MessagingController],
  exports: [MessagingService, UnifiedMessagingService],
})
export class MessagingModule {}
