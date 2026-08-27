import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MinistryGatewayModule } from '../ministry-gateway/ministry-gateway.module';
import { BlockchainModule } from '../blockchain-service/blockchain.module';
import { AdmissionNumberModule } from '../admission-number/admission-number.module';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [PrismaModule, MinistryGatewayModule, BlockchainModule, AdmissionNumberModule, QueuesModule],
  providers: [HealthService],
  controllers: [HealthController],
  exports: [HealthService],
})
export class HealthModule {}
