import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Loading } from '../../components';
import { colors, spacing, shadows } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export const ParentDashboardScreen: React.FC = () => {
  const { user } = useAuthStore();
  const { dashboard, isLoadingDashboard, fetchDashboard } = useAppStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  useEffect(() => { fetchDashboard(); }, []);

  if (isLoadingDashboard && !dashboard) return <Loading fullScreen message="Loading..." />;

  const children = dashboard?.children || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.firstName}</Text>
          <Text style={styles.subtitle}>Parent Dashboard</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>My Children</Text>
        {children.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={{ textAlign: 'center', color: colors.textLight }}>No children linked to your account</Text>
          </Card>
        ) : (
          children.map((child: any) => (
            <TouchableOpacity key={child.id} onPress={() => navigation.navigate('PResults', { childId: child.id, childName: child.name })}>
              <Card variant="outlined" style={styles.childCard}>
                <View style={styles.childRow}>
                  <View style={styles.childAvatar}><Text style={styles.childAvatarText}>{child.name?.[0]}</Text></View>
                  <View style={styles.childInfo}>
                    <Text style={styles.childName}>{child.name}</Text>
                    <Text style={styles.childClass}>{child.class} • {child.admissionNumber}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
        <Text style={styles.sectionTitle}>Resources</Text>
        <View style={styles.resourcesRow}>
          {[
            { name: 'Results', icon: '📝', screen: 'PResults' },
            { name: 'Profile', icon: '👤', screen: 'PProfile' },
          ].map((r) => (
            <TouchableOpacity key={r.name} style={styles.resourceCard} onPress={() => navigation.navigate(r.screen)}>
              <Text style={{ fontSize: 28 }}>{r.icon}</Text>
              <Text style={styles.resourceName}>{r.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textLight, marginTop: 2 },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.md, marginTop: spacing.md },
  emptyCard: { padding: spacing.xl },
  childCard: { padding: spacing.md, marginBottom: spacing.sm },
  childRow: { flexDirection: 'row', alignItems: 'center' },
  childAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center' },
  childAvatarText: { color: colors.white, fontWeight: '700', fontSize: 18 },
  childInfo: { flex: 1, marginLeft: spacing.md },
  childName: { fontSize: 16, fontWeight: '600', color: colors.text },
  childClass: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.textLight },
  resourcesRow: { flexDirection: 'row', gap: spacing.sm },
  resourceCard: { flex: 1, backgroundColor: colors.white, borderRadius: 12, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  resourceName: { fontSize: 12, fontWeight: '500', color: colors.text, marginTop: spacing.sm },
});
