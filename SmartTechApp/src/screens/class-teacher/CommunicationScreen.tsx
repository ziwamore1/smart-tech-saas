import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard, GradientCard } from '../../components';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiService } from '../../services/api';

interface Communication {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  message: string;
  recipientType: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<string, { color: string }> = {
  PENDING: { color: colors.warning },
  SENT: { color: colors.info },
  DELIVERED: { color: colors.success },
  FAILED: { color: colors.error },
  CANCELLED: { color: colors.textLight },
};

export const ClassTeacherCommunicationScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [activeTab, setActiveTab] = useState<'messages' | 'notices'>('messages');
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getCommunications({ limit: 50 });
      setCommunications(data || []);
    } catch (err) {
      console.log('Failed to fetch communications', err);
      setCommunications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const conversations = communications.filter((c) => c.type === 'EMAIL' || c.type === 'SMS' || c.type === 'WHATSAPP');
  const notices = communications.filter((c) => c.type === 'PUSH_NOTIFICATION');

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const getInitials = (name: string) => name.charAt(0).toUpperCase();
  const getNameFromSubject = (subject: string | null) => subject || 'Message';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar
        title="Communication"
        subtitle="Parent Messages & Notices"
        rightIcon={{ name: '🔄', onPress: fetchData }}
      />

      <View style={styles.tabRow}>
        {['messages', 'notices'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'messages' ? '💬 Messages' : '📢 Notices'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : activeTab === 'messages' ? (
          <>
            <GradientCard
              icon="💬"
              title="New Message to Parent"
              subtitle="Send a quick message to any parent"
              gradient={['#EFF6FF', '#DBEAFE']}
              onPress={() => navigation.navigate('ParentMessages')}
              style={styles.quickCompose}
            />
            <WidgetCard title="Recent Conversations">
              {conversations.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>💬</Text>
                  <Text style={styles.emptyText}>No messages yet</Text>
                </View>
              ) : (
                conversations.map((conv) => {
                  const statusStyle = STATUS_STYLES[conv.status] || { color: colors.textLight };
                  return (
                    <TouchableOpacity key={conv.id} style={styles.conversationRow}>
                      <View style={styles.convAvatar}>
                        <Text style={styles.convAvatarText}>{getNameFromSubject(conv.subject)[0]}</Text>
                      </View>
                      <View style={styles.convContent}>
                        <View style={styles.convHeader}>
                          <Text style={styles.convName}>{getNameFromSubject(conv.subject)}</Text>
                          <Text style={styles.convTime}>{formatTime(conv.createdAt)}</Text>
                        </View>
                        <View style={styles.convTypeRow}>
                          <Text style={styles.convType}>{conv.type}</Text>
                          <View style={[styles.statusDot, { backgroundColor: statusStyle.color }]} />
                          <Text style={styles.statusLabel}>{conv.status}</Text>
                        </View>
                        <Text style={styles.convPreview} numberOfLines={1}>{conv.message}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </WidgetCard>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.createNoticeBtn}>
              <Text style={styles.createNoticeIcon}>+</Text>
              <Text style={styles.createNoticeText}>Create New Notice</Text>
            </TouchableOpacity>
            <WidgetCard title="Class Notices">
              {notices.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📢</Text>
                  <Text style={styles.emptyText}>No notices yet</Text>
                </View>
              ) : (
                notices.map((notice) => {
                  const statusStyle = STATUS_STYLES[notice.status] || { color: colors.textLight };
                  return (
                    <View key={notice.id} style={styles.noticeRow}>
                      <View style={styles.noticeInfo}>
                        <Text style={styles.noticeTitle}>{notice.subject || notice.message}</Text>
                        <Text style={styles.noticeDate}>{new Date(notice.createdAt).toLocaleDateString()}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusStyle.color + '20' }]}>
                        <Text style={[styles.statusText, { color: statusStyle.color }]}>{notice.status}</Text>
                      </View>
                    </View>
                  );
                })
              )}
            </WidgetCard>
          </>
        )}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.white, alignItems: 'center', ...shadows.sm },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textLight },
  tabTextActive: { color: colors.white },
  scroll: { padding: spacing.md, paddingTop: 0 },
  quickCompose: { marginBottom: spacing.md },
  conversationRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  convAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  convAvatarText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  convContent: { flex: 1 },
  convHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convName: { fontSize: 15, fontWeight: '600', color: colors.text },
  convTime: { fontSize: 11, color: colors.textLight },
  convTypeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1, gap: 4 },
  convType: { fontSize: 11, color: colors.textLight, fontWeight: '500' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 10, color: colors.textLight },
  convPreview: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  createNoticeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.white, borderRadius: borderRadius.xl, marginBottom: spacing.md, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' as any },
  createNoticeIcon: { fontSize: 24, fontWeight: '300', color: colors.textLight, marginRight: spacing.sm },
  createNoticeText: { fontSize: 15, fontWeight: '600', color: colors.textLight },
  noticeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  noticeInfo: { flex: 1 },
  noticeTitle: { fontSize: 15, fontWeight: '500', color: colors.text },
  noticeDate: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
  statusText: { fontSize: 12, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textLight },
});
