import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('public/pricing')
export class PricingCatalogController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('catalog')
  getCatalog() {
    return this.pricingService.getCatalog();
  }
}

@Controller('pricing/plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin')
export class PricingAdminController {
  constructor(private readonly pricingService: PricingService) {}

  @Get()
  list() {
    return this.pricingService.list();
  }

  @Post()
  upsert(
    @Body()
    body: {
      schoolType: string;
      tier: string;
      interval: string;
      priceUsd?: number;
      priceZwK?: number;
      features?: string[];
      isActive?: boolean;
    },
  ) {
    return this.pricingService.upsert(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      priceUsd?: number;
      priceZwK?: number;
      features?: string[];
      isActive?: boolean;
    },
  ) {
    return this.pricingService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pricingService.remove(id);
  }

  @Post('seed')
  seed() {
    return this.pricingService.seedDefaults();
  }
}