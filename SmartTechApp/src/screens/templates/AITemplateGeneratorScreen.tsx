import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiService } from '../../services/api';
import { AITemplateSuggestion, GeneratedLayout } from '../../types';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';

const TEMPLATE_TYPES = [
  { id: 'report_card', label: 'Report Card', icon: '📋' },
  { id: 'certificate', label: 'Certificate', icon: '🏆' },
  { id: 'transcript', label: 'Transcript', icon: '📜' },
  { id: 'progress_report', label: 'Progress Report', icon: '📊' },
];

const STYLE_OPTIONS = ['modern', 'classic', 'minimalist'];

export function AITemplateGeneratorScreen({ navigation }: any) {
  const [selectedType, setSelectedType] = useState<string>('');
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');
  const [style, setStyle] = useState('modern');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeRankings, setIncludeRankings] = useState(false);
  const [studentId, setStudentId] = useState('');

  const [suggestions, setSuggestions] = useState<AITemplateSuggestion[]>([]);
  const [generatedLayout, setGeneratedLayout] = useState<GeneratedLayout | null>(null);
  const [createdTemplateId, setCreatedTemplateId] = useState<string | null>(null);

  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const data = await apiService.getAITemplateSuggestions();
      setSuggestions(data?.suggestions ?? data ?? []);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to load suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleGenerateLayout = async () => {
    if (!selectedType) {
      Alert.alert('Selection Required', 'Please select a template type');
      return;
    }
    setGenerating(true);
    setGeneratedLayout(null);
    setCreatedTemplateId(null);
    try {
      const preferences = { colorScheme, style, includeCharts, includeRankings };
      const data = await apiService.generateAILayout(selectedType, preferences);
      setGeneratedLayout(data?.layout ?? data);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to generate layout');
    } finally {
      setGenerating(false);
    }
  };

  const handleSuggestFromStudent = async () => {
    if (!studentId.trim()) {
      Alert.alert('Input Required', 'Please enter a Student ID');
      return;
    }
    setSuggesting(true);
    setGeneratedLayout(null);
    setCreatedTemplateId(null);
    try {
      const data = await apiService.suggestTemplateFromStudentData(studentId.trim());
      setGeneratedLayout(data?.layout ?? data);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to get suggestion');
    } finally {
      setSuggesting(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!generatedLayout) return;
    setCreating(true);
    try {
      const payload = {
        name: `${selectedType.replace('_', ' ')} Template`,
        templateType: selectedType,
        layoutJson: generatedLayout,
        primaryColor: colorScheme === 'dark' ? '#1e293b' : colors.primary,
        secondaryColor: colors.secondary,
        colorPalette: { mode: colorScheme },
      };
      const result = await apiService.createTemplate(payload);
      setCreatedTemplateId(result?.id ?? result?.template?.id ?? '');
      Alert.alert('Success', 'Template created successfully');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create template');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>AI Template Generator</Text>

        <Text style={styles.sectionTitle}>AI Suggestions</Text>
        {loadingSuggestions ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : suggestions.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionsRow}>
            {suggestions.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.suggestionCard}
                onPress={() => {
                  setSelectedType(s.type);
                }}
              >
                <Text style={styles.suggestionTitle}>{s.title}</Text>
                <Text style={styles.suggestionDesc} numberOfLines={2}>{s.description}</Text>
                <Text style={styles.suggestionMeta}>Type: {s.type} | Popularity: {s.popularity}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>No suggestions available</Text>
        )}

        <Text style={styles.sectionTitle}>Template Type</Text>
        <View style={styles.typeGrid}>
          {TEMPLATE_TYPES.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[styles.typeCard, selectedType === t.id && styles.typeCardActive]}
              onPress={() => setSelectedType(t.id)}
            >
              <Text style={styles.typeIcon}>{t.icon}</Text>
              <Text style={[styles.typeLabel, selectedType === t.id && styles.typeLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.prefsCard}>
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Color Scheme</Text>
            <View style={styles.toggleGroup}>
              <TouchableOpacity
                style={[styles.toggleBtn, colorScheme === 'light' && styles.toggleBtnActive]}
                onPress={() => setColorScheme('light')}
              >
                <Text style={[styles.toggleText, colorScheme === 'light' && styles.toggleTextActive]}>Light</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, colorScheme === 'dark' && styles.toggleBtnActive]}
                onPress={() => setColorScheme('dark')}
              >
                <Text style={[styles.toggleText, colorScheme === 'dark' && styles.toggleTextActive]}>Dark</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Style</Text>
            <View style={styles.toggleGroup}>
              {STYLE_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.toggleBtn, style === s && styles.toggleBtnActive]}
                  onPress={() => setStyle(s)}
                >
                  <Text style={[styles.toggleText, style === s && styles.toggleTextActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.prefLabel}>Include Charts</Text>
            <Switch value={includeCharts} onValueChange={setIncludeCharts} trackColor={{ false: colors.border, true: colors.primary }} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.prefLabel}>Include Rankings</Text>
            <Switch value={includeRankings} onValueChange={setIncludeRankings} trackColor={{ false: colors.border, true: colors.primary }} />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, styles.generateBtn]}
          onPress={handleGenerateLayout}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.actionBtnText}>Generate Layout</Text>
          )}
        </TouchableOpacity>

        <View style={styles.studentSection}>
          <Text style={styles.sectionTitle}>Suggest from Student Data</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter Student ID"
            placeholderTextColor={colors.textLight}
            value={studentId}
            onChangeText={setStudentId}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[styles.actionBtn, styles.suggestBtn]}
            onPress={handleSuggestFromStudent}
            disabled={suggesting}
          >
            {suggesting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.actionBtnText}>Suggest from Student Data</Text>
            )}
          </TouchableOpacity>
        </View>

        {generatedLayout && (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>Generated Layout Preview</Text>
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>Page Size: <Text style={styles.previewValue}>{generatedLayout.pageSize || 'A4'}</Text></Text>
              <Text style={styles.previewLabel}>Orientation: <Text style={styles.previewValue}>{generatedLayout.orientation || 'portrait'}</Text></Text>
              <Text style={styles.previewLabel}>Components ({generatedLayout.components?.length || 0}):</Text>
              {(generatedLayout.components || []).map((c, i) => (
                <View key={c.id || i} style={styles.componentItem}>
                  <Text style={styles.componentType}>{c.type}</Text>
                  <Text style={styles.componentLabel}>{c.label}</Text>
                </View>
              ))}
            </View>
            {createdTemplateId ? (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>Template created: {createdTemplateId}</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, styles.createBtn]}
                onPress={handleCreateTemplate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.actionBtnText}>Create Template</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.h1, marginBottom: spacing.lg },
  sectionTitle: { ...typography.h3, marginTop: spacing.md, marginBottom: spacing.sm },
  loader: { padding: spacing.lg },
  suggestionsRow: { marginBottom: spacing.sm },
  suggestionCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginRight: spacing.sm,
    width: 220,
    ...shadows.sm,
  },
  suggestionTitle: { ...typography.body, fontWeight: '600' },
  suggestionDesc: { ...typography.bodySmall, marginTop: spacing.xs },
  suggestionMeta: { ...typography.caption, marginTop: spacing.xs },
  emptyText: { ...typography.bodySmall, textAlign: 'center', padding: spacing.lg },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.sm,
  },
  typeCardActive: { borderColor: colors.primary, backgroundColor: '#eff6ff' },
  typeIcon: { fontSize: 32, marginBottom: spacing.sm },
  typeLabel: { ...typography.body, fontWeight: '500' },
  typeLabelActive: { color: colors.primary, fontWeight: '700' },
  prefsCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  prefLabel: { ...typography.body, fontWeight: '500' },
  toggleGroup: { flexDirection: 'row', gap: spacing.xs },
  toggleBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleText: { ...typography.bodySmall, fontWeight: '500' },
  toggleTextActive: { color: colors.white },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  actionBtn: {
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 48,
  },
  generateBtn: { backgroundColor: colors.primary },
  suggestBtn: { backgroundColor: colors.secondary },
  createBtn: { backgroundColor: colors.success },
  actionBtnText: { color: colors.white, fontSize: 16, fontWeight: '600' },
  studentSection: { marginTop: spacing.md },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  resultsSection: { marginTop: spacing.lg },
  previewCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  previewLabel: { ...typography.body, marginBottom: spacing.xs },
  previewValue: { fontWeight: '600' },
  componentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  componentType: { ...typography.bodySmall, fontWeight: '600', color: colors.primary },
  componentLabel: { ...typography.bodySmall, color: colors.textLight },
  successBanner: {
    backgroundColor: '#f0fdf4',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  successText: { ...typography.body, color: colors.success, fontWeight: '600' },
});
