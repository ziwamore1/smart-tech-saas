import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MarketplaceItem } from '../../types';
import { apiService } from '../../services/api';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';

interface MarketplaceCategory {
  id: string;
  name: string;
  slug?: string;
}

export function TemplateMarketplaceScreen({ navigation }: any) {
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [liking, setLiking] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [itemsData, categoriesData] = await Promise.all([
        apiService.getMarketplaceTemplates(),
        apiService.getMarketplaceCategories(),
      ]);

      setItems(Array.isArray(itemsData) ? itemsData : itemsData?.data ?? []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : categoriesData?.data ?? []);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to load marketplace');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, []);

  const filteredItems = useMemo(() => {
    let result = items;
    if (selectedCategory) {
      result = result.filter((i) => i.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, selectedCategory, search]);

  const handleItemPress = (item: MarketplaceItem) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  const handleLike = async () => {
    if (!selectedItem || liking) return;
    setLiking(true);
    try {
      await apiService.likeMarketplaceItem(selectedItem.id);
      setItems((prev) =>
        prev.map((i) =>
          i.id === selectedItem.id ? { ...i, likes: i.likes + 1 } : i
        )
      );
      setSelectedItem((prev) => prev ? { ...prev, likes: prev.likes + 1 } : null);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to like');
    } finally {
      setLiking(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedItem || downloading) return;
    setDownloading(true);
    try {
      const result = await apiService.downloadFromMarketplace(selectedItem.id);
      Alert.alert('Download Complete', `"${selectedItem.title}" is now available in your templates.`);
      setItems((prev) =>
        prev.map((i) =>
          i.id === selectedItem.id ? { ...i, downloads: i.downloads + 1 } : i
        )
      );
      setSelectedItem((prev) => prev ? { ...prev, downloads: prev.downloads + 1 } : null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to download';
      Alert.alert('Download Failed', msg);
    } finally {
      setDownloading(false);
    }
  };

  const renderItem = ({ item }: { item: MarketplaceItem }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleItemPress(item)} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.previewIcon}>
          {item.previewUrl || '📄'}
        </Text>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          {item.school?.name && (
            <Text style={styles.schoolName}>{item.school.name}</Text>
          )}
        </View>
        {item.featured && (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredText}>Featured</Text>
          </View>
        )}
      </View>
      {item.description && (
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
      )}
      <View style={styles.cardFooter}>
        {item.category && (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        )}
        <View style={styles.stats}>
          <Text style={styles.statText}>⬇ {item.downloads}</Text>
          <Text style={styles.statText}>❤ {item.likes}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading marketplace...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Template Marketplace</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search templates..."
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
      </View>

      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          <TouchableOpacity
            key="all-categories"
            style={[styles.chip, !selectedCategory && styles.chipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map((cat, idx) => (
            <TouchableOpacity
              key={cat.id ?? idx}
              style={[styles.chip, selectedCategory === (cat.slug || cat.name) && styles.chipActive]}
              onPress={() => setSelectedCategory(cat.slug || cat.name)}
            >
              <Text style={[styles.chipText, selectedCategory === (cat.slug || cat.name) && styles.chipTextActive]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No templates found</Text>
            <Text style={styles.emptySubtitle}>Try a different search or category</Text>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedItem && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalPreviewIcon}>
                    {selectedItem.previewUrl || '📄'}
                  </Text>
                  <Text style={styles.modalTitle}>{selectedItem.title}</Text>
                  {selectedItem.featured && (
                    <View style={[styles.featuredBadge, { marginTop: spacing.xs }]}>
                      <Text style={styles.featuredText}>Featured</Text>
                    </View>
                  )}
                </View>

                {selectedItem.school?.name && (
                  <Text style={styles.modalSchool}>{selectedItem.school.name}</Text>
                )}

                {selectedItem.description && (
                  <Text style={styles.modalDescription}>{selectedItem.description}</Text>
                )}

                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>Category:</Text>
                  <Text style={styles.modalValue}>{selectedItem.category || 'N/A'}</Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>Downloads:</Text>
                  <Text style={styles.modalValue}>{selectedItem.downloads}</Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Text style={styles.modalLabel}>Likes:</Text>
                  <Text style={styles.modalValue}>{selectedItem.likes}</Text>
                </View>

                {selectedItem.tags?.length > 0 && (
                  <View style={styles.tagsRow}>
                    {selectedItem.tags.map((tag, idx) => (
                      <View key={idx} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.likeButton]}
                    onPress={handleLike}
                    disabled={liking}
                  >
                    <Text style={styles.likeButtonText}>
                      {liking ? '...' : `❤ ${selectedItem.likes}`}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.downloadButton]}
                    onPress={handleDownload}
                    disabled={downloading}
                  >
                    <Text style={styles.modalButtonText}>
                      {downloading ? 'Downloading...' : 'Download'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: spacing.md, fontSize: 14, color: colors.textLight },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  searchContainer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.white },
  searchInput: { backgroundColor: colors.background, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, height: 40, fontSize: 15, color: colors.text },
  chipsContainer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, backgroundColor: colors.background, marginRight: spacing.sm },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.textLight },
  chipTextActive: { color: colors.white },
  listContent: { padding: spacing.md, paddingBottom: spacing.xxl },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  previewIcon: { fontSize: 36, marginRight: spacing.md },
  cardHeaderText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  schoolName: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  featuredBadge: { backgroundColor: colors.accent, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2, alignSelf: 'flex-start' },
  featuredText: { fontSize: 10, fontWeight: '700', color: colors.white },
  description: { fontSize: 14, color: colors.textLight, marginBottom: spacing.sm, lineHeight: 20 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryBadge: { backgroundColor: '#EFF6FF', borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  categoryText: { fontSize: 11, color: colors.info, fontWeight: '500' },
  stats: { flexDirection: 'row', gap: spacing.md },
  statText: { fontSize: 12, color: colors.textLight },
  emptyContainer: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  emptySubtitle: { fontSize: 14, color: colors.textLight, marginTop: spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.white, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg, maxHeight: '85%' },
  modalHeader: { alignItems: 'center', marginBottom: spacing.md },
  modalPreviewIcon: { fontSize: 64, marginBottom: spacing.sm },
  modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  modalSchool: { fontSize: 14, color: colors.textLight, textAlign: 'center', marginBottom: spacing.md },
  modalDescription: { fontSize: 15, color: colors.text, lineHeight: 22, marginBottom: spacing.md },
  modalDetailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  modalLabel: { fontSize: 14, color: colors.textLight },
  modalValue: { fontSize: 14, fontWeight: '500', color: colors.text },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  tag: { backgroundColor: colors.background, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  tagText: { fontSize: 11, color: colors.textLight },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  modalButton: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, alignItems: 'center' },
  likeButton: { backgroundColor: '#FEE2E2' },
  likeButtonText: { fontSize: 16, fontWeight: '600', color: colors.error },
  downloadButton: { backgroundColor: colors.primary },
  modalButtonText: { fontSize: 16, fontWeight: '600', color: colors.white },
  closeButton: { alignItems: 'center', marginTop: spacing.md },
  closeButtonText: { fontSize: 15, color: colors.textLight },
});
