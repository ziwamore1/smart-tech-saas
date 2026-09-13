import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PricingAdminController, PricingCatalogController } from './pricing.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [PricingAdminController, PricingCatalogController],
  providers: [PricingService, PrismaService],
  exports: [PricingService],
})
export class PricingModule {}