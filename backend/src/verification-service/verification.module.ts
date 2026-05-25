import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SigningModule } from '../signing-service/signing.module';
import { BlockchainModule } from '../blockchain-service/blockchain.module';
import { QrModule } from '../qr-service/qr.module';
import { MinistryGatewayModule } from '../ministry-gateway/ministry-gateway.module';

@Module({
  imports: [PrismaModule, SigningModule, BlockchainModule, QrModule, MinistryGatewayModule],
  providers: [VerificationService],
  controllers: [VerificationController],
  exports: [VerificationService],
})
export class VerificationModule {}
