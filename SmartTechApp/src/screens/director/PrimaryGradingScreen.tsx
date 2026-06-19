import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiService } from '../../services/api';

interface PrimaryGradingProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

const COMPETENCY_GRADES = [
  { grade: 'A', range: '80-100%', remark: 'Outstanding', descriptor: 'Exceeds expectations independently' },
  { grade: 'B', range: '70-79%', remark: 'Very Good', descriptor: 'Meets and often exceeds expectations' },
  { grade: 'C', range: '50-69%', remark: 'Good', descriptor: 'Meets expectations with some support' },
  { grade: 'D', range: '35-49%', remark: 'Satisfactory', descriptor: 'Meets minimum expectations with support' },
  { grade: 'E', range: '0-34%', remark: 'Needs Improvement', descriptor: 'Requires significant support' },
];

const STANDARD_GRADES = [
  { grade: 'A', range: '80-100%', remark: 'Excellent' },
  { grade: 'B', range: '70-79%', remark: 'Very Good' },
  { grade: 'C', range: '60-69%', remark: 'Good' },
  { grade: 'D', range: '50-59%', remark: 'Satisfactory' },
  { grade: 'E', range: '40-49%', remark: 'Poor' },
  { grade: 'F', range: '0-39%', remark: 'Fail' },
];

