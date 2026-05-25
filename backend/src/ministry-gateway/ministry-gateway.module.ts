import { Module } from '@nestjs/common';
import { MinistryGatewayService } from './ministry-gateway.service';
import { MinistryGatewayController } from './ministry-gateway.controller';
import { MinistryAdapterFactory } from './adapters/adapter-factory';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MinistryGatewayController],
  providers: [MinistryGatewayService, MinistryAdapterFactory],
  exports: [MinistryGatewayService, MinistryAdapterFactory],
})
export class MinistryGatewayModule {}
