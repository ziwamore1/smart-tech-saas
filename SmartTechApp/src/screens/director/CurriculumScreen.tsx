import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../../theme';
import { apiService } from '../../services/api';
import { HeaderBar } from '../../components';

export const CurriculumScreen: React.FC<{ onToggleDrawer?: () => void }> = ({ onToggleDrawer }) => {
  const [loading, setLoading] = useState(true);
  const [levels, setLevels] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'levels' | 'versions' | 'stages'>('levels');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [levelsRes, versionsRes, stagesRes] = await Promise.all([
        apiService.getEducationLevels(),
        apiService.getCurriculumVersions(),
        apiService.getAcademicStages(),
      ]);
      setLevels(Array.isArray(levelsRes) ? levelsRes : levelsRes?.data || []);
      setVersions(Array.isArray(versionsRes) ? versionsRes : versionsRes?.data || []);
      setStages(Array.isArray(stagesRes) ? stagesRes : stagesRes?.data || []);
    } catch (e) {
      console.error('Failed to load curriculum data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const tabs = [
    { key: 'levels' as const, label: 'Levels', count: levels.length },
    { key: 'versions' as const, label: 'Versions', count: versions.length },
    { key: 'stages' as const, label: 'Stages', count: stages.length },
  ];

  const renderLevels = () => (
    levels.map((l: any) => (
      <View key={l.id} style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemCode}>{l.code}</Text>
          <Text style={styles.itemName}>{l.name}</Text>
        </View>
        {l.description ? <Text style={styles.itemDesc}>{l.description}</Text> : null}
      </View>
    ))
  );

  const renderVersions = () => (
    versions.map((v: any) => (
      <View key={v.id} style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemCode}>{v.code}</Text>
          <Text style={styles.itemName}>{v.name}</Text>
          {v.isCurrent ? <View style={styles.activeBadge}><Text style={styles.activeText}>ACTIVE</Text></View> : null}
        </View>
        {v.educationLevel?.name ? <Text style={styles.itemDesc}>Level: {v.educationLevel.name}</Text> : null}
        {v.effectiveFrom ? (
          <Text style={styles.itemDesc}>
            {new Date(v.effectiveFrom).toLocaleDateString()}
            {v.effectiveTo ? ` → ${new Date(v.effectiveTo).toLocaleDateString()}` : ''}
          </Text>
        ) : null}
      </View>
    ))
  );

  const renderStages = () => (
    [...stages]
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
      .map((s: any) => (
        <View key={s.id} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.stageOrder}>#{s.sortOrder}</Text>
            <Text style={styles.itemCode}>{s.code}</Text>
            <Text style={styles.itemName}>{s.name}</Text>
          </View>
          {s.educationLevel?.name ? <Text style={styles.itemDesc}>{s.educationLevel.name}</Text> : null}
        </View>
      ))
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar title="Curriculum" onToggleDrawer={onToggleDrawer} />

      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label} ({tab.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : activeTab === 'levels' ? (renderLevels()) :
          activeTab === 'versions' ? (renderVersions()) :
          (renderStages())}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: 8, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: borderRadius.md, backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: '#EEF2FF' },
  tabText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  tabTextActive: { color: '#4F46E5', fontWeight: '600' },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 40 },
  loader: { marginTop: 60 },
  itemCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: borderRadius.md, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemCode: { fontSize: 11, fontWeight: '700', color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1F2937', flex: 1 },
  itemDesc: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  stageOrder: { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
  activeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: '#F0FDF4' },
  activeText: { fontSize: 10, fontWeight: '700', color: '#16A34A' },
});
