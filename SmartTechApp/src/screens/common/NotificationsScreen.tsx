import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SwipeListView } from 'react-native-swipe-list-view';
import * as Notifications from 'expo-notifications';
import { HeaderBar, WidgetCard } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';
import { useAppStore } from '../../store';

export const NotificationsScreen: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [localNotifs, setLocalNotifs] = useState<Notifications.NotificationRequest[]>([]);
  const setUnreadCount = useAppStore((s) => s.setUnreadCount);

  useEffect(() => {
    apiService.getNotifications().then(r => {
      const data = r?.data || r;
      setNotifications(Array.isArray(data) ? data : data?.notifications || []);
    }).catch(() => setNotifications([]));
    apiService.getUnreadNotificationCount()
      .then(r => setUnreadCount(Number(r?.count ?? r ?? 0) || 0))
      .catch(() => {});
    loadLocalNotifications();
  }, []);

  const loadLocalNotifications = async () => {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      setLocalNotifs(scheduled);
    } catch (e) {
      console.warn('Failed to load local notifications:', e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiService.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      Alert.alert('Error', 'Failed to mark all as read');
    }
  };

  const handleClearLocalNotification = async (id: string) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
      setLocalNotifs(prev => prev.filter(n => n.identifier !== id));
    } catch (e) {
      console.warn('Failed to clear notification:', e);
    }
  };

  const handleDismissNotification = async (notif: any) => {
    try {
      if (notif.id) {
        await apiService.markNotificationAsRead(notif.id);
        setUnreadCount((useAppStore.getState().unreadCount || 1) - 1);
      }
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
    } catch (e) {
      console.warn('Failed to dismiss notification:', e);
    }
  };

  const renderNotification = ({ item }: { item: any }) => (
    <View style={[styles.notifRow, item.read && styles.notifRead]}>
      <View style={[styles.notifDot, item.read && styles.notifDotRead]} />
      <View style={styles.notifContent}>
        <Text style={[styles.notifTitle, item.read && styles.notifTitleRead]}>{item.title || item.message}</Text>
        <Text style={styles.notifTime}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</Text>
      </View>
    </View>
  );

  const renderHiddenNotification = ({ item }: { item: any }) => (
    <View style={styles.rowBack}>
      <TouchableOpacity style={[styles.backRightBtn, styles.backRightBtnLeft]} onPress={() => handleDismissNotification(item)}>
        <Text style={styles.backBtnText}>Dismiss</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <HeaderBar
        title="Notifications"
        subtitle="Stay updated"
        rightIcon={{ name: '✓✓', onPress: handleMarkAllRead }}
      />
      {localNotifs.length > 0 && (
        <WidgetCard title="Scheduled">
          {localNotifs.map(n => (
            <View key={n.identifier} style={styles.localNotifRow}>
              <View style={styles.localNotifContent}>
                <Text style={styles.localNotifTitle}>{n.content?.title || 'Reminder'}</Text>
                <Text style={styles.localNotifBody}>{n.content?.body || ''}</Text>
              </View>
              <TouchableOpacity style={styles.clearBtn} onPress={() => handleClearLocalNotification(n.identifier)}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </WidgetCard>
      )}

      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <SwipeListView
          data={notifications}
          renderItem={renderNotification}
          renderHiddenItem={renderHiddenNotification}
          leftOpenValue={0}
          rightOpenValue={-75}
          previewRowKey={'0'}
          keyExtractor={(item: any) => item.id || Math.random().toString()}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={<Text style={styles.listHeader}>Recent</Text>}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 16, color: colors.textLight },
  localNotifRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  localNotifContent: { flex: 1 },
  localNotifTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  localNotifBody: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  clearBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  clearBtnText: { fontSize: 16, color: colors.textLight },
  listContent: { padding: spacing.md },
  listHeader: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  notifRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderLight, backgroundColor: colors.white },
  notifRead: { opacity: 0.6 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primaryLight, marginTop: 6, marginRight: spacing.md },
  notifDotRead: { backgroundColor: colors.border },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '500', color: colors.text, lineHeight: 20 },
  notifTitleRead: { fontWeight: '400' },
  notifTime: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  rowBack: { flex: 1, backgroundColor: colors.error, justifyContent: 'flex-end', alignItems: 'center', flexDirection: 'row', paddingRight: spacing.md, marginBottom: spacing.xs, borderRadius: borderRadius.lg },
  backRightBtn: { alignItems: 'center', justifyContent: 'center', width: 75 },
  backRightBtnLeft: { backgroundColor: colors.error },
  backBtnText: { color: colors.white, fontWeight: '600', fontSize: 13 },
});
