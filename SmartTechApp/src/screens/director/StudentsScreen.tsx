import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface DirectorStudentsProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

export const DirectorStudentsScreen: React.FC<DirectorStudentsProps> = ({ onToggleDrawer, onNavigate, stackNavigation }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [students, setStudents] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStudents = async () => {
    try {
      const data = await apiService.getStudents();
      setStudents(data || []);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadStudents(); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadStudents();
  };

  const filtered = students.filter(
    (s) => s.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           s.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           s.class.toLowerCase().includes(searchQuery.toLowerCase()) ||
           s.admissionNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Students"
        subtitle={`${students.length} Total Students`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search students..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <WidgetCard title="All Students">
          {filtered.map((student) => (
            <TouchableOpacity key={student.id} style={styles.studentCard}>
              <View style={styles.studentAvatar}>
                <Text style={styles.studentAvatarText}>{student.firstName.charAt(0)}{student.lastName.charAt(0)}</Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.firstName} {student.lastName}</Text>
                <Text style={styles.studentClass}>{student.class}{student.admissionNumber ? ` • ${student.admissionNumber}` : ''}</Text>
              </View>
              <View style={[styles.statusDot, student.isActive ? styles.statusActive : styles.statusInactive]} />
            </TouchableOpacity>
          ))}
          {filtered.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👨‍🎓</Text>
              <Text style={styles.emptyText}>No students found</Text>
            </View>
          )}
        </WidgetCard>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  searchIcon: { fontSize: 18, marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: spacing.md, fontSize: 15, color: colors.text },
  studentCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  studentAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  studentAvatarText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '600', color: colors.text },
  studentClass: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusActive: { backgroundColor: colors.success },
  statusInactive: { backgroundColor: colors.textMuted },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textLight },
});
