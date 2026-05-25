import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface DirectorLibraryProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

const mockBooks = [
  { id: '1', title: 'Mathematics Form 1', author: 'Ministry of Education', copies: 45, available: 32 },
  { id: '2', title: 'Physics Form 2', author: 'Oxford Press', copies: 30, available: 18 },
  { id: '3', title: 'English Literature', author: 'Cambridge', copies: 50, available: 41 },
  { id: '4', title: 'Biology Form 3', author: 'Pearson', copies: 35, available: 22 },
  { id: '5', title: 'History & Government', author: 'KLB', copies: 40, available: 35 },
];

export const DirectorLibraryScreen: React.FC<DirectorLibraryProps> = ({ onToggleDrawer, onNavigate }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();

  const totalBooks = mockBooks.reduce((s, b) => s + b.copies, 0);
  const availableBooks = mockBooks.reduce((s, b) => s + b.available, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Library"
        subtitle={`${mockBooks.length} Titles`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.infoLight }]}>
            <Text style={[styles.statValue, { color: colors.primaryLight }]}>{totalBooks}</Text>
            <Text style={styles.statLabel}>Total Books</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>{availableBooks}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.warningLight }]}>
            <Text style={[styles.statValue, { color: colors.warning }]}>{totalBooks - availableBooks}</Text>
            <Text style={styles.statLabel}>Borrowed</Text>
          </View>
        </View>

        <WidgetCard title="Book Catalog">
          {mockBooks.map((book) => (
            <TouchableOpacity key={book.id} style={styles.bookCard}>
              <View style={styles.bookIcon}>
                <Text style={styles.bookIconText}>📖</Text>
              </View>
              <View style={styles.bookInfo}>
                <Text style={styles.bookTitle}>{book.title}</Text>
                <Text style={styles.bookAuthor}>{book.author}</Text>
              </View>
              <View style={styles.bookMeta}>
                <Text style={styles.bookCopies}>{book.available}/{book.copies}</Text>
                <View style={[styles.statusBadge, book.available > 0 ? styles.statusAvailable : styles.statusOut]}>
                  <Text style={styles.statusText}>{book.available > 0 ? 'Available' : 'Out'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </WidgetCard>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, padding: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, color: colors.textLight, marginTop: 4 },
  bookCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  bookIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.warningLight, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  bookIconText: { fontSize: 20 },
  bookInfo: { flex: 1 },
  bookTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  bookAuthor: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  bookMeta: { alignItems: 'flex-end' },
  bookCopies: { fontSize: 12, color: colors.textLight, marginBottom: 4 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.sm },
  statusAvailable: { backgroundColor: colors.successLight },
  statusOut: { backgroundColor: colors.errorLight },
  statusText: { fontSize: 10, fontWeight: '600', color: colors.text },
});
