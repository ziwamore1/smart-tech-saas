import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { SignaturesModule } from './signatures/signatures.module';
import { PublicController } from './public.controller';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, AuthModule, SignaturesModule],
  controllers: [PublicController, HealthController],
})
export class AppModule {}
