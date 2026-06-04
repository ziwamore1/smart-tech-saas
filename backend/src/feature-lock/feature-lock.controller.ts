import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { FeatureLockService, FeatureLockDto } from './feature-lock.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('feature-locks')
export class FeatureLockController {
  constructor(private readonly featureLockService: FeatureLockService) {}

  @Get()
  async findAll(): Promise<{ data: FeatureLockDto[] }> {
    const features = await this.featureLockService.findAll();
    return { data: features };
  }

  @Get(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  async findOne(@Param('key') key: string): Promise<{ data: FeatureLockDto }> {
    const feature = await this.featureLockService.findOne(key);
    return { data: feature };
  }

  @Patch(':key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  async update(
    @Param('key') key: string,
    @Body() data: {
      name?: string;
      description?: string;
      category?: string;
      minTier?: 'BASIC' | 'STANDARD' | 'PREMIUM';
      isEnabled?: boolean;
      isLocked?: boolean;
      limits?: {
        basic?: number;
        standard?: number;
        premium?: number;
      };
    },
  ): Promise<{ data: FeatureLockDto }> {
    const feature = await this.featureLockService.update(key, data);
    return { data: feature };
  }

  @Post('reset')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SuperAdmin')
  async resetToDefaults(): Promise<{ message: string }> {
    return this.featureLockService.resetToDefaults();
  }

  @Get('access/:schoolId')
  async getFeaturesForSchool(
    @Param('schoolId') schoolId: string,
  ): Promise<{
    data: {
      features: FeatureLockDto[];
      tier: string;
      lockedFeatures: string[];
      disabledFeatures: string[];
    };
  }> {
    const result = await this.featureLockService.getFeaturesForSchool(schoolId);
    return { data: result };
  }
}

@Controller('subscription')
export class FeatureAccessController {
  constructor(private readonly featureLockService: FeatureLockService) {}

  @Get('check/:schoolId/:featureKey')
  async checkAccess(
    @Param('schoolId') schoolId: string,
    @Param('featureKey') featureKey: string,
  ): Promise<{ hasAccess: boolean; reason?: string }> {
    return this.featureLockService.checkAccess(schoolId, featureKey);
  }
}
