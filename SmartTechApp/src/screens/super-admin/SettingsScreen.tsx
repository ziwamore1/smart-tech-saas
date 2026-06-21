import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';

interface Props {
  onToggleDrawer?: () => void;
}

export const SuperAdminSettingsScreen: React.FC<Props> = ({ onToggleDrawer }) => {
  const [settings, setSettings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await apiService.getSuperAdminSettings();
      const list = Array.isArray(res) ? res : res?.settings || res?.data || [];
      setSettings(list);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleSave = async () => {
    if (!editKey.trim()) return;
    setSaving(true);
    try {
      await apiService.updateSuperAdminSetting(editKey, editValue);
      Alert.alert('Saved', `Setting "${editKey}" updated`);
      setEditKey('');
      setEditValue('');
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Settings"
        subtitle="System configuration"
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔄', onPress: onRefresh }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <WidgetCard title="Update Setting">
          <View style={styles.editForm}>
            <TextInput
              style={styles.input}
              placeholder="Setting key (e.g. MAINTENANCE_MODE)"
              placeholderTextColor={colors.textLight}
              value={editKey}
              onChangeText={setEditKey}
              autoCapitalize="characters"
            />
            <TextInput
              style={[styles.input, styles.valueInput]}
              placeholder="Value"
              placeholderTextColor={colors.textLight}
              value={editValue}
              onChangeText={setEditValue}
              multiline
            />
            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving || !editKey.trim()}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save Setting</Text>
              )}
            </TouchableOpacity>
          </View>
        </WidgetCard>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
        ) : settings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⚙️</Text>
            <Text style={styles.emptyTitle}>No settings found</Text>
          </View>
        ) : (
          settings.map((s) => (
            <View key={s.id || s.key} style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingKey}>{s.key}</Text>
                <Text style={styles.settingValue} numberOfLines={2}>{typeof s.value === 'object' ? JSON.stringify(s.value, null, 1) : String(s.value)}</Text>
              </View>
              {s.isPublic && <View style={styles.publicBadge}><Text style={styles.publicText}>Public</Text></View>}
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => { setEditKey(s.key); setEditValue(String(s.value)); }}
              >
                <Text style={styles.editBtnText}>✏️</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.textLight },
  editForm: { gap: spacing.sm },
  input: { backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.md, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },
  valueInput: { minHeight: 60, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center', ...shadows.sm },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  settingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, ...shadows.sm },
  settingInfo: { flex: 1 },
  settingKey: { fontSize: 13, fontWeight: '600', color: colors.text, fontFamily: 'monospace' },
  settingValue: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  publicBadge: { backgroundColor: colors.successLight, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.sm, marginLeft: spacing.sm },
  publicText: { fontSize: 10, fontWeight: '700', color: colors.success },
  editBtn: { marginLeft: spacing.sm, padding: spacing.xs },
  editBtnText: { fontSize: 18 },
});
