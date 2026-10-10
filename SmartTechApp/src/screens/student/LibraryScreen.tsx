import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiService } from '../../services/api';
import { colors, spacing, borderRadius } from '../../theme';
import { Loading } from '../../components';

type LibraryDocument = {
  id: string;
  title?: string;
  description?: string;
  category?: string;
  fileType?: string;
  createdAt?: string;
  fileUrl?: string;
  url?: string;
  downloadUrl?: string;
};

export const StudentLibraryScreen: React.FC<any> = ({ navigation }) => {
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDocuments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const response = await apiService.getLibraryDocuments();
      const data = response?.data ?? response;
      setDocuments(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);

  const openDocument = async (document: LibraryDocument) => {
    const url = document.fileUrl || document.downloadUrl || document.url;
    if (url) await Linking.openURL(url);
    else Alert.alert('Resource unavailable', 'This resource does not have a downloadable file yet.');
  };

  if (loading) return <Loading fullScreen message="Loading library..." />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Go back">
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View><Text style={styles.title}>Library</Text><Text style={styles.subtitle}>Learning resources from your school</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDocuments(true)} />}>
        {documents.length === 0 ? <Text style={styles.empty}>No library resources are available yet.</Text> : documents.map((document) => (
          <TouchableOpacity key={document.id} style={styles.card} onPress={() => openDocument(document)} activeOpacity={0.8}>
            <View style={styles.icon}><Text style={styles.iconText}>📚</Text></View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{document.title || 'Learning resource'}</Text>
              {!!document.description && <Text style={styles.description} numberOfLines={2}>{document.description}</Text>}
              <Text style={styles.meta}>{document.category || 'General'}{document.fileType ? ` · ${document.fileType}` : ''}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  backButton: { marginRight: spacing.md, padding: spacing.xs },
  backText: { color: colors.primary, fontSize: 34, lineHeight: 30 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.textLight, fontSize: 12, marginTop: 2 },
  content: { padding: spacing.lg, gap: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, backgroundColor: colors.white, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.infoLight, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  iconText: { fontSize: 22 },
  cardBody: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  description: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  meta: { color: colors.textLight, fontSize: 11, marginTop: 6 },
  chevron: { color: colors.primary, fontSize: 28, marginLeft: spacing.sm },
  empty: { color: colors.textLight, textAlign: 'center', marginTop: spacing.xl, fontSize: 14 },
});