export const PrimaryGradingScreen: React.FC<PrimaryGradingProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [activeTab, setActiveTab] = useState<'lower' | 'upper'>('lower');
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiService.getGradingPolicies();
        setPolicies(Array.isArray(res) ? res : res?.data || []);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  const lowerPolicies = policies.filter((p: any) => p.type === 'COMPETENCY' || p.code?.includes('primary_lower'));
  const upperPolicies = policies.filter((p: any) => p.type === 'PERCENTAGE' && (p.code?.includes('primary_upper') || p.code?.includes('standard')));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Primary Grading"
        subtitle="Competency-based grading system"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerIcon}>ℹ️</Text>
          <Text style={styles.infoBannerText}>
            Primary schools use a <Text style={styles.infoBold}>35% pass threshold</Text> (vs 50% for secondary). Grades 1-4 use competency-based grading, Grades 5-6 use standard percentage grading.
          </Text>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'lower' && styles.tabActive]}
            onPress={() => setActiveTab('lower')}
          >
            <Text style={[styles.tabText, activeTab === 'lower' && styles.tabTextActive]}>Grades 1-4</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'upper' && styles.tabActive]}
            onPress={() => setActiveTab('upper')}
          >
            <Text style={[styles.tabText, activeTab === 'upper' && styles.tabTextActive]}>Grades 5-6</Text>
          </TouchableOpacity>
        </View>

        <WidgetCard title={activeTab === 'lower' ? 'Competency-Based Grading' : 'Standard Percentage Grading'}>
          <Text style={styles.scaleDesc}>
            {activeTab === 'lower'
              ? 'Descriptive assessment based on learning area competencies'
              : 'Traditional percentage-based grading with letter grades'}
          </Text>

          <View style={styles.scaleHeader}>
            <Text style={[styles.scaleHeaderCell, { flex: 0.5 }]}>Grade</Text>
            <Text style={[styles.scaleHeaderCell, { flex: 1 }]}>Range</Text>
            <Text style={[styles.scaleHeaderCell, { flex: 1.5 }]}>Remark</Text>
            {activeTab === 'lower' && <Text style={[styles.scaleHeaderCell, { flex: 2 }]}>Descriptor</Text>}
          </View>

          {(activeTab === 'lower' ? COMPETENCY_GRADES : STANDARD_GRADES).map((g, idx) => (
            <View key={idx} style={[styles.scaleRow, idx > 0 && styles.scaleRowBorder]}>
              <Text style={[styles.scaleCell, { flex: 0.5, fontWeight: '700', color: g.grade === 'E' || g.grade === 'F' ? colors.error : g.range.includes('80') ? colors.success : colors.text }]}>{g.grade}</Text>
              <Text style={[styles.scaleCell, { flex: 1 }]}>{g.range}</Text>
              <Text style={[styles.scaleCell, { flex: 1.5 }]}>{g.remark}</Text>
              {activeTab === 'lower' && <Text style={[styles.scaleCell, { flex: 2, color: colors.textLight }]}>{(g as any).descriptor}</Text>}
            </View>
          ))}
        </WidgetCard>

        <WidgetCard title="Configured Grading Policies">
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : policies.length === 0 ? (
            <Text style={styles.emptyText}>No grading policies configured</Text>
          ) : (
            (activeTab === 'lower' ? lowerPolicies : upperPolicies).map((p: any) => (
              <View key={p.id} style={styles.policyRow}>
                <View style={styles.policyInfo}>
                  <Text style={styles.policyName}>{p.name}</Text>
                  <Text style={styles.policyCode}>{p.code}</Text>
                </View>
                <View style={[styles.policyBadge, p.isDefault && styles.policyBadgeDefault]}>
                  <Text style={[styles.policyBadgeText, p.isDefault && styles.policyBadgeTextDefault]}>
                    {p.isDefault ? 'Default' : p.type}
                  </Text>
                </View>
              </View>
            ))
          )}
        </WidgetCard>

        <View style={styles.compareCard}>
          <Text style={styles.compareTitle}>Primary vs Secondary Grading</Text>
          <View style={styles.compareRow}>
            <Text style={styles.compareLabel}>Pass Threshold</Text>
            <Text style={styles.compareValue}>35% (Primary)</Text>
            <Text style={styles.compareValueSec}>50% (Secondary)</Text>
          </View>
          <View style={styles.compareRow}>
            <Text style={styles.compareLabel}>Grades 1-4</Text>
            <Text style={styles.compareValue}>Competency (A-E)</Text>
            <Text style={styles.compareValueSec}>N/A</Text>
          </View>
          <View style={styles.compareRow}>
            <Text style={styles.compareLabel}>Grades 5-7</Text>
            <Text style={styles.compareValue}>Standard (A-F)</Text>
            <Text style={styles.compareValueSec}>Standard (A-F)</Text>
          </View>
          <View style={styles.compareRow}>
            <Text style={styles.compareLabel}>Grade 7</Text>
            <Text style={styles.compareValue}>ECZ National</Text>
            <Text style={styles.compareValueSec}>ECZ / School</Text>
          </View>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  infoBanner: { flexDirection: 'row', backgroundColor: colors.infoLight, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.lg, alignItems: 'flex-start' },
  infoBannerIcon: { fontSize: 18, marginRight: spacing.sm, marginTop: 1 },
  infoBannerText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  infoBold: { fontWeight: '700' },
  tabRow: { flexDirection: 'row', marginBottom: spacing.md, gap: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.lg, backgroundColor: colors.white, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.text },
  tabTextActive: { color: colors.white },
  scaleDesc: { fontSize: 13, color: colors.textLight, marginBottom: spacing.md, fontStyle: 'italic' },
  scaleHeader: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: colors.border, paddingBottom: spacing.sm, marginBottom: spacing.sm },
  scaleHeaderCell: { fontSize: 12, fontWeight: '700', color: colors.textLight, textTransform: 'uppercase' },
  scaleRow: { flexDirection: 'row', paddingVertical: spacing.sm },
  scaleRowBorder: { borderTopWidth: 1, borderTopColor: colors.borderLight },
  scaleCell: { fontSize: 13, color: colors.text },
  emptyText: { fontSize: 14, color: colors.textLight, textAlign: 'center', paddingVertical: spacing.lg },
  policyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  policyInfo: { flex: 1 },
  policyName: { fontSize: 14, fontWeight: '600', color: colors.text },
  policyCode: { fontSize: 12, color: colors.textLight, marginTop: 1 },
  policyBadge: { backgroundColor: colors.borderLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.sm },
  policyBadgeDefault: { backgroundColor: colors.successLight },
  policyBadgeText: { fontSize: 11, color: colors.textLight, fontWeight: '600' },
  policyBadgeTextDefault: { color: colors.success },
  compareCard: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md },
  compareTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  compareRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  compareLabel: { flex: 1, fontSize: 13, color: colors.textLight },
  compareValue: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.success },
  compareValueSec: { flex: 1, fontSize: 13, color: colors.text },
});
