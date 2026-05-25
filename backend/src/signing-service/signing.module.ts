import { Module } from '@nestjs/common';
import { SigningService } from './signing.service';
import { SigningController } from './signing.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SigningService],
  controllers: [SigningController],
  exports: [SigningService],
})
export class SigningModule {}
