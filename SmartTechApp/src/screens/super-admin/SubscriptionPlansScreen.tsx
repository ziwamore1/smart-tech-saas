import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const SuperAdminSubscriptionPlansScreen: React.FC<Props> = ({ onToggleDrawer }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await apiService.getSubscriptionPlans();
      setPlans(res?.plans || res?.data || []);
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const formatPrice = (p: any) => {
    if (p.price) return `$${p.price}`;
    if (p.amount) return `$${p.amount}`;
    if (p.trialPeriodDays) return 'Free Trial';
    return '-';
  };

  const getInterval = (p: any) => p.interval || p.billingInterval || p.billingPeriod || 'monthly';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Subscription Plans"
        subtitle={`${plans.length} plans`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔄', onPress: onRefresh }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : plans.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No plans yet</Text>
            <Text style={styles.emptyDesc}>Subscription plans will appear here once created.</Text>
          </View>
        ) : (
          plans.map((plan) => (
            <View key={plan.id} style={styles.planCard}>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPrice}>{formatPrice(plan)}</Text>
              </View>
              <Text style={styles.planInterval}>/{getInterval(plan)}</Text>
              {plan.description && <Text style={styles.planDesc}>{plan.description}</Text>}
              <View style={styles.planFeatures}>
                {plan.maxSchools && <Text style={styles.planFeature}>🏫 Up to {plan.maxSchools} schools</Text>}
                {plan.maxUsers && <Text style={styles.planFeature}>👥 Up to {plan.maxUsers} users</Text>}
                {plan.maxStorage && <Text style={styles.planFeature}>💾 {plan.maxStorage} storage</Text>}
                {plan.features && Array.isArray(plan.features) && plan.features.map((f: string, i: number) => (
                  <Text key={i} style={styles.planFeature}>✅ {f}</Text>
                ))}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: plan.isActive ? colors.successLight : colors.errorLight }]}>
                <Text style={[styles.statusText, { color: plan.isActive ? colors.success : colors.error }]}>
                  {plan.isActive ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
          ))
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptyDesc: { fontSize: 14, color: colors.textLight, textAlign: 'center' },
  planCard: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md, ...shadows.card },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planName: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  planPrice: { fontSize: 22, fontWeight: '800', color: colors.primary },
  planInterval: { fontSize: 13, color: colors.textLight, marginTop: -2, marginBottom: spacing.sm },
  planDesc: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 18 },
  planFeatures: { marginBottom: spacing.sm },
  planFeature: { fontSize: 13, color: colors.text, marginBottom: 4 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
  statusText: { fontSize: 12, fontWeight: '700' },
});
