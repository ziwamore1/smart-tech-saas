import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiService } from '../../services/api';
import { BrandPreset } from '../../types';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';

const FONT_OPTIONS = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana'];

export function BrandingPresetsScreen({ navigation }: any) {
  const [presets, setPresets] = useState<BrandPreset[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1E3A8A');
  const [secondaryColor, setSecondaryColor] = useState('#14B8A6');
  const [accentColor, setAccentColor] = useState('#F59E0B');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [textColor, setTextColor] = useState('#374151');
  const [headingFont, setHeadingFont] = useState('Arial');
  const [bodyFont, setBodyFont] = useState('Arial');
  const [titleFont, setTitleFont] = useState('Arial');
  const [marginTop, setMarginTop] = useState('20');
  const [marginBottom, setMarginBottom] = useState('20');
  const [marginLeft, setMarginLeft] = useState('20');
  const [marginRight, setMarginRight] = useState('20');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const [applyTemplateId, setApplyTemplateId] = useState('');
  const [applyPresetId, setApplyPresetId] = useState('');
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [applying, setApplying] = useState(false);

  const fetchPresets = useCallback(async () => {
    try {
      const data = await apiService.getBrandingPresets();
      setPresets(data?.presets ?? data ?? []);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to load branding presets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchPresets();
  }, [fetchPresets]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPresets();
  }, [fetchPresets]);

  const resetForm = () => {
    setName('');
    setPrimaryColor('#1E3A8A');
    setSecondaryColor('#14B8A6');
    setAccentColor('#F59E0B');
    setBgColor('#FFFFFF');
    setTextColor('#374151');
    setHeadingFont('Arial');
    setBodyFont('Arial');
    setTitleFont('Arial');
    setMarginTop('20');
    setMarginBottom('20');
    setMarginLeft('20');
    setMarginRight('20');
    setIsDefault(false);
  };

  const handleCreatePreset = async () => {
    if (!name.trim()) {
      Alert.alert('Input Required', 'Please enter a preset name');
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        palette: {
          primary: primaryColor,
          secondary: secondaryColor,
          accent: accentColor,
          background: bgColor,
          text: textColor,
        },
        fonts: { heading: headingFont, body: bodyFont, title: titleFont },
        layout: {
          margins: {
            top: parseInt(marginTop, 10) || 20,
            bottom: parseInt(marginBottom, 10) || 20,
            left: parseInt(marginLeft, 10) || 20,
            right: parseInt(marginRight, 10) || 20,
          },
          spacing: 'normal',
        },
        isDefault,
      };
      const result = await apiService.createBrandingPreset(data);
      setPresets((prev) => [...prev, result?.preset ?? result]);
      setModalVisible(false);
      resetForm();
      Alert.alert('Success', 'Branding preset created');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create preset');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePreset = (id: string) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this preset?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.deleteBrandingPreset(id);
            setPresets((prev) => prev.filter((p) => p.id !== id));
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to delete preset');
          }
        },
      },
    ]);
  };

  const handleEditPreset = (preset: BrandPreset) => {
    setName(preset.name);
    setPrimaryColor(preset.palette.primary);
    setSecondaryColor(preset.palette.secondary);
    setAccentColor(preset.palette.accent);
    setBgColor(preset.palette.background);
    setTextColor(preset.palette.text);
    setHeadingFont(preset.fonts.heading);
    setBodyFont(preset.fonts.body);
    setTitleFont(preset.fonts.title);
    setMarginTop(String(preset.layout.margins.top));
    setMarginBottom(String(preset.layout.margins.bottom));
    setMarginLeft(String(preset.layout.margins.left));
    setMarginRight(String(preset.layout.margins.right));
    setIsDefault(preset.isDefault);
    setModalVisible(true);
  };

  const handleApplyPreset = (presetId: string) => {
    setApplyPresetId(presetId);
    setApplyTemplateId('');
    setApplyModalVisible(true);
  };

  const confirmApplyPreset = async () => {
    if (!applyTemplateId.trim()) {
      Alert.alert('Input Required', 'Please enter a Template ID');
      return;
    }
    setApplying(true);
    try {
      await apiService.applyBrandingToTemplate(applyTemplateId.trim(), applyPresetId);
      setApplyModalVisible(false);
      Alert.alert('Success', 'Branding applied to template');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to apply branding');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Branding Presets</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => { resetForm(); setModalVisible(true); }}>
          <Text style={styles.createBtnText}>+ Create Preset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {presets.length === 0 ? (
          <Text style={styles.emptyText}>No branding presets yet. Create your first one!</Text>
        ) : (
          presets.map((preset) => (
            <View key={preset.id} style={styles.presetCard}>
              <View style={styles.presetHeader}>
                <Text style={styles.presetName}>{preset.name}</Text>
                {preset.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  </View>
                )}
              </View>

              <Text style={styles.sectionLabel}>Color Palette</Text>
              <View style={styles.swatchRow}>
                <View style={[styles.swatch, { backgroundColor: preset.palette.primary }]} />
                <View style={[styles.swatch, { backgroundColor: preset.palette.secondary }]} />
                <View style={[styles.swatch, { backgroundColor: preset.palette.accent }]} />
                <View style={[styles.swatch, { backgroundColor: preset.palette.background, borderWidth: 1, borderColor: colors.border }]} />
                <View style={[styles.swatch, { backgroundColor: preset.palette.text }]} />
              </View>

              <Text style={styles.sectionLabel}>Fonts</Text>
              <Text style={styles.fontInfo}>Heading: {preset.fonts.heading}</Text>
              <Text style={styles.fontInfo}>Body: {preset.fonts.body}</Text>
              <Text style={styles.fontInfo}>Title: {preset.fonts.title}</Text>

              <Text style={styles.sectionLabel}>Margins</Text>
              <Text style={styles.fontInfo}>
                T:{preset.layout.margins.top} B:{preset.layout.margins.bottom} L:{preset.layout.margins.left} R:{preset.layout.margins.right}
              </Text>

              <View style={styles.presetActions}>
                <TouchableOpacity style={styles.applyBtn} onPress={() => handleApplyPreset(preset.id)}>
                  <Text style={styles.applyBtnText}>Apply</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editBtn} onPress={() => handleEditPreset(preset)}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeletePreset(preset.id)}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>{name ? 'Edit Preset' : 'Create Preset'}</Text>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Preset name" placeholderTextColor={colors.textLight} />

            <Text style={styles.fieldLabel}>Colors</Text>
            <View style={styles.colorRow}>
              <View style={styles.colorField}>
                <Text style={styles.colorLabel}>Primary</Text>
                <TextInput style={styles.colorInput} value={primaryColor} onChangeText={setPrimaryColor} placeholder="#1E3A8A" placeholderTextColor={colors.textLight} />
              </View>
              <View style={styles.colorField}>
                <Text style={styles.colorLabel}>Secondary</Text>
                <TextInput style={styles.colorInput} value={secondaryColor} onChangeText={setSecondaryColor} placeholder="#14B8A6" placeholderTextColor={colors.textLight} />
              </View>
            </View>
            <View style={styles.colorRow}>
              <View style={styles.colorField}>
                <Text style={styles.colorLabel}>Accent</Text>
                <TextInput style={styles.colorInput} value={accentColor} onChangeText={setAccentColor} placeholder="#F59E0B" placeholderTextColor={colors.textLight} />
              </View>
              <View style={styles.colorField}>
                <Text style={styles.colorLabel}>Background</Text>
                <TextInput style={styles.colorInput} value={bgColor} onChangeText={setBgColor} placeholder="#FFFFFF" placeholderTextColor={colors.textLight} />
              </View>
            </View>
            <View style={styles.colorRow}>
              <View style={styles.colorField}>
                <Text style={styles.colorLabel}>Text</Text>
                <TextInput style={styles.colorInput} value={textColor} onChangeText={setTextColor} placeholder="#374151" placeholderTextColor={colors.textLight} />
              </View>
              <View style={styles.colorField} />
            </View>

            <Text style={styles.fieldLabel}>Fonts</Text>
            <View style={styles.colorRow}>
              <View style={styles.colorField}>
                <Text style={styles.colorLabel}>Heading</Text>
                <TextInput style={styles.input} value={headingFont} onChangeText={setHeadingFont} placeholder="Arial" placeholderTextColor={colors.textLight} />
              </View>
              <View style={styles.colorField}>
                <Text style={styles.colorLabel}>Body</Text>
                <TextInput style={styles.input} value={bodyFont} onChangeText={setBodyFont} placeholder="Arial" placeholderTextColor={colors.textLight} />
              </View>
            </View>
            <View style={styles.colorRow}>
              <View style={styles.colorField}>
                <Text style={styles.colorLabel}>Title</Text>
                <TextInput style={styles.input} value={titleFont} onChangeText={setTitleFont} placeholder="Arial" placeholderTextColor={colors.textLight} />
              </View>
              <View style={styles.colorField} />
            </View>

            <Text style={styles.fieldLabel}>Margins (px)</Text>
            <View style={styles.colorRow}>
              <View style={styles.colorField}>
                <Text style={styles.colorLabel}>Top</Text>
                <TextInput style={styles.input} value={marginTop} onChangeText={setMarginTop} keyboardType="numeric" placeholder="20" placeholderTextColor={colors.textLight} />
              </View>
              <View style={styles.colorField}>
                <Text style={styles.colorLabel}>Bottom</Text>
                <TextInput style={styles.input} value={marginBottom} onChangeText={setMarginBottom} keyboardType="numeric" placeholder="20" placeholderTextColor={colors.textLight} />
              </View>
            </View>
            <View style={styles.colorRow}>
              <View style={styles.colorField}>
                <Text style={styles.colorLabel}>Left</Text>
                <TextInput style={styles.input} value={marginLeft} onChangeText={setMarginLeft} keyboardType="numeric" placeholder="20" placeholderTextColor={colors.textLight} />
              </View>
              <View style={styles.colorField}>
                <Text style={styles.colorLabel}>Right</Text>
                <TextInput style={styles.input} value={marginRight} onChangeText={setMarginRight} keyboardType="numeric" placeholder="20" placeholderTextColor={colors.textLight} />
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Set as Default</Text>
              <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ false: colors.border, true: colors.primary }} />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={handleCreatePreset} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveModalBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={applyModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.simpleModal}>
            <Text style={styles.modalTitle}>Apply Branding</Text>
            <Text style={styles.fieldLabel}>Template ID</Text>
            <TextInput style={styles.input} value={applyTemplateId} onChangeText={setApplyTemplateId} placeholder="Enter template ID" placeholderTextColor={colors.textLight} autoCapitalize="none" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setApplyModalVisible(false)}>
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveModalBtn} onPress={confirmApplyPreset} disabled={applying}>
                {applying ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveModalBtnText}>Apply</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.h1 },
  createBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  createBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  emptyText: { ...typography.bodySmall, textAlign: 'center', padding: spacing.xxl },
  presetCard: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  presetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  presetName: { ...typography.h3 },
  defaultBadge: { backgroundColor: colors.success, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm },
  defaultBadgeText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  sectionLabel: { ...typography.bodySmall, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.xs },
  swatchRow: { flexDirection: 'row', gap: spacing.sm },
  swatch: { width: 28, height: 28, borderRadius: borderRadius.full },
  fontInfo: { ...typography.bodySmall, marginBottom: 2 },
  presetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  applyBtn: { flex: 1, backgroundColor: colors.primary, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  applyBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  editBtn: { flex: 1, backgroundColor: colors.info, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  editBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  deleteBtn: { flex: 1, backgroundColor: colors.error, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  deleteBtnText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.md },
  modalContent: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, maxHeight: '90%' },
  simpleModal: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg },
  modalTitle: { ...typography.h2, marginBottom: spacing.md },
  fieldLabel: { ...typography.bodySmall, fontWeight: '600', marginBottom: spacing.xs, marginTop: spacing.sm },
  input: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.sm, fontSize: 15, color: colors.text, marginBottom: spacing.sm },
  colorRow: { flexDirection: 'row', gap: spacing.sm },
  colorField: { flex: 1 },
  colorLabel: { ...typography.caption, marginBottom: 2 },
  colorInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, padding: spacing.sm, fontSize: 14, color: colors.text, marginBottom: spacing.sm, fontFamily: 'monospace' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelModalBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', backgroundColor: colors.background },
  cancelModalBtnText: { ...typography.body, fontWeight: '600', color: colors.text },
  saveModalBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center', backgroundColor: colors.primary },
  saveModalBtnText: { ...typography.body, fontWeight: '600', color: colors.white },
});
