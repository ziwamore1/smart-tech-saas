import { Module } from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminSetupController } from './super-admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagingModule } from '../messaging/messaging.module';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [PrismaModule, MessagingModule, CommunicationModule],
  controllers: [SuperAdminController, SuperAdminSetupController],
  providers: [SuperAdminService],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
