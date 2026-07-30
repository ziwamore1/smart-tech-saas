import { Module } from '@nestjs/common';
import { CommunicationController } from './communication.controller';
import { CommunicationService } from './communication.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationsCloudModule } from '../communications-cloud/communications-cloud.module';

@Module({
  controllers: [CommunicationController],
  providers: [CommunicationService, PrismaService],
  exports: [CommunicationService],
  imports: [CommunicationsCloudModule],
})
export class CommunicationModule {}
