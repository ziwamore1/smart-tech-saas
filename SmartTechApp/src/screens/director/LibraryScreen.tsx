import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiService } from '../../services/api';

interface Document {
  id: string;
  title: string;
  description: string | null;
  category: string;
  fileType: string | null;
  fileSize: number | null;
  fileUrl: string | null;
  createdAt: string;
}

interface DirectorLibraryProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
  stackNavigation?: NativeStackNavigationProp<any>;
}

const CATEGORY_ICONS: Record<string, string> = {
  textbook: '📚',
  reference: '📖',
  worksheet: '📝',
  exam: '📋',
  guide: '📘',
  other: '📄',
};

export const DirectorLibraryScreen: React.FC<DirectorLibraryProps> = ({ onToggleDrawer, onNavigate }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getLibraryDocuments();
      setDocuments(data || []);
    } catch (err) {
      console.log('Failed to fetch library documents', err);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Library"
        subtitle={`${documents.length} Documents`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔄', onPress: fetchDocuments }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.infoLight }]}>
            <Text style={[styles.statValue, { color: colors.primaryLight }]}>{documents.length}</Text>
            <Text style={styles.statLabel}>Total Docs</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>
              {documents.filter((d) => d.fileUrl).length}
            </Text>
            <Text style={styles.statLabel}>With Files</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.warningLight }]}>
            <Text style={[styles.statValue, { color: colors.warning }]}>
              {documents.filter((d) => !d.fileUrl).length}
            </Text>
            <Text style={styles.statLabel}>No File</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <WidgetCard title="Document Catalog">
            {documents.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📂</Text>
                <Text style={styles.emptyText}>No documents found</Text>
              </View>
            ) : (
              documents.map((doc) => (
                <TouchableOpacity key={doc.id} style={styles.docCard}>
                  <View style={styles.docIcon}>
                    <Text style={styles.docIconText}>
                      {CATEGORY_ICONS[doc.category?.toLowerCase()] || '📄'}
                    </Text>
                  </View>
                  <View style={styles.docInfo}>
                    <Text style={styles.docTitle}>{doc.title}</Text>
                    <Text style={styles.docMeta}>
                      {doc.category}{doc.fileType ? ` · ${doc.fileType.toUpperCase()}` : ''}{doc.fileSize ? ` · ${formatFileSize(doc.fileSize)}` : ''}
                    </Text>
                    {doc.description && (
                      <Text style={styles.docDesc} numberOfLines={1}>{doc.description}</Text>
                    )}
                  </View>
                  <View style={styles.docStatus}>
                    <View style={[styles.statusBadge, doc.fileUrl ? styles.statusAvailable : styles.statusOut]}>
                      <Text style={styles.statusText}>{doc.fileUrl ? 'Ready' : 'No file'}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </WidgetCard>
        )}

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
  docCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  docIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.warningLight, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  docIconText: { fontSize: 20 },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  docMeta: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  docDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  docStatus: { alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.sm },
  statusAvailable: { backgroundColor: colors.successLight },
  statusOut: { backgroundColor: colors.errorLight },
  statusText: { fontSize: 10, fontWeight: '600', color: colors.text },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textLight },
});
