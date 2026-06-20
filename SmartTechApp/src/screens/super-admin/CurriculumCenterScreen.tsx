import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';

interface Props { onToggleDrawer?: () => void }

export const SuperAdminCurriculumCenterScreen: React.FC<Props> = ({ onToggleDrawer }) => {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [eocs, setEocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'subjects' | 'topics' | 'eocs'>('subjects');
  const [newTopicName, setNewTopicName] = useState('');
  const [newEocName, setNewEocName] = useState('');

  const loadSubjects = useCallback(async () => {
    try {
      const res = await apiService.getSubjects();
      setSubjects(Array.isArray(res) ? res : res?.data || res?.subjects || []);
    } catch (err) {
      console.error('Failed to load subjects:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  const loadSubjectData = async (subject: any) => {
    setSelectedSubject(subject);
    setLoading(true);
    try {
      const [topicsRes, eocsRes] = await Promise.all([
        apiService.getTopics(subject.id).catch(() => []),
        apiService.getElementsOfConstruct(subject.id).catch(() => []),
      ]);
      setTopics(Array.isArray(topicsRes) ? topicsRes : topicsRes?.data || []);
      setEocs(Array.isArray(eocsRes) ? eocsRes : eocsRes?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTopic = async () => {
    if (!newTopicName.trim() || !selectedSubject) return;
    try {
      await apiService.createTopic({ name: newTopicName, subjectId: selectedSubject.id });
      setNewTopicName('');
      loadSubjectData(selectedSubject);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create topic');
    }
  };

  const handleAddEoc = async () => {
    if (!newEocName.trim() || !selectedSubject) return;
    try {
      await apiService.createElementOfConstruct({ name: newEocName, subjectId: selectedSubject.id });
      setNewEocName('');
      loadSubjectData(selectedSubject);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create EoC');
    }
  };

  const onRefresh = () => { setRefreshing(true); loadSubjects(); };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Curriculum Center"
        subtitle={selectedSubject ? selectedSubject.name : 'Manage curriculum'}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
      />

      {selectedSubject && (
        <View style={styles.backRow}>
          <TouchableOpacity onPress={() => { setSelectedSubject(null); setTopics([]); setEocs([]); }}>
            <Text style={styles.backText}>← Back to Subjects</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.tabRow}>
        {['subjects', 'topics', 'eocs'].map(t => (
          <TouchableOpacity
            key={t} style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => { setTab(t as any); if (t !== 'subjects' && !selectedSubject) return; }}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'subjects' ? '📚 Subjects' : t === 'topics' ? '📝 Topics' : '🎯 EoCs'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {tab === 'subjects' && (
          <>
            {loading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
            : subjects.length === 0 ? (
              <View style={styles.emptyState}><Text style={styles.emptyIcon}>📚</Text><Text style={styles.emptyText}>No subjects found</Text></View>
            ) : subjects.map(s => (
              <TouchableOpacity key={s.id} style={styles.subjectCard} onPress={() => { loadSubjectData(s); setTab('topics'); }}>
                <View style={styles.subjectAvatar}><Text style={styles.subjectAvatarText}>{(s.name||'?')[0]}</Text></View>
                <View style={styles.subjectInfo}>
                  <Text style={styles.subjectName}>{s.name}</Text>
                  {s.code && <Text style={styles.subjectCode}>{s.code}</Text>}
                </View>
                <Text style={styles.arrow}>→</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {tab === 'topics' && selectedSubject && (
          <>
            <WidgetCard title="Add Topic">
              <View style={styles.addRow}>
                <TextInput style={styles.addInput} placeholder="Topic name" value={newTopicName} onChangeText={setNewTopicName} placeholderTextColor={colors.textLight} />
                <TouchableOpacity style={styles.addBtn} onPress={handleAddTopic}><Text style={styles.addBtnText}>+</Text></TouchableOpacity>
              </View>
            </WidgetCard>
            {topics.map(t => (
              <View key={t.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{t.name}</Text>
                <Text style={styles.itemMeta}>{t.subtopics?.length || 0} subtopics • {t.competencies?.length || 0} competencies</Text>
                {t.subtopics?.length > 0 && (
                  <View style={styles.subList}>
                    {t.subtopics.map((st: any) => (
                      <Text key={st.id} style={styles.subItem}>• {st.name}</Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        {tab === 'eocs' && selectedSubject && (
          <>
            <WidgetCard title="Add Element of Construct">
              <View style={styles.addRow}>
                <TextInput style={styles.addInput} placeholder="EoC name" value={newEocName} onChangeText={setNewEocName} placeholderTextColor={colors.textLight} />
                <TouchableOpacity style={styles.addBtn} onPress={handleAddEoc}><Text style={styles.addBtnText}>+</Text></TouchableOpacity>
              </View>
            </WidgetCard>
            {eocs.map(e => (
              <View key={e.id} style={styles.itemCard}>
                <Text style={styles.itemTitle}>{e.name}</Text>
                <Text style={styles.itemMeta}>{e.competencies?.length || 0} competencies</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  backText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  tabRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.white, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.textLight },
  tabTextActive: { color: colors.white },
  scroll: { padding: spacing.md, paddingTop: 0 },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 14, color: colors.textLight },
  subjectCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm },
  subjectAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.infoLight, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  subjectAvatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  subjectInfo: { flex: 1 },
  subjectName: { fontSize: 15, fontWeight: '600', color: colors.text },
  subjectCode: { fontSize: 12, color: colors.textLight, marginTop: 1 },
  arrow: { fontSize: 18, color: colors.textLight },
  addRow: { flexDirection: 'row', gap: spacing.sm },
  addInput: { flex: 1, backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.md, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  addBtnText: { fontSize: 22, color: colors.white, fontWeight: '600', marginTop: -2 },
  itemCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm },
  itemTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  itemMeta: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  subList: { marginTop: spacing.sm, paddingLeft: spacing.sm },
  subItem: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
});
