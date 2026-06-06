'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api';
import { 
  Feature, 
  SubscriptionTier, 
  DEFAULT_FEATURES, 
  TIER_ORDER 
} from '@/types/subscription';

interface FeatureLockContextType {
  features: Feature[];
  loading: boolean;
  error: string | null;
  hasAccess: (featureKey: string) => boolean;
  canAccessTier: (requiredTier: SubscriptionTier, currentTier: SubscriptionTier) => boolean;
  getRequiredTier: (featureKey: string) => SubscriptionTier;
  updateFeature: (featureKey: string, updates: Partial<Feature>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  getFeaturesByCategory: (category: string) => Feature[];
  getFeaturesByTier: (tier: SubscriptionTier) => Feature[];
  lockFeature: (featureKey: string) => Promise<void>;
  unlockFeature: (featureKey: string) => Promise<void>;
  setTierRequirement: (featureKey: string, tier: SubscriptionTier) => Promise<void>;
}

const FeatureLockContext = createContext<FeatureLockContextType | undefined>(undefined);

export function useFeatureLock() {
  const context = useContext(FeatureLockContext);
  if (!context) {
    throw new Error('useFeatureLock must be used within a FeatureLockProvider');
  }
  return context;
}

interface FeatureLockProviderProps {
  children: ReactNode;
  schoolId?: string;
}

export function FeatureLockProvider({ children, schoolId }: FeatureLockProviderProps) {
  const [features, setFeatures] = useState<Feature[]>(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeatures = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/feature-locks');
      const data = response.data?.data ?? response.data;
      if (Array.isArray(data)) {
        setFeatures(data);
      } else if (Array.isArray(data?.data)) {
        setFeatures(data.data);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to fetch features, using defaults:', err);
      setFeatures(DEFAULT_FEATURES);
      setError('Using default feature configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const hasAccess = useCallback((featureKey: string): boolean => {
    const feature = features.find(f => f.key === featureKey);
    if (!feature) return true;
    if (!feature.isEnabled) return false;
    if (feature.isLocked) return false;
    return true;
  }, [features]);

  const canAccessTier = useCallback((
    requiredTier: SubscriptionTier, 
    currentTier: SubscriptionTier
  ): boolean => {
    return TIER_ORDER[currentTier] >= TIER_ORDER[requiredTier];
  }, []);

  const getRequiredTier = useCallback((featureKey: string): SubscriptionTier => {
    const feature = features.find(f => f.key === featureKey);
    return feature?.minTier || 'BASIC';
  }, [features]);

  const updateFeature = useCallback(async (
    featureKey: string, 
    updates: Partial<Feature>
  ) => {
    try {
      const feature = features.find(f => f.key === featureKey);
      if (!feature) throw new Error('Feature not found');

      const updatedFeature = { ...feature, ...updates };
      
      await api.patch(`/feature-locks/${featureKey}`, updates);
      
      setFeatures(prev => 
        prev.map(f => f.key === featureKey ? updatedFeature : f)
      );
    } catch (err) {
      console.error('Failed to update feature:', err);
      throw err;
    }
  }, [features]);

  const resetToDefaults = useCallback(async () => {
    try {
      await api.post('/feature-locks/reset');
      setFeatures(DEFAULT_FEATURES);
    } catch (err) {
      console.error('Failed to reset features:', err);
      throw err;
    }
  }, []);

  const getFeaturesByCategory = useCallback((category: string): Feature[] => {
    return features.filter(f => f.category === category);
  }, [features]);

  const getFeaturesByTier = useCallback((tier: SubscriptionTier): Feature[] => {
    return features.filter(f => f.minTier === tier);
  }, [features]);

  const lockFeature = useCallback(async (featureKey: string) => {
    await updateFeature(featureKey, { isLocked: true });
  }, [updateFeature]);

  const unlockFeature = useCallback(async (featureKey: string) => {
    await updateFeature(featureKey, { isLocked: false });
  }, [updateFeature]);

  const setTierRequirement = useCallback(async (
    featureKey: string, 
    tier: SubscriptionTier
  ) => {
    await updateFeature(featureKey, { minTier: tier });
  }, [updateFeature]);

  const value: FeatureLockContextType = {
    features,
    loading,
    error,
    hasAccess,
    canAccessTier,
    getRequiredTier,
    updateFeature,
    resetToDefaults,
    getFeaturesByCategory,
    getFeaturesByTier,
    lockFeature,
    unlockFeature,
    setTierRequirement,
  };

  return (
    <FeatureLockContext.Provider value={value}>
      {children}
    </FeatureLockContext.Provider>
  );
}

export default FeatureLockContext;
