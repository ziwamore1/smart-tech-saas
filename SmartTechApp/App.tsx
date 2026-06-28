// Must be first import - patches TurboModuleProxy before any native module imports
import './src/turboModulePatcher';
import React, { useEffect, useState, useRef, Component, useCallback } from 'react';
import { StyleSheet, View, Platform, Text, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { Loading } from './src/components';
import { apiService } from './src/services/api';
import { useAuthStore } from './src/store';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENV || 'development',
    tracesSampleRate: 0.2,
    attachStacktrace: true,
    enabled: true,
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: 2,
    },
  },
});

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class ErrorBoundary extends Component<{children: React.ReactNode}, {error: Error | null}> {
  state = {error: null};
  static getDerivedStateFromError(error: Error) { return {error}; }
  componentDidCatch(error: Error) {
    if (SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#1E3A8A'}}>
          <Text style={{color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 12}}>Error</Text>
          <Text style={{color: '#FBBF24', fontSize: 13, textAlign: 'center', marginBottom: 20}}>
            {this.state.error.message}
          </Text>
          <Text style={{color: 'rgba(255,255,255,0.6)', fontSize: 10, textAlign: 'center'}}>
            {this.state.error.stack?.split('\n').slice(0, 5).join('\n')}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [updateState, setUpdateState] = useState<{ available: boolean; downloading: boolean; downloaded: boolean; apkInfo?: any }>({ available: false, downloading: false, downloaded: false });
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    (async () => {
      await setupNotificationChannels();
      await registerForPushNotificationsAsync();
    })();
    setAppIsReady(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    registerForPushNotificationsAsync().catch(console.warn);

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [isAuthenticated]);

  const checkForUpdates = useCallback(async () => {
    if (__DEV__) return;
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setUpdateState(prev => ({ ...prev, available: true, downloading: true }));
        await Updates.fetchUpdateAsync();
        setUpdateState(prev => ({ ...prev, downloading: false, downloaded: true }));
      }
    } catch (e) {
      console.log('OTA update check failed:', e);
    }
    try {
      const info = await apiService.getAppVersion();
      if (info?.apkUrl && info?.latestVersion && info.latestVersion !== '1.0.0') {
        setUpdateState(prev => ({ ...prev, apkInfo: info }));
      }
    } catch (_) {}
  }, []);

  const applyUpdate = useCallback(async () => {
    setUpdateState(prev => ({ ...prev, downloading: true }));
    try {
      await Updates.reloadAsync();
    } catch (e) {
      console.log('Update reload failed:', e);
      setUpdateState(prev => ({ ...prev, downloading: false }));
    }
  }, []);

  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return (
      <View style={styles.loadingContainer}>
        <Loading fullScreen message="Loading SmartTech..." />
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <ErrorBoundary>
            <AppNavigator />
          </ErrorBoundary>
          {updateState.downloading && !updateState.downloaded && (
            <View style={styles.updateBanner}>
              <Text style={styles.updateBannerText}>Downloading update...</Text>
            </View>
          )}
          {updateState.downloaded && (
            <TouchableOpacity style={styles.updateBannerRestart} onPress={applyUpdate} activeOpacity={0.8}>
              <Text style={styles.updateBannerRestartText}>Update ready — Tap to restart</Text>
            </TouchableOpacity>
          )}
          {updateState.apkInfo?.apkUrl && (
            <View style={styles.updateBanner}>
              <Text style={styles.updateBannerText}>New version {updateState.apkInfo.latestVersion} available — Download from portal</Text>
            </View>
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('smart_tech_notifications', {
      name: 'SmartTech Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1E3A8A',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log('Push token:', token);

  try {
    await apiService.registerPushToken(token);
  } catch (e) {
    console.warn('Failed to register push token:', e);
  }
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingContainer: { flex: 1, backgroundColor: '#1E3A8A' },
  updateBanner: { position: 'absolute', top: 50, left: 16, right: 16, backgroundColor: '#1E3A8A', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', zIndex: 9999, elevation: 10 },
  updateBannerText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  updateBannerRestart: { position: 'absolute', bottom: 30, left: 16, right: 16, backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', zIndex: 9999, elevation: 10 },
  updateBannerRestartText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
