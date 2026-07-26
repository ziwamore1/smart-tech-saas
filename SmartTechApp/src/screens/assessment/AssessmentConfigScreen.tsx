import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Loading, Card } from '../../components';
import { colors, spacing, shadows, typography } from '../../theme';
import { useAuthStore } from '../../store';
import { useAssessmentStore } from '../../store/assessment-store';
import { apiService } from '../../services/api';

interface WeightingInput {
  assessmentDefId: string;
  name: string;
  weight: string;
}

export const AssessmentConfigScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { user } = useAuthStore();
  const { configurations, loading, fetchConfigurations, updateConfiguration } = useAssessmentStore();

  const [classId, setClassId] = useState<string>('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [termId, setTermId] = useState<string>('');
  const [weightings, setWeightings] = useState<WeightingInput[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const routeParams = navigation.getState()?.routes?.[navigation.getState().routes.length - 1]?.params as any;
    if (routeParams?.classId && routeParams?.subjectId && routeParams?.termId) {
      setClassId(routeParams.classId);
      setSubjectId(routeParams.subjectId);
      setTermId(routeParams.termId);
      fetchConfigurations(routeParams.classId, routeParams.subjectId, routeParams.termId);
    }
  }, []);

  useEffect(() => {
    if (configurations.length > 0) {
      const newWeightings = configurations.map(c => ({
        assessmentDefId: c.assessmentDefId,
        name: c.assessmentDef?.name || 'Unknown',
        weight: (c.weightPercentage ?? 0).toString(),
      }));
      setWeightings(newWeightings);
    }
  }, [configurations]);

  const totalWeight = weightings.reduce((sum, w) => sum + (parseFloat(w.weight) || 0), 0);

  const updateWeight = (index: number, value: string) => {
    setWeightings(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], weight: value };
      return updated;
    });
  };

  const handleSave = async () => {
    if (totalWeight !== 100) {
      Alert.alert('Invalid Weights', `Total weight must be 100%. Current: ${totalWeight}%`);
      return;
    }

    setSaving(true);

    try {
      const promises = weightings.map(w =>
        updateConfiguration(classId, subjectId, termId, w.assessmentDefId, parseFloat(w.weight))
      );
      await Promise.all(promises);

      Alert.alert('Success', 'Assessment weights updated successfully');
      fetchConfigurations(classId, subjectId, termId);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update weights');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    Alert.alert(
      'Reset Weights',
      'Reset all weights to equal distribution?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            if (weightings.length === 0) return;
            const equalWeight = Math.floor(100 / weightings.length);
            setWeightings(prev =>
              prev.map(w => ({ ...w, weight: equalWeight.toString() }))
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Assessment Config</Text>
          <Text style={styles.headerSubtitle}>Configure weightings</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.configCard}>
          <Text style={styles.sectionTitle}>Weight Distribution</Text>
          <Text style={styles.sectionSubtitle}>
            Total: <Text style={totalWeight === 100 ? styles.validText : styles.invalidText}>{totalWeight}%</Text>
            {totalWeight !== 100 && ' (must be 100%)'}
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Loading size="small" color={colors.primary} />
            </View>
          ) : (
            weightings.map((w, index) => (
              <View key={w.assessmentDefId} style={styles.weightRow}>
                <View style={styles.weightInfo}>
                  <Text style={styles.weightName}>{w.name}</Text>
                </View>
                <View style={styles.weightInputContainer}>
                  <TextInput
                    style={styles.weightInput}
                    value={w.weight}
                    onChangeText={value => updateWeight(index, value)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                  <Text style={styles.percentSymbol}>%</Text>
                </View>
              </View>
            ))
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Reset Equal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving || totalWeight !== 100}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save Weights'}
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>Weight Guidelines</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoDot}>•</Text>
            <Text style={styles.infoText}>Total weight must equal 100%</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoDot}>•</Text>
            <Text style={styles.infoText}>Higher weight = more impact on final grade</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoDot}>•</Text>
            <Text style={styles.infoText}>Typical: Exam 50%, Tests 30%, Homework 20%</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoDot}>•</Text>
            <Text style={styles.infoText}>Weights can be different per class/subject</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    ...shadows.header,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: colors.primary,
  },
  headerCenter: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.textLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  configCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  validText: {
    color: colors.success,
    fontWeight: '700',
  },
  invalidText: {
    color: colors.error,
    fontWeight: '700',
  },
  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  weightInfo: {
    flex: 1,
  },
  weightName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '500',
  },
  weightInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  weightInput: {
    width: 50,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: 8,
  },
  percentSymbol: {
    ...typography.bodySmall,
    color: colors.textLight,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  resetButton: {
    flex: 1,
    backgroundColor: colors.borderLight,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  saveButton: {
    flex: 2,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  infoCard: {
    padding: spacing.md,
    backgroundColor: colors.info + '10',
    borderColor: colors.info + '30',
  },
  infoTitle: {
    ...typography.body,
    color: colors.info,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  infoDot: {
    color: colors.info,
    marginRight: spacing.sm,
    fontSize: 16,
  },
  infoText: {
    flex: 1,
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
