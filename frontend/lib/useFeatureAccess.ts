'use client';

import { useCallback } from 'react';
import { FeatureLockProvider, useFeatureLock } from './feature-lock-context';
import { SubscriptionTier, TIER_ORDER } from '@/types/subscription';

export type { Feature, SubscriptionTier } from '@/types/subscription';

export function useFeatureAccess() {
  const { hasAccess, canAccessTier, getRequiredTier, features, loading, error } = useFeatureLock();

  const checkAccess = useCallback((featureKey: string): {
    hasAccess: boolean;
    requiredTier: SubscriptionTier;
  } => {
    const feature = features.find(f => f.key === featureKey);
    return {
      hasAccess: hasAccess(featureKey),
      requiredTier: feature?.minTier || 'BASIC',
    };
  }, [features, hasAccess]);

  const checkTierAccess = useCallback((requiredTier: SubscriptionTier, currentTier: SubscriptionTier): boolean => {
    return canAccessTier(requiredTier, currentTier);
  }, [canAccessTier]);

  return {
    hasAccess,
    checkAccess,
    checkTierAccess,
    getRequiredTier,
    features,
    loading,
    error,
  };
}

export function useSchoolFeatures(schoolTier: SubscriptionTier = 'BASIC') {
  const { hasAccess, features, canAccessTier } = useFeatureLock();

  const canAccess = useCallback((featureKey: string): boolean => {
    const feature = features.find(f => f.key === featureKey);
    if (!feature) return false;
    if (!feature.isEnabled) return false;
    if (feature.isLocked) return false;
    return canAccessTier(feature.minTier, schoolTier);
  }, [features, canAccessTier, schoolTier]);

  const getLockedFeatures = useCallback((): string[] => {
    return features
      .filter(f => !canAccessTier(f.minTier, schoolTier))
      .map(f => f.key);
  }, [features, canAccessTier, schoolTier]);

  const getDisabledFeatures = useCallback((): string[] => {
    return features
      .filter(f => !f.isEnabled || f.isLocked)
      .map(f => f.key);
  }, [features]);

  return {
    canAccess,
    getLockedFeatures,
    getDisabledFeatures,
    features,
    schoolTier,
  };
}

export { FeatureLockProvider, useFeatureLock };
export { DEFAULT_FEATURES, DEFAULT_SUBSCRIPTION_PLANS, CATEGORY_LABELS, TIER_ORDER, TIER_COLORS } from '@/types/subscription';
