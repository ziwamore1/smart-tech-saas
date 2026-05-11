import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, Loading } from '../../components';
import { colors, spacing } from '../../theme';
import { apiService } from '../../services/api';
import { useAppStore } from '../../store';

export const TeacherMarksScreen: React.FC = () => {
  const { dashboard } = useAppStore();
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [clsRes, subjRes] = await Promise.allSettled([
        apiService.getTeacherClasses(),
        apiService.getTeacherSubjects(),
      ]);
      if (clsRes.status === 'fulfilled') {
        const d = clsRes.value?.data || clsRes.value;
        setClasses(Array.isArray(d) ? d : d?.classes || []);
      }
      if (subjRes.status === 'fulfilled') {
        const d = subjRes.value?.data || subjRes.value;
        setSubjects(Array.isArray(d) ? d : d?.subjects || []);
      }
    } catch (err) { console.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const handleClassChange = (cls: any) => {
    setSelectedClass(cls?.id || cls);
    if (cls?.students) {
      setStudents(cls.students);
      const initial: Record<string, string> = {};
      cls.students.forEach((s: any) => { initial[s.id] = ''; });
      setScores(initial);
    }
  };

  const handleSubmit = async () => {
    const termId = dashboard?.currentTerm?.id;
    if (!selectedClass || !selectedSubject || !termId) {
      Alert.alert('Error', 'Select class, subject, and ensure a term is active');
      return;
    }
    const scoresArray = Object.entries(scores)
      .filter(([, score]) => score.trim() !== '')
      .map(([studentId, score]) => ({ studentId, score: parseFloat(score) }));

    if (scoresArray.length === 0) {
      Alert.alert('Error', 'Enter at least one score');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.enterMarks(selectedClass, selectedSubject, termId, scoresArray);
      Alert.alert('Success', 'Marks saved successfully');
      setScores({});
      setStudents([]);
    } catch (err) {
      Alert.alert('Error', 'Failed to save marks');
    }
    finally { setSubmitting(false); }
  };

  if (loading) return <Loading fullScreen />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Enter Marks</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Card variant="outlined" style={{ padding: spacing.md, marginBottom: spacing.md }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm }}>Select Class</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
            {classes.map((cls: any) => (
              <TouchableOpacity key={cls.id} onPress={() => handleClassChange(cls)} style={[styles.filterChip, selectedClass === (cls.id || cls) && { backgroundColor: colors.primary }]}>
                <Text style={[styles.filterChipText, selectedClass === (cls.id || cls) && { color: colors.white }]}>{cls.name || cls.className || cls.class?.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm }}>Select Subject</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {subjects.map((subj: any) => (
              <TouchableOpacity key={subj.id} onPress={() => setSelectedSubject(subj.id)} style={[styles.filterChip, selectedSubject === subj.id && { backgroundColor: colors.secondary }]}>
                <Text style={[styles.filterChipText, selectedSubject === subj.id && { color: colors.white }]}>{subj.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Card>

        {students.length > 0 && (
          <>
            {students.map((student: any) => (
              <Card key={student.id} variant="outlined" style={{ padding: spacing.md, marginBottom: spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{student.firstName} {student.lastName}</Text>
                    <Text style={{ fontSize: 12, color: colors.textLight }}>{student.admissionNumber || ''}</Text>
                  </View>
                  <TextInput
                    style={styles.scoreInput}
                    placeholder="Score"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                    value={scores[student.id] || ''}
                    onChangeText={(v) => setScores(prev => ({ ...prev, [student.id]: v }))}
                  />
                </View>
              </Card>
            ))}
            <Button title="Submit Marks" onPress={handleSubmit} loading={submitting} style={{ marginTop: spacing.md }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.border, borderRadius: 20, marginRight: spacing.sm },
  filterChipText: { fontSize: 13, fontWeight: '500', color: colors.text },
  scoreInput: { width: 80, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
});
