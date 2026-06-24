import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Loading, HeaderBar } from '../../components';
import { colors, spacing } from '../../theme';
import { apiService } from '../../services/api';

interface TeacherClassesProps {
  onToggleDrawer?: () => void;
}

export const TeacherClassesScreen: React.FC<TeacherClassesProps> = ({ onToggleDrawer }) => {
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [clsRes, subjRes] = await Promise.allSettled([
        apiService.getTeacherClasses(),
        apiService.getTeacherSubjects(),
      ]);
      if (clsRes.status === 'fulfilled') {
        const d = clsRes.value?.data || clsRes.value;
        setClasses(Array.isArray(d) ? d : d?.classes || d?.students || []);
      }
      if (subjRes.status === 'fulfilled') {
        const d = subjRes.value?.data || subjRes.value;
        setSubjects(Array.isArray(d) ? d : d?.subjects || []);
      }
    } catch (err) { console.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  if (loading) return <Loading fullScreen />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar
        title="My Classes"
        subtitle={`${classes.length} classes, ${subjects.length} subjects`}
        leftIcon={onToggleDrawer ? { name: '☰', onPress: onToggleDrawer } : undefined}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {classes.map((cls: any, i: number) => (
          <Card key={cls.id || i} variant="outlined" style={styles.classCard}>
            <View style={styles.classRow}>
              <View style={styles.classIcon}><Text style={{ fontSize: 24 }}>🏫</Text></View>
              <View style={styles.classInfo}>
                <Text style={styles.className}>{cls.name || cls.className || cls.class?.name}</Text>
                <Text style={styles.classMeta}>{cls.studentCount || cls._count?.students || 0} students</Text>
              </View>
            </View>
          </Card>
        ))}
        {classes.length === 0 && (
          <Card style={{ padding: spacing.xl }}>
            <Text style={{ textAlign: 'center', color: colors.textLight }}>No classes assigned</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.md, gap: spacing.sm },
  classCard: { padding: spacing.md },
  classRow: { flexDirection: 'row', alignItems: 'center' },
  classIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' },
  classInfo: { marginLeft: spacing.md, flex: 1 },
  className: { fontSize: 16, fontWeight: '600', color: colors.text },
  classMeta: { fontSize: 13, color: colors.textLight, marginTop: 2 },
});
