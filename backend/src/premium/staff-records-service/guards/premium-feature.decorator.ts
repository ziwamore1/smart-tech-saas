import { SetMetadata } from '@nestjs/common';
import { PREMIUM_FEATURE_KEY } from './premium-feature.guard';

export const PremiumFeature = (featureKey: string) => SetMetadata(PREMIUM_FEATURE_KEY, featureKey);
