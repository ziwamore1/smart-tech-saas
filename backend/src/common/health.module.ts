import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MinistryGatewayModule } from '../ministry-gateway/ministry-gateway.module';
import { BlockchainModule } from '../blockchain-service/blockchain.module';

@Module({
  imports: [PrismaModule, MinistryGatewayModule, BlockchainModule],
  providers: [HealthService],
  controllers: [HealthController],
  exports: [HealthService],
})
export class HealthModule {}
