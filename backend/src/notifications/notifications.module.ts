import { Module, Global } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationQueueService } from './notification-queue.service';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationQueueService],
  exports: [NotificationsService, NotificationQueueService],
})
export class NotificationsModule {}
