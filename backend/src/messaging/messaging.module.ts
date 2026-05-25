import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { UnifiedMessagingService } from './unified-messaging.service';
import { SocketGateway } from './socket.gateway';

@Module({
  imports: [PrismaModule],
  providers: [MessagingService, UnifiedMessagingService, SocketGateway],
  controllers: [MessagingController],
  exports: [MessagingService, UnifiedMessagingService, SocketGateway],
})
export class MessagingModule {}
