import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureLockService } from '../../../feature-lock/feature-lock.service';

export const PREMIUM_FEATURE_KEY = 'premium_feature';

@Injectable()
export class PremiumFeatureGuard implements CanActivate {
  private readonly logger = new Logger(PremiumFeatureGuard.name);

  constructor(
    private reflector: Reflector,
    private featureLockService: FeatureLockService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(
      PREMIUM_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFeature) return true;

    const request = context.switchToHttp().getRequest();
    const schoolId = request.user?.schoolId;
    const user = request.user;

    if (!schoolId) {
      this.logger.warn('PremiumFeatureGuard: No schoolId on request');
      throw new ForbiddenException('School context required for premium features');
    }

    const access = await this.featureLockService.checkAccess(schoolId, requiredFeature);

    if (!access.hasAccess) {
      this.logger.warn(`PremiumFeatureGuard: Access denied for school ${schoolId} to feature ${requiredFeature}: ${access.reason}`);
      throw new ForbiddenException(access.reason || 'Premium feature not available on your subscription tier');
    }

    return true;
  }
}
