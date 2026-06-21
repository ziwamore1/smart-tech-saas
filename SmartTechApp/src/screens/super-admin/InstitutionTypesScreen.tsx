import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const SuperAdminInstitutionTypesScreen: React.FC<Props> = ({ onToggleDrawer }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await apiService.getSuperAdminInstitutionTypes();
      setTypes(Array.isArray(res) ? res : res?.data && Array.isArray(res.data) ? res.data : res?.types || []);
    } catch (err) {
      console.error('Failed to load institution types:', err);
      try {
        const fallback = await apiService.getInstitutionTypes();
        setTypes(Array.isArray(fallback) ? fallback : fallback?.data && Array.isArray(fallback.data) ? fallback.data : fallback?.types || []);
      } catch (e) {
        console.error('Fallback also failed:', e);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Institution Types"
        subtitle={`${types.length} types`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔄', onPress: onRefresh }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : types.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏛️</Text>
            <Text style={styles.emptyTitle}>No institution types</Text>
            <Text style={styles.emptyDesc}>No institution types are configured yet.</Text>
          </View>
        ) : (
          types.map((type) => (
            <View key={type.id || type.code} style={styles.typeCard}>
              <View style={styles.typeHeader}>
                <View style={styles.typeAvatar}>
                  <Text style={styles.typeAvatarText}>{(type.name || type.code || '?')[0]}</Text>
                </View>
                <View style={styles.typeInfo}>
                  <Text style={styles.typeName}>{type.name}</Text>
                  <Text style={styles.typeCode}>{type.code}</Text>
                </View>
              </View>
              {type.description && <Text style={styles.typeDesc}>{type.description}</Text>}
              {type.educationLevel && (
                <Text style={styles.typeMeta}>📚 {type.educationLevel}</Text>
              )}
              {(type.modulesCount !== undefined || type.featuresCount !== undefined) && (
                <View style={styles.typeStats}>
                  <Text style={styles.typeStat}>📦 {type.modulesCount ?? type.modules?.length ?? 0} modules</Text>
                  <Text style={styles.typeStat}>⭐ {type.featuresCount ?? type.features?.length ?? 0} features</Text>
                </View>
              )}
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
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  emptyDesc: { fontSize: 14, color: colors.textLight, textAlign: 'center' },
  typeCard: { backgroundColor: colors.white, borderRadius: borderRadius.xl, padding: spacing.lg, marginBottom: spacing.md, ...shadows.card },
  typeHeader: { flexDirection: 'row', alignItems: 'center' },
  typeAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.purpleLight, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  typeAvatarText: { fontSize: 18, fontWeight: '700', color: colors.purple },
  typeInfo: { flex: 1 },
  typeName: { fontSize: 16, fontWeight: '600', color: colors.text },
  typeCode: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  typeDesc: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 18 },
  typeMeta: { fontSize: 12, color: colors.textLight, marginTop: spacing.sm },
  typeStats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderLight },
  typeStat: { fontSize: 12, color: colors.textLight },
});
