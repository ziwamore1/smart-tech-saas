import { Module } from '@nestjs/common';
import { CertificateValidationService } from './certificate-validation.service';
import { CertificateValidationController } from './certificate-validation.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { SigningModule } from '../signing-service/signing.module';
import { BlockchainModule } from '../blockchain-service/blockchain.module';
import { MinistryGatewayModule } from '../ministry-gateway/ministry-gateway.module';

@Module({
  imports: [PrismaModule, SigningModule, BlockchainModule, MinistryGatewayModule],
  providers: [CertificateValidationService],
  controllers: [CertificateValidationController],
  exports: [CertificateValidationService],
})
export class CertificateValidationModule {}
