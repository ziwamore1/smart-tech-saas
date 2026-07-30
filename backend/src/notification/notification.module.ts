import { Module, Global } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { EmailModule } from '../email/email.module';
import { CommunicationsCloudModule } from '../communications-cloud/communications-cloud.module';

@Global()
@Module({
  imports: [EmailModule, CommunicationsCloudModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
