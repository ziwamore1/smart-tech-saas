import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Loading } from '../../components';
import { colors, spacing } from '../../theme';
import { useAppStore } from '../../store';
import { apiService } from '../../services/api';
import { useRoute, RouteProp } from '@react-navigation/native';

export const ParentChildResultsScreen: React.FC = () => {
  const route = useRoute<RouteProp<any>>();
  const { dashboard } = useAppStore();
  const childId = route.params?.childId || dashboard?.children?.[0]?.id;
  const childName = route.params?.childName || dashboard?.children?.[0]?.name;
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (childId) loadResults();
    else setLoading(false);
  }, [childId]);

  const loadResults = async () => {
    try {
      const termId = dashboard?.currentTerm?.id;
      if (termId) {
        const res = await apiService.getParentChildResults(childId, termId);
        const data = res?.data || res;
        setResults(Array.isArray(data) ? data : data?.results || data?.subjects || []);
      }
    } catch (err) { console.error('Failed to load results'); }
    finally { setLoading(false); }
  };

  if (loading) return <Loading fullScreen />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{childName || 'Child'}'s Results</Text>
        <Text style={styles.headerSub}>{dashboard?.currentTerm?.name}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {results.length === 0 ? (
          <Card style={{ padding: spacing.xl }}>
            <Text style={{ textAlign: 'center', color: colors.textLight }}>No results available</Text>
          </Card>
        ) : (
          results.map((r: any, i: number) => (
            <Card key={r.id || i} variant="outlined" style={styles.resultCard}>
              <View style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.subject}>{r.subject?.name || r.subject || 'Subject'}</Text>
                  <Text style={styles.meta}>Grade: {r.grade || '-'} {r.remark ? `- ${r.remark}` : ''}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: (r.score || 0) >= 75 ? '#d1fae5' : (r.score || 0) >= 50 ? '#fef3c7' : '#fee2e2' }]}>
                  <Text style={[styles.score, { color: (r.score || 0) >= 75 ? '#059669' : (r.score || 0) >= 50 ? '#d97706' : '#dc2626' }]}>{r.score || 0}%</Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  headerSub: { fontSize: 14, color: colors.textLight, marginTop: 2 },
  scrollContent: { padding: spacing.md, gap: spacing.sm },
  resultCard: { padding: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  info: { flex: 1 },
  subject: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  badge: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 8 },
  score: { fontSize: 18, fontWeight: '700' },
});
