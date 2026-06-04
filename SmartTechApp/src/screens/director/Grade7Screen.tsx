import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../../theme';
import { apiService } from '../../services/api';
import { HeaderBar } from '../../components';

export const Grade7Screen: React.FC<{ onToggleDrawer?: () => void }> = ({ onToggleDrawer }) => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, avgScore: 0, div1: 0, div2: 0, div3: 0, div4: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getGrade7Results({});
      const data = Array.isArray(res) ? res : res?.data || res?.results || [];
      setResults(data);

      const divCounts = { total: data.length, avgScore: 0, div1: 0, div2: 0, div3: 0, div4: 0 };
      data.forEach((r: any) => {
        divCounts.avgScore += r.totalStandardized || 0;
        if (r.division === 'DIV_1') divCounts.div1++;
        else if (r.division === 'DIV_2') divCounts.div2++;
        else if (r.division === 'DIV_3') divCounts.div3++;
        else if (r.division === 'DIV_4') divCounts.div4++;
      });
      if (data.length > 0) divCounts.avgScore = parseFloat((divCounts.avgScore / data.length).toFixed(1));
      setStats(divCounts);
    } catch (e) {
      console.error('Failed to load Grade 7 results', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchResults(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchResults();
    setRefreshing(false);
  }, [fetchResults]);

  const sorted = [...results].sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar title="Grade 7 ECZ" onToggleDrawer={onToggleDrawer} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#EEF2FF' }]}>
            <Text style={[styles.statValue, { color: '#4F46E5' }]}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Students</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#F0FDF4' }]}>
            <Text style={[styles.statValue, { color: '#16A34A' }]}>{stats.avgScore}</Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Division Breakdown</Text>
          <View style={styles.divisionRow}>
            {[
              { label: 'Div 1', count: stats.div1, color: '#16A34A', bg: '#F0FDF4' },
              { label: 'Div 2', count: stats.div2, color: '#2563EB', bg: '#EFF6FF' },
              { label: 'Div 3', count: stats.div3, color: '#CA8A04', bg: '#FEFCE8' },
              { label: 'Div 4', count: stats.div4, color: '#DC2626', bg: '#FEF2F2' },
            ].map((d) => (
              <View key={d.label} style={[styles.divisionCard, { backgroundColor: d.bg }]}>
                <Text style={[styles.divisionCount, { color: d.color }]}>{d.count}</Text>
                <Text style={[styles.divisionLabel, { color: d.color }]}>{d.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Student Rankings</Text>
          {loading && !refreshing ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : sorted.length === 0 ? (
            <Text style={styles.emptyText}>No Grade 7 results computed yet. Run batch computation from the web dashboard.</Text>
          ) : (
            sorted.slice(0, 20).map((r: any, i: number) => (
              <View key={r.id || i} style={styles.studentRow}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>{i + 1}</Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>
                    {r.student?.firstName} {r.student?.lastName}
                  </Text>
                  <Text style={styles.studentScore}>Score: {r.totalStandardized ?? '-'}</Text>
                </View>
                <View style={[styles.divisionBadge, {
                  backgroundColor: r.division === 'DIV_1' ? '#F0FDF4' :
                    r.division === 'DIV_2' ? '#EFF6FF' :
                    r.division === 'DIV_3' ? '#FEFCE8' :
                    r.division === 'DIV_4' ? '#FEF2F2' : '#F3F4F6',
                }]}>
                  <Text style={[styles.divisionText, {
                    color: r.division === 'DIV_1' ? '#16A34A' :
                      r.division === 'DIV_2' ? '#2563EB' :
                      r.division === 'DIV_3' ? '#CA8A04' :
                      r.division === 'DIV_4' ? '#DC2626' : '#6B7280',
                  }]}>
                    {r.division?.replace('_', ' ') || '—'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, padding: 16, borderRadius: borderRadius.lg, alignItems: 'center' },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 12 },
  divisionRow: { flexDirection: 'row', gap: 8 },
  divisionCard: { flex: 1, padding: 12, borderRadius: borderRadius.md, alignItems: 'center' },
  divisionCount: { fontSize: 22, fontWeight: '700' },
  divisionLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  loader: { marginTop: 40 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, paddingHorizontal: 20, lineHeight: 20 },
  studentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 12, borderRadius: borderRadius.md, marginBottom: 6, borderWidth: 1, borderColor: '#F3F4F6' },
  rankBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rankText: { fontSize: 14, fontWeight: '700', color: '#4F46E5' },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  studentScore: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  divisionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.sm },
  divisionText: { fontSize: 11, fontWeight: '700' },
});
