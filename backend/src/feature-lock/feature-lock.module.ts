import { Module } from '@nestjs/common';
import { FeatureLockService } from './feature-lock.service';
import { FeatureLockController, FeatureAccessController } from './feature-lock.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FeatureLockController, FeatureAccessController],
  providers: [FeatureLockService],
  exports: [FeatureLockService],
})
export class FeatureLockModule {}
