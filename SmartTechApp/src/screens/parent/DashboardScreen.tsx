import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard, GradientCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useAuthStore, useAppStore } from '../../store';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: any;
}

export const ParentDashboardScreen: React.FC<Props> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const { user } = useAuthStore();
  const { dashboard, isLoadingDashboard, fetchDashboard } = useAppStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  useEffect(() => { fetchDashboard(); }, []);

  const children = dashboard?.children || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar
        title={user?.firstName ? `Hello, ${user.firstName}` : 'Dashboard'}
        subtitle="Parent Dashboard"
        leftIcon={{ name: '☰', onPress: onToggleDrawer }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        <WidgetCard title="My Children">
          {children.length === 0 ? (
            <GradientCard
              icon="👶"
              title="No children linked"
              subtitle="Contact your school to link children to your account"
              gradient={['#EFF6FF', '#DBEAFE']}
            />
          ) : (
            children.map((child: any) => (
              <TouchableOpacity key={child.id} style={styles.childCard} onPress={() => navigation.navigate('ParentChildResults', { childId: child.id, childName: child.name })}>
                <View style={styles.childAvatar}>
                  <Text style={styles.childAvatarText}>{child.name?.[0]}</Text>
                </View>
                <View style={styles.childInfo}>
                  <Text style={styles.childName}>{child.name}</Text>
                  <Text style={styles.childClass}>{child.class} • {child.admissionNumber}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </WidgetCard>

        <View style={styles.resourcesRow}>
          <TouchableOpacity style={styles.resourceCard} onPress={() => navigation.navigate('ParentChildResults')}>
            <Text style={{ fontSize: 28 }}>📝</Text>
            <Text style={styles.resourceName}>Results</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resourceCard} onPress={() => navigation.navigate('ParentReportCards')}>
            <Text style={{ fontSize: 28 }}>📄</Text>
            <Text style={styles.resourceName}>Report Cards</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resourceCard} onPress={() => navigation.navigate('ParentHomework')}>
            <Text style={{ fontSize: 28 }}>📚</Text>
            <Text style={styles.resourceName}>Homework</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resourceCard} onPress={() => navigation.navigate('ParentAttendance')}>
            <Text style={{ fontSize: 28 }}>✅</Text>
            <Text style={styles.resourceName}>Attendance</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.resourcesRow}>
          <TouchableOpacity style={styles.resourceCard} onPress={() => navigation.navigate('ParentAssessments')}>
            <Text style={{ fontSize: 28 }}>📋</Text>
            <Text style={styles.resourceName}>Assessments</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resourceCard} onPress={() => navigation.navigate('ParentAnalytics')}>
            <Text style={{ fontSize: 28 }}>📊</Text>
            <Text style={styles.resourceName}>Analytics</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resourceCard} onPress={() => navigation.navigate('AiTutor', { sourceScreen: 'parent_dashboard' })}>
            <Text style={{ fontSize: 28 }}>🤖</Text>
            <Text style={styles.resourceName}>AI Tutor</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resourceCard} onPress={() => navigation.navigate('Profile')}>
            <Text style={{ fontSize: 28 }}>👤</Text>
            <Text style={styles.resourceName}>Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  childCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  childAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.secondary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  childAvatarText: { color: colors.white, fontWeight: '700', fontSize: 18 },
  childInfo: { flex: 1 },
  childName: { fontSize: 16, fontWeight: '600', color: colors.text },
  childClass: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.textLight, marginLeft: spacing.sm },
  resourcesRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  resourceCard: { flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', ...shadows.card },
  resourceName: { fontSize: 12, fontWeight: '500', color: colors.text, marginTop: spacing.sm },
});
