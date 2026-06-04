// Must be first import - patches TurboModuleProxy before any native module imports
import './src/turboModulePatcher';
import React, { useEffect, useState, useRef, Component } from 'react';
import { StyleSheet, View, Platform, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppNavigator } from './src/navigation/AppNavigator';
import { Loading } from './src/components';
import { apiService } from './src/services/api';
import { useAuthStore } from './src/store';

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
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    registerForPushNotificationsAsync().catch(console.warn);
    setAppIsReady(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

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
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1E3A8A',
    });
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
});
