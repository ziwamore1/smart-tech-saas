import { Module } from '@nestjs/common';
import { SignaturesController } from './signatures.controller';
import { InternalController } from './internal.controller';
import { SignaturesService } from './signatures.service';
import { CryptoService } from '../crypto.service';

@Module({
  controllers: [SignaturesController, InternalController],
  providers: [SignaturesService, CryptoService],
  exports: [SignaturesService, CryptoService],
})
export class SignaturesModule {}
