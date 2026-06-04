import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Button } from '../../components';
import { colors, spacing, borderRadius, shadows } from '../../theme';
import { apiService } from '../../services/api';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

interface Session {
  id: string;
  device?: string;
  browser?: string;
  ipAddress?: string;
  location?: string;
  lastActiveAt?: string;
  createdAt: string;
  isCurrent?: boolean;
  deviceType?: string;
}

interface Device {
  id: string;
  deviceName?: string;
  deviceType?: string;
  os?: string;
  browser?: string;
  lastUsedAt?: string;
  trusted: boolean;
  createdAt: string;
}

export const SessionManagementScreen: React.FC<Props> = ({ navigation }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [devicesLoaded, setDevicesLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOutId, setLoggingOutId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (sessionsLoaded && !refreshing) return;
    setIsLoadingSessions(true);
    try {
      const data = await apiService.getActiveSessions();
      setSessions(data.sessions || []);
      setSessionsLoaded(true);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to load sessions');
    } finally {
      setIsLoadingSessions(false);
    }
  }, [sessionsLoaded, refreshing]);

  const loadDevices = useCallback(async () => {
    if (devicesLoaded && !refreshing) return;
    setIsLoadingDevices(true);
    try {
      const data = await apiService.getRegisteredDevices();
      setDevices(data.devices || []);
      setDevicesLoaded(true);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to load devices');
    } finally {
      setIsLoadingDevices(false);
    }
  }, [devicesLoaded, refreshing]);

  React.useEffect(() => {
    loadSessions();
    loadDevices();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSessionsLoaded(false);
    setDevicesLoaded(false);
    await Promise.all([loadSessions(), loadDevices()]);
    setRefreshing(false);
  }, []);

  const handleLogoutSession = (sessionId: string, isCurrent?: boolean) => {
    Alert.alert(
      isCurrent ? 'Logout Current Session' : 'Logout Session',
      isCurrent
        ? 'Are you sure you want to logout this device? You will be signed out.'
        : 'Are you sure you want to terminate this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setLoggingOutId(sessionId);
            try {
              if (isCurrent) {
                await apiService.logout();
                navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
              } else {
                await apiService.terminateSession(sessionId);
                setSessions((prev) => prev.filter((s) => s.id !== sessionId));
                Alert.alert('Success', 'Session terminated successfully');
              }
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to logout session');
            } finally {
              setLoggingOutId(null);
            }
          },
        },
      ],
    );
  };

  const handleRemoveDevice = (deviceId: string) => {
    Alert.alert('Remove Device', 'Are you sure you want to remove this device?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setLoggingOutId(deviceId);
          try {
            await apiService.removeDevice(deviceId);
            setDevices((prev) => prev.filter((d) => d.id !== deviceId));
            Alert.alert('Success', 'Device removed successfully');
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to remove device');
          } finally {
            setLoggingOutId(null);
          }
        },
      },
    ]);
  };

  const handleToggleTrust = async (deviceId: string, trusted: boolean) => {
    try {
      await apiService.toggleTrustDevice(deviceId, !trusted);
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, trusted: !trusted } : d)),
      );
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update device trust');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Session & Device Manager</Text>
        </View>

        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Sessions ({sessions.length})</Text>
          </View>
          {isLoadingSessions ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : sessions.length === 0 ? (
            <Text style={styles.emptyText}>No active sessions found.</Text>
          ) : (
            sessions.map((session) => (
              <View key={session.id} style={styles.itemCard}>
                <View style={styles.itemIcon}>
                  <Text style={styles.itemIconText}>
                    {session.isCurrent ? '📱' : '💻'}
                  </Text>
                </View>
                <View style={styles.itemInfo}>
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemTitle}>
                      {session.device || session.browser || 'Unknown Device'}
                    </Text>
                    {session.isCurrent && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Current</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.itemMeta}>
                    {session.location || 'Unknown location'}
                    {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                  </Text>
                  <Text style={styles.itemMeta}>
                    Last active: {session.lastActiveAt
                      ? new Date(session.lastActiveAt).toLocaleString()
                      : new Date(session.createdAt).toLocaleString()}
                  </Text>
                  {session.isCurrent && (
                    <Text style={styles.itemMeta}>Tap logout to sign out of this device</Text>
                  )}
                </View>
                <View style={styles.itemActions}>
                  {loggingOutId === session.id ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleLogoutSession(session.id, session.isCurrent)}
                      style={styles.logoutBtn}
                    >
                      <Text style={styles.logoutBtnText}>
                        {session.isCurrent ? 'Logout' : 'Terminate'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </Card>

        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Registered Devices ({devices.length})</Text>
          </View>
          {isLoadingDevices ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : devices.length === 0 ? (
            <Text style={styles.emptyText}>No registered devices found.</Text>
          ) : (
            devices.map((device) => (
              <View key={device.id} style={styles.itemCard}>
                <View style={styles.itemIcon}>
                  <Text style={styles.itemIconText}>
                    {device.deviceType === 'mobile' ? '📱' : device.deviceType === 'tablet' ? '📟' : '💻'}
                  </Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle}>
                    {device.deviceName || device.deviceType || 'Unknown Device'}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {[device.os, device.browser].filter(Boolean).join(' · ') || 'Unknown'}
                  </Text>
                  <Text style={styles.itemMeta}>
                    Last used: {device.lastUsedAt
                      ? new Date(device.lastUsedAt).toLocaleString()
                      : new Date(device.createdAt).toLocaleString()}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleToggleTrust(device.id, device.trusted)}
                    style={styles.trustBtn}
                  >
                    <Text style={[styles.trustText, device.trusted && styles.trustTextActive]}>
                      {device.trusted ? '✓ Trusted' : '○ Trust this device'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.itemActions}>
                  {loggingOutId === device.id ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleRemoveDevice(device.id)}
                      style={styles.removeBtn}
                    >
                      <Text style={styles.removeBtnText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { paddingRight: spacing.md },
  backText: { fontSize: 16, color: colors.primaryLight, fontWeight: '500' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text, flex: 1 },
  section: { margin: spacing.md, padding: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  loader: { marginTop: spacing.lg },
  emptyText: { fontSize: 14, color: colors.textLight, textAlign: 'center', marginTop: spacing.lg },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  itemIconText: { fontSize: 20 },
  itemInfo: { flex: 1 },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  itemTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  currentBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: borderRadius.sm,
  },
  currentBadgeText: { fontSize: 10, fontWeight: '600', color: colors.success },
  itemMeta: { fontSize: 12, color: colors.textLight, marginTop: 1 },
  itemActions: { marginLeft: spacing.sm },
  logoutBtn: {
    backgroundColor: colors.errorLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  logoutBtnText: { fontSize: 12, fontWeight: '600', color: colors.error },
  removeBtn: {
    backgroundColor: colors.errorLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  removeBtnText: { fontSize: 12, fontWeight: '600', color: colors.error },
  trustBtn: { marginTop: spacing.xs },
  trustText: { fontSize: 12, fontWeight: '500', color: colors.textLight },
  trustTextActive: { color: colors.success, fontWeight: '600' },
});
