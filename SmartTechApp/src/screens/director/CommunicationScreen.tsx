import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface DirectorCommunicationProps {
  onToggleDrawer?: () => void;
  onNavigate?: (screen: string) => void;
}

const mockMessages = [
  { id: '1', from: 'John Smith', subject: 'Mathematics Department Update', preview: 'The new curriculum guidelines have been...', time: '10:30 AM', read: false },
  { id: '2', from: 'Sarah Johnson', subject: 'Science Lab Equipment', preview: 'We need to order new lab equipment for...', time: '9:15 AM', read: false },
  { id: '3', from: 'Parent Committee', subject: 'Annual Day Planning', preview: 'The committee has finalized the schedule...', time: 'Yesterday', read: true },
  { id: '4', from: 'Michael Brown', subject: 'English Exam Results', preview: 'The Form 2 English exam results are ready...', time: 'Yesterday', read: true },
  { id: '5', from: 'Emily Davis', subject: 'History Field Trip', preview: 'I would like to propose a field trip to...', time: '2 days ago', read: true },
];

export const DirectorCommunicationScreen: React.FC<DirectorCommunicationProps> = ({ onToggleDrawer, onNavigate }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState(mockMessages);

  const filtered = messages.filter(
    (m) => m.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
           m.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const unreadCount = messages.filter(m => !m.read).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <HeaderBar
        title="Communication"
        subtitle={`${unreadCount} unread messages`}
        leftIcon={{ name: '☰', onPress: onToggleDrawer || (() => {}) }}
        rightIcon={{ name: '🔔', onPress: () => navigation.navigate('Notifications') }}
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

        <WidgetCard title={`Messages (${filtered.length})`}>
          {filtered.map((msg) => (
            <TouchableOpacity key={msg.id} style={[styles.messageCard, !msg.read && styles.messageUnread]}>
              <View style={styles.messageAvatar}>
                <Text style={styles.messageAvatarText}>{msg.from.charAt(0)}</Text>
              </View>
              <View style={styles.messageInfo}>
                <View style={styles.messageHeader}>
                  <Text style={[styles.messageFrom, !msg.read && styles.messageFromUnread]}>{msg.from}</Text>
                  <Text style={styles.messageTime}>{msg.time}</Text>
                </View>
                <Text style={[styles.messageSubject, !msg.read && styles.messageSubjectUnread]}>{msg.subject}</Text>
                <Text style={styles.messagePreview} numberOfLines={1}>{msg.preview}</Text>
              </View>
              {!msg.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))}
          {filtered.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No messages found</Text>
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
  quickActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  quickAction: { flex: 1, backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'center', ...shadows.sm },
  quickActionIcon: { fontSize: 24, marginBottom: spacing.xs },
  quickActionText: { fontSize: 12, fontWeight: '600', color: colors.text },
  messageCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  messageUnread: { backgroundColor: colors.infoLight + '30' },
  messageAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.purple, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  messageAvatarText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  messageInfo: { flex: 1 },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  messageFrom: { fontSize: 14, fontWeight: '600', color: colors.text },
  messageFromUnread: { color: colors.primary },
  messageTime: { fontSize: 11, color: colors.textLight },
  messageSubject: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  messageSubjectUnread: { fontWeight: '600', color: colors.text },
  messagePreview: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginLeft: spacing.sm },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textLight },
});
