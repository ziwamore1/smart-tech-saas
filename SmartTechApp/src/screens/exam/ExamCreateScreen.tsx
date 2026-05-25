import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Loading } from '../../components';
import { colors, spacing, borderRadius } from '../../theme';
import { apiService } from '../../services/api';

export const ExamCreateScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('60');
  const [totalScore, setTotalScore] = useState('100');
  const [passingScore, setPassingScore] = useState('50');
  const [instructions, setInstructions] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an exam title');
      return;
    }

    setSaving(true);
    try {
      await apiService.createExam({
        title: title.trim(),
        description: description.trim(),
        duration: parseInt(duration) || 60,
        totalScore: parseInt(totalScore) || 100,
        passingScore: parseInt(passingScore) || 50,
        instructions: instructions.trim(),
        scheduledDate: scheduledDate ? scheduledDate.toISOString() : undefined,
      } as any);
      Alert.alert('Success', 'Exam created successfully');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create exam');
    } finally {
      setSaving(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setScheduledDate(selectedDate);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Create Exam</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Enter exam title"
          placeholderTextColor={colors.textLight}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Enter description"
          placeholderTextColor={colors.textLight}
          multiline
          numberOfLines={3}
        />

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>Duration (min)</Text>
            <TextInput
              style={styles.input}
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              placeholder="60"
              placeholderTextColor={colors.textLight}
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>Total Marks</Text>
            <TextInput
              style={styles.input}
              value={totalScore}
              onChangeText={setTotalScore}
              keyboardType="numeric"
              placeholder="100"
              placeholderTextColor={colors.textLight}
            />
          </View>
        </View>

        <Text style={styles.label}>Passing Score (%)</Text>
        <TextInput
          style={styles.input}
          value={passingScore}
          onChangeText={setPassingScore}
          keyboardType="numeric"
          placeholder="50"
          placeholderTextColor={colors.textLight}
        />

        <Text style={styles.label}>Instructions</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={instructions}
          onChangeText={setInstructions}
          placeholder="Enter exam instructions"
          placeholderTextColor={colors.textLight}
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Scheduled Date (optional)</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
          <Text style={[styles.dateBtnText, scheduledDate && styles.dateBtnTextActive]}>
            {scheduledDate ? scheduledDate.toLocaleDateString() : 'Select date'}
          </Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={scheduledDate || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        )}

        <Button
          title={saving ? 'Creating...' : 'Create Exam'}
          onPress={handleCreate}
          loading={saving}
          size="large"
          style={styles.createBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { fontSize: 16, color: colors.secondary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  scrollContent: { padding: spacing.lg, paddingBottom: 120 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.md, height: 44,
    fontSize: 15, color: colors.text,
  },
  textArea: { height: 80, paddingTop: spacing.sm, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: spacing.md },
  halfField: { flex: 1 },
  dateBtn: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, marginTop: spacing.xs },
  dateBtnText: { fontSize: 15, color: colors.textLight },
  dateBtnTextActive: { color: colors.text },
  createBtn: { marginTop: spacing.xl },
});
