import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, StatCard, WidgetCard } from '../../components';
import { colors, spacing, borderRadius } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiService } from '../../services/api';

interface ECEProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

const LEARNING_AREAS = [
  { icon: '🔤', name: 'Language & Literacy', description: 'Early reading, writing, and communication skills through stories, rhymes, and interactive activities' },
  { icon: '🔢', name: 'Numeracy', description: 'Basic number concepts, counting, shapes, and simple problem-solving' },
  { icon: '🎨', name: 'Creative Arts', description: 'Expression through drawing, painting, music, dance, and imaginative play' },
  { icon: '🤸', name: 'Psychomotor Skills', description: 'Fine and gross motor skills development through physical activities and play' },
  { icon: '🤝', name: 'Social & Emotional', description: 'Building relationships, sharing, empathy, and emotional regulation' },
  { icon: '🌿', name: 'Environmental Awareness', description: 'Understanding nature, plants, animals, and basic environmental concepts' },
];

const MILESTONES = [
  { age: '3-4 Years', milestones: ['Recognizes basic colors and shapes', 'Uses 3-4 word sentences', 'Engages in parallel play', 'Can scribble and draw basic lines'] },
  { age: '4-5 Years', milestones: ['Counts to 10', 'Recognizes some letters', 'Plays cooperatively with peers', 'Can use scissors and draw basic shapes'] },
  { age: '5-6 Years', milestones: ['Counts to 20', 'Recognizes all letters', 'Follows multi-step instructions', 'Writes own name', 'Basic reading readiness'] },
];

export const ECEScreen: React.FC<ECEProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [loading, setLoading] = useState(true);
  const [eceLevel, setEceLevel] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const levels = await apiService.getEducationLevels();
        const data = Array.isArray(levels) ? levels : levels?.data || [];
        const found = data.find((l: any) => l.code === 'ECE');
        setEceLevel(found || null);
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="ECE Module"
        subtitle="Early Childhood Education"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard label="Learning Areas" value={LEARNING_AREAS.length} icon="📚" color={colors.purple} bgColor={colors.purpleLight} />
              <StatCard label="Age Range" value="3-6 yrs" icon="👶" color={colors.pink} bgColor={colors.pinkLight} />
              <StatCard label="Status" value={eceLevel ? 'Active' : 'N/A'} icon={eceLevel ? '✅' : '⚪'} color={eceLevel ? colors.success : colors.textLight} bgColor={eceLevel ? colors.successLight : colors.borderLight} />
            </View>

            <WidgetCard title="Learning Areas">
              {LEARNING_AREAS.map((area, idx) => (
                <View key={idx} style={[styles.areaRow, idx < LEARNING_AREAS.length - 1 && styles.areaRowBorder]}>
                  <Text style={styles.areaIcon}>{area.icon}</Text>
                  <View style={styles.areaInfo}>
                    <Text style={styles.areaName}>{area.name}</Text>
                    <Text style={styles.areaDesc}>{area.description}</Text>
                  </View>
                </View>
              ))}
            </WidgetCard>

            <WidgetCard title="Developmental Milestones">
              {MILESTONES.map((stage, idx) => (
                <View key={idx} style={[styles.milestoneGroup, idx < MILESTONES.length - 1 && styles.milestoneBorder]}>
                  <Text style={styles.milestoneAge}>{stage.age}</Text>
                  {stage.milestones.map((m, i) => (
                    <View key={i} style={styles.milestoneRow}>
                      <Text style={styles.milestoneBullet}>•</Text>
                      <Text style={styles.milestoneText}>{m}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </WidgetCard>

            <View style={styles.resourcesCard}>
              <Text style={styles.resourcesTitle}>Additional Resources</Text>
              <TouchableOpacity style={styles.resourceBtn} onPress={() => onNavigate?.('DirectorCurriculum')}>
                <Text style={styles.resourceBtnIcon}>📖</Text>
                <Text style={styles.resourceBtnText}>View ECE Curriculum</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  areaRow: { flexDirection: 'row', paddingVertical: spacing.md },
  areaRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  areaIcon: { fontSize: 28, marginRight: spacing.md, width: 36, textAlign: 'center' },
  areaInfo: { flex: 1 },
  areaName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  areaDesc: { fontSize: 13, color: colors.textLight, lineHeight: 18 },
  milestoneGroup: { paddingVertical: spacing.md },
  milestoneBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  milestoneAge: { fontSize: 15, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  milestoneRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, paddingLeft: spacing.sm },
  milestoneBullet: { fontSize: 14, color: colors.textLight, marginRight: spacing.sm, width: 10 },
  milestoneText: { fontSize: 13, color: colors.text, flex: 1, lineHeight: 18 },
  resourcesCard: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md },
  resourcesTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  resourceBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  resourceBtnIcon: { fontSize: 20, marginRight: spacing.md },
  resourceBtnText: { flex: 1, fontSize: 14, color: colors.text },
  chevron: { fontSize: 20, color: colors.textLight },
});
