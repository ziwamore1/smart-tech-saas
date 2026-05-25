import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderBar, WidgetCard, GradientCard } from '../../components';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export const ClassTeacherCommunicationScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [activeTab, setActiveTab] = useState<'messages' | 'notices'>('messages');

  const conversations = [
    { name: 'Mary Wanjiku', parent: 'Parent of John', preview: 'Thank you for the update...', time: '10m ago', unread: true },
    { name: 'Peter Kamau', parent: 'Parent of Alice', preview: 'Is there a meeting tomorrow?', time: '1h ago', unread: false },
    { name: 'Jane Mwangi', parent: 'Parent of David', preview: 'Noted, will work on it.', time: '3h ago', unread: true },
    { name: 'Sarah Otieno', parent: 'Parent of Grace', preview: 'Could you send the schedule?', time: '1d ago', unread: false },
  ];

  const notices = [
    { title: 'End of Term Exams', date: 'Jun 15, 2026', status: 'Scheduled', statusColor: colors.success },
    { title: 'Parent-Teacher Meeting', date: 'Jun 20, 2026', status: 'Pending', statusColor: colors.warning },
    { title: 'Science Fair', date: 'Jul 5, 2026', status: 'Draft', statusColor: colors.textLight },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar
        title="Communication"
        subtitle="Parent Messages & Notices"
        rightIcon={{ name: '✉️', onPress: () => {} }}
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
        {activeTab === 'messages' ? (
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
              {conversations.map((conv, i) => (
                <TouchableOpacity key={i} style={styles.conversationRow}>
                  <View style={styles.convAvatar}>
                    <Text style={styles.convAvatarText}>{conv.name[0]}</Text>
                  </View>
                  <View style={styles.convContent}>
                    <View style={styles.convHeader}>
                      <Text style={styles.convName}>{conv.name}</Text>
                      <Text style={styles.convTime}>{conv.time}</Text>
                    </View>
                    <Text style={styles.convParent}>{conv.parent}</Text>
                    <Text style={styles.convPreview}>{conv.preview}</Text>
                  </View>
                  {conv.unread && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              ))}
            </WidgetCard>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.createNoticeBtn}>
              <Text style={styles.createNoticeIcon}>+</Text>
              <Text style={styles.createNoticeText}>Create New Notice</Text>
            </TouchableOpacity>
            <WidgetCard title="Class Notices">
              {notices.map((notice, i) => (
                <View key={i} style={styles.noticeRow}>
                  <View style={styles.noticeInfo}>
                    <Text style={styles.noticeTitle}>{notice.title}</Text>
                    <Text style={styles.noticeDate}>{notice.date}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: notice.statusColor + '20' }]}>
                    <Text style={[styles.statusText, { color: notice.statusColor }]}>{notice.status}</Text>
                  </View>
                </View>
              ))}
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
  convParent: { fontSize: 12, color: colors.textLight, marginTop: 1 },
  convPreview: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryLight, marginLeft: spacing.sm },
  createNoticeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.white, borderRadius: borderRadius.xl, marginBottom: spacing.md, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed' as any },
  createNoticeIcon: { fontSize: 24, fontWeight: '300', color: colors.textLight, marginRight: spacing.sm },
  createNoticeText: { fontSize: 15, fontWeight: '600', color: colors.textLight },
  noticeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  noticeInfo: { flex: 1 },
  noticeTitle: { fontSize: 15, fontWeight: '500', color: colors.text },
  noticeDate: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
  statusText: { fontSize: 12, fontWeight: '600' },
});
