import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
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
  scheduledAt: string | null;
}

interface DirectorCommunicationProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
}

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  PENDING: { color: colors.warning, bg: colors.warningLight },
  SENT: { color: colors.info, bg: colors.infoLight },
  DELIVERED: { color: colors.success, bg: colors.successLight },
  FAILED: { color: colors.error, bg: colors.errorLight },
  CANCELLED: { color: colors.textLight, bg: colors.borderLight },
};

const TYPE_ICONS: Record<string, string> = {
  EMAIL: '📧',
  SMS: '💬',
  WHATSAPP: '📱',
  PUSH_NOTIFICATION: '🔔',
  FACEBOOK: '👍',
  YOUTUBE: '▶️',
  LINKEDIN: '💼',
};

export const DirectorCommunicationScreen: React.FC<DirectorCommunicationProps> = ({ onToggleDrawer, onNavigate }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCommunications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getCommunications();
      setMessages(data?.communications || data || []);
    } catch (err) {
      console.log('Failed to fetch communications', err);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommunications();
  }, [fetchCommunications]);

  const filtered = messages.filter(
    (m) =>
      (m.subject || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.type.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const unreadCount = messages.filter((m) => m.status === 'PENDING').length;

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Communication"
        subtitle={`${unreadCount} pending messages`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔄', onPress: fetchCommunications }}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <Text style={styles.quickActionIcon}>📢</Text>
            <Text style={styles.quickActionText}>Announcement</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Text style={styles.quickActionIcon}>👥</Text>
            <Text style={styles.quickActionText}>Staff Mail</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <Text style={styles.quickActionIcon}>👨‍👩‍👧</Text>
            <Text style={styles.quickActionText}>Parents</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <WidgetCard title={`Messages (${filtered.length})`}>
            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyText}>No messages found</Text>
              </View>
            ) : (
              filtered.map((msg) => {
                const statusStyle = STATUS_STYLES[msg.status] || { color: colors.textLight, bg: colors.borderLight };
                return (
                  <TouchableOpacity key={msg.id} style={[styles.messageCard, msg.status === 'PENDING' && styles.messageUnread]}>
                    <View style={styles.messageAvatar}>
                      <Text style={styles.messageAvatarText}>
                        {TYPE_ICONS[msg.type] || '✉️'}
                      </Text>
                    </View>
                    <View style={styles.messageInfo}>
                      <View style={styles.messageHeader}>
                        <Text style={[styles.messageFrom, msg.status === 'PENDING' && styles.messageFromUnread]}>
                          {msg.subject || msg.type}
                        </Text>
                        <Text style={styles.messageTime}>{formatTime(msg.createdAt)}</Text>
                      </View>
                      <View style={styles.messageSubjectRow}>
                        <Text style={[styles.messageSubject, msg.status === 'PENDING' && styles.messageSubjectUnread]} numberOfLines={1}>
                          {msg.message}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[styles.statusText, { color: statusStyle.color }]}>{msg.status}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
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
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, marginBottom: spacing.md, ...shadows.sm },
  searchIcon: { fontSize: 18, marginRight: spacing.sm },
  searchInput: { flex: 1, paddingVertical: spacing.md, fontSize: 15, color: colors.text },
  quickActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  quickAction: { flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  quickActionIcon: { fontSize: 24, marginBottom: spacing.xs },
  quickActionText: { fontSize: 12, fontWeight: '600', color: colors.text },
  messageCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  messageUnread: { backgroundColor: colors.infoLight + '30' },
  messageAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  messageAvatarText: { fontSize: 18 },
  messageInfo: { flex: 1 },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  messageFrom: { fontSize: 14, fontWeight: '600', color: colors.text },
  messageFromUnread: { color: colors.primary },
  messageTime: { fontSize: 11, color: colors.textLight },
  messageSubjectRow: { marginTop: 2 },
  messageSubject: { fontSize: 13, color: colors.textSecondary },
  messageSubjectUnread: { fontWeight: '600', color: colors.text },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 1, borderRadius: borderRadius.sm, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textLight },
});
