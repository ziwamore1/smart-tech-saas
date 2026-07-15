import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator } from 'react-native';
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

export const SchoolSubscriptionScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [subscription, setSubscription] = useState<any>(null);
  const [statusCheck, setStatusCheck] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  const drawerScreens = ['DirectorReports', 'DirectorStaff', 'DirectorSettings', 'DirectorProfile', 'DirectorHome', 'DirectorClasses', 'DirectorStudents', 'DirectorLibrary', 'DirectorTimetable', 'DirectorCommunication', 'DirectorUsers'];

  const handleNav = (screen: string) => {
    if (drawerScreens.includes(screen) && onNavigate) {
      onNavigate(screen);
    } else if (stackNavigation) {
      stackNavigation.navigate(screen as never);
    } else {
      navigation.navigate(screen as never);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [subRes, statusRes, plansRes, receiptsRes] = await Promise.allSettled([
        apiService.getMySubscription(),
        apiService.checkSubscriptionStatus(),
        apiService.getSubscriptionPlans(),
        apiService.getSubscriptionReceipts(),
      ]);

      if (subRes.status === 'fulfilled') setSubscription(subRes.value);
      if (statusRes.status === 'fulfilled') setStatusCheck(statusRes.value);
      if (plansRes.status === 'fulfilled') {
        const p = plansRes.value;
        setPlans(Array.isArray(p) ? p : p?.data || p?.plans || []);
      }
      if (receiptsRes.status === 'fulfilled') {
        const r = receiptsRes.value;
        setReceipts(Array.isArray(r) ? r : r?.data || r?.receipts || []);
      }
    } catch (err) {
      console.error('Failed to load subscription data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getStatusBadge = () => {
    const status = statusCheck?.status || subscription?.status || 'unknown';
    const normalized = status.toLowerCase();
    if (normalized === 'active' || normalized === 'trialing') {
      return { label: normalized === 'trialing' ? 'Trial' : 'Active', color: colors.success, bgColor: colors.successLight };
    }
    if (normalized === 'expiring' || normalized === 'past_due') {
      return { label: normalized === 'past_due' ? 'Past Due' : 'Expiring Soon', color: colors.warning, bgColor: colors.warningLight };
    }
    return { label: 'Expired', color: colors.error, bgColor: colors.errorLight };
  };

  const getDaysUntilExpiry = () => {
    const endDate = subscription?.endDate || subscription?.expiresAt || statusCheck?.endDate;
    if (!endDate) return null;
    const diff = new Date(endDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const handleSelectPlan = (plan: any) => {
    const planName = plan.name || plan.title || 'this plan';
    const price = plan.price != null ? `$${Number(plan.price).toFixed(2)}` : '';
    const priceInfo = price ? `${price}${plan.interval ? ` / ${plan.interval}` : ''}` : '';

    Alert.alert(
      'Change Plan',
      `Switch to ${planName}${priceInfo ? `\n${priceInfo}` : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change Plan',
          onPress: async () => {
            setChangingPlan(plan.id);
            try {
              await apiService.changePlan({ planId: plan.id });
              Alert.alert('Success', 'Your plan has been changed.');
              await loadData();
            } catch (err: any) {
              const msg = err?.response?.data?.message || err?.message || 'Failed to change plan.';
              Alert.alert('Error', msg);
            } finally {
              setChangingPlan(null);
            }
          },
        },
      ]
    );
  };

  const handlePayment = (plan: any) => {
    const planName = plan.name || plan.title || 'this plan';
    Alert.alert(
      'Subscribe',
      `Proceed to payment for ${planName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay Now',
          onPress: async () => {
            setProcessingPayment(plan.id);
            try {
              const res = await apiService.createPayment({ planId: plan.id });
              if (res?.paymentUrl) {
                handleNav('PaymentWebView');
              } else {
                Alert.alert('Payment Initiated', 'Your payment is being processed.');
                await loadData();
              }
            } catch (err: any) {
              const msg = err?.response?.data?.message || err?.message || 'Payment failed to initiate.';
              Alert.alert('Error', msg);
            } finally {
              setProcessingPayment(null);
            }
          },
        },
      ]
    );
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.',
      [
        { text: 'Keep Plan', style: 'cancel' },
        {
          text: 'Cancel Subscription',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await apiService.cancelSubscription();
              Alert.alert('Cancelled', 'Your subscription has been cancelled.');
              await loadData();
            } catch (err: any) {
              const msg = err?.response?.data?.message || err?.message || 'Failed to cancel subscription.';
              Alert.alert('Error', msg);
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const badge = getStatusBadge();
  const daysLeft = getDaysUntilExpiry();
  const currentPlanName = subscription?.plan?.name || subscription?.planName || subscription?.plan?.title || subscription?.name || 'No Plan';
  const currentPrice = subscription?.plan?.price || subscription?.price;
  const features = subscription?.plan?.features || subscription?.features || [];
  const usage = subscription?.usage || statusCheck?.usage || {};
  const currentPlanId = subscription?.planId || subscription?.plan?.id;
  const isCancelled = (subscription?.status || '').toLowerCase() === 'cancelled';

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <HeaderBar
          title="Subscription"
          subtitle="Manage your plan"
          leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
          rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
        />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading subscription...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Subscription"
        subtitle="Manage your plan"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Status Badge */}
        <View style={[styles.statusBanner, { backgroundColor: badge.bgColor }]}>
          <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
          <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
          {daysLeft !== null && (
            <Text style={[styles.daysText, { color: badge.color }]}>
              {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining` : 'Expired'}
            </Text>
          )}
        </View>

        {/* Current Subscription Card */}
        <WidgetCard title="Current Plan">
          <View style={styles.planCard}>
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{currentPlanName}</Text>
              {currentPrice != null && (
                <Text style={styles.planPrice}>${Number(currentPrice).toFixed(2)}{subscription?.interval ? `/${subscription.interval}` : ''}</Text>
              )}
            </View>
            {subscription?.startDate && (
              <Text style={styles.dateText}>
                Started {new Date(subscription.startDate).toLocaleDateString()}
              </Text>
            )}
            {subscription?.endDate && (
              <Text style={styles.dateText}>
                {isCancelled ? 'Cancels' : 'Renews'} {new Date(subscription.endDate).toLocaleDateString()}
              </Text>
            )}
            {features.length > 0 && (
              <View style={styles.featuresSection}>
                <Text style={styles.featuresTitle}>Included Features</Text>
                {features.map((f: string, i: number) => (
                  <View key={i} style={styles.featureRow}>
                    <Text style={styles.featureCheck}>✓</Text>
                    <Text style={styles.featureText}>{typeof f === 'string' ? f : f?.name || f?.label || JSON.stringify(f)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </WidgetCard>

        {/* Usage Stats */}
        <WidgetCard title="Usage">
          <View style={styles.usageGrid}>
            <View style={styles.usageItem}>
              <Text style={styles.usageValue}>{usage.users ?? usage.totalUsers ?? '-'}</Text>
              <Text style={styles.usageLabel}>Users</Text>
            </View>
            <View style={styles.usageItem}>
              <Text style={styles.usageValue}>{usage.students ?? usage.totalStudents ?? '-'}</Text>
              <Text style={styles.usageLabel}>Students</Text>
            </View>
            <View style={styles.usageItem}>
              <Text style={styles.usageValue}>{usage.classes ?? usage.totalClasses ?? '-'}</Text>
              <Text style={styles.usageLabel}>Classes</Text>
            </View>
            <View style={styles.usageItem}>
              <Text style={styles.usageValue}>{usage.storageUsed || usage.storage || '-'}</Text>
              <Text style={styles.usageLabel}>Storage</Text>
            </View>
          </View>
          {usage.userLimit != null && (
            <View style={styles.usageBarWrap}>
              <View style={styles.usageBarHeader}>
                <Text style={styles.usageBarLabel}>Users</Text>
                <Text style={styles.usageBarCount}>{usage.users ?? 0} / {usage.userLimit}</Text>
              </View>
              <View style={styles.usageBarBg}>
                <View style={[styles.usageBarFill, {
                  width: `${Math.min(100, ((usage.users ?? 0) / usage.userLimit) * 100)}%`,
                  backgroundColor: ((usage.users ?? 0) / usage.userLimit) > 0.9 ? colors.error : colors.primaryLight,
                }]} />
              </View>
            </View>
          )}
          {usage.studentLimit != null && (
            <View style={styles.usageBarWrap}>
              <View style={styles.usageBarHeader}>
                <Text style={styles.usageBarLabel}>Students</Text>
                <Text style={styles.usageBarCount}>{usage.students ?? 0} / {usage.studentLimit}</Text>
              </View>
              <View style={styles.usageBarBg}>
                <View style={[styles.usageBarFill, {
                  width: `${Math.min(100, ((usage.students ?? 0) / usage.studentLimit) * 100)}%`,
                  backgroundColor: ((usage.students ?? 0) / usage.studentLimit) > 0.9 ? colors.error : colors.primaryLight,
                }]} />
              </View>
            </View>
          )}
        </WidgetCard>

        {/* Available Plans */}
        {plans.length > 0 && (
          <WidgetCard title="Available Plans" action={{ label: 'Compare All', onPress: () => {} }}>
            {plans.map((plan: any) => {
              const planId = plan.id || plan._id;
              const isCurrent = planId === currentPlanId;
              const isProcessing = changingPlan === plan.id || processingPayment === plan.id;
              return (
                <View key={planId} style={[styles.planOption, isCurrent && styles.planOptionCurrent]}>
                  <View style={styles.planOptionHeader}>
                    <View style={styles.planOptionLeft}>
                      <Text style={styles.planOptionName}>{plan.name || plan.title}</Text>
                      {plan.description && <Text style={styles.planOptionDesc}>{plan.description}</Text>}
                    </View>
                    <View style={styles.planOptionRight}>
                      {plan.price != null && (
                        <Text style={styles.planOptionPrice}>${Number(plan.price).toFixed(2)}</Text>
                      )}
                      {plan.interval && <Text style={styles.planOptionInterval}>/ {plan.interval}</Text>}
                    </View>
                  </View>
                  {plan.features && plan.features.length > 0 && (
                    <View style={styles.planFeatures}>
                      {plan.features.map((f: string, i: number) => (
                        <Text key={i} style={styles.planFeatureItem}>✓ {typeof f === 'string' ? f : f?.name || f?.label || ''}</Text>
                      ))}
                    </View>
                  )}
                  <View style={styles.planOptionActions}>
                    {isCurrent ? (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Current Plan</Text>
                      </View>
                    ) : isProcessing ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <View style={styles.planActionsRow}>
                        <TouchableOpacity
                          style={styles.changePlanBtn}
                          onPress={() => handleSelectPlan(plan)}
                          disabled={isProcessing}
                        >
                          <Text style={styles.changePlanBtnText}>Change Plan</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.payBtn}
                          onPress={() => handlePayment(plan)}
                          disabled={isProcessing}
                        >
                          <Text style={styles.payBtnText}>Pay</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </WidgetCard>
        )}

        {/* Payment History */}
        <WidgetCard title="Payment History" action={receipts.length > 0 ? { label: `${receipts.length} receipt${receipts.length !== 1 ? 's' : ''}`, onPress: () => {} } : undefined}>
          {receipts.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📄</Text>
              <Text style={styles.emptyText}>No payment history yet</Text>
            </View>
          ) : (
            receipts.map((receipt: any, idx: number) => (
              <View key={receipt.id || receipt._id || idx} style={[styles.receiptRow, idx < receipts.length - 1 && styles.receiptRowBorder]}>
                <View style={styles.receiptLeft}>
                  <Text style={styles.receiptDate}>{receipt.date || receipt.createdAt ? new Date(receipt.date || receipt.createdAt).toLocaleDateString() : 'N/A'}</Text>
                  <Text style={styles.receiptDesc}>{receipt.description || receipt.planName || receipt.plan?.name || 'Subscription payment'}</Text>
                </View>
                <View style={styles.receiptRight}>
                  <Text style={styles.receiptAmount}>{receipt.amount != null ? `$${Number(receipt.amount).toFixed(2)}` : '-'}</Text>
                  <Text style={[styles.receiptStatus, {
                    color: (receipt.status || '').toLowerCase() === 'paid' || (receipt.status || '').toLowerCase() === 'completed' ? colors.success : colors.textLight,
                  }]}>
                    {(receipt.status || '').toUpperCase() || 'N/A'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </WidgetCard>

        {/* Cancel Subscription */}
        {!isCancelled && subscription && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelSubscription} disabled={cancelling}>
            {cancelling ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Text style={styles.cancelBtnText}>Cancel Subscription</Text>
            )}
          </TouchableOpacity>
        )}

        {isCancelled && (
          <View style={styles.cancelledNotice}>
            <Text style={styles.cancelledNoticeText}>Your subscription has been cancelled and will not renew.</Text>
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: 14, color: colors.textLight },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  statusText: { fontSize: 15, fontWeight: '700', flex: 1 },
  daysText: { fontSize: 13, fontWeight: '600' },

  planCard: {},
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.sm },
  planName: { fontSize: 20, fontWeight: '700', color: colors.text },
  planPrice: { fontSize: 18, fontWeight: '700', color: colors.primary },
  dateText: { fontSize: 13, color: colors.textLight, marginBottom: 2 },
  featuresSection: { marginTop: spacing.md },
  featuresTitle: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.3 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  featureCheck: { fontSize: 14, color: colors.success, marginRight: spacing.sm, fontWeight: '700' },
  featureText: { fontSize: 14, color: colors.text, flex: 1 },

  usageGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  usageItem: { width: '50%', paddingVertical: spacing.sm, alignItems: 'center' },
  usageValue: { fontSize: 24, fontWeight: '700', color: colors.text },
  usageLabel: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  usageBarWrap: { marginTop: spacing.sm },
  usageBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  usageBarLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  usageBarCount: { fontSize: 13, color: colors.textLight, fontWeight: '500' },
  usageBarBg: { height: 8, backgroundColor: colors.borderLight, borderRadius: borderRadius.sm, overflow: 'hidden' },
  usageBarFill: { height: 8, borderRadius: borderRadius.sm },

  planOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.white,
  },
  planOptionCurrent: { borderColor: colors.primaryLight, backgroundColor: colors.infoLight },
  planOptionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planOptionLeft: { flex: 1, marginRight: spacing.md },
  planOptionName: { fontSize: 16, fontWeight: '700', color: colors.text },
  planOptionDesc: { fontSize: 13, color: colors.textLight, marginTop: 4 },
  planOptionRight: { alignItems: 'flex-end' },
  planOptionPrice: { fontSize: 18, fontWeight: '700', color: colors.primary },
  planOptionInterval: { fontSize: 12, color: colors.textLight },
  planFeatures: { marginTop: spacing.sm },
  planFeatureItem: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
  planOptionActions: { marginTop: spacing.md, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  currentBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  currentBadgeText: { fontSize: 12, fontWeight: '700', color: colors.white },
  planActionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  changePlanBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  changePlanBtnText: { fontSize: 13, fontWeight: '600', color: colors.white },
  payBtn: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  payBtnText: { fontSize: 13, fontWeight: '600', color: colors.white },

  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 32, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textLight },

  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  receiptRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  receiptLeft: { flex: 1, marginRight: spacing.md },
  receiptDate: { fontSize: 13, color: colors.textLight, marginBottom: 2 },
  receiptDesc: { fontSize: 14, color: colors.text, fontWeight: '500' },
  receiptRight: { alignItems: 'flex-end' },
  receiptAmount: { fontSize: 15, fontWeight: '700', color: colors.text },
  receiptStatus: { fontSize: 11, fontWeight: '600', marginTop: 2, letterSpacing: 0.3 },

  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.errorLight,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.error },
  cancelledNotice: {
    backgroundColor: colors.warningLight,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  cancelledNoticeText: { fontSize: 14, color: colors.warning, fontWeight: '500', textAlign: 'center' },
});
