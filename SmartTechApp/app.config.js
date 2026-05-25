const { config } = require('dotenv');
config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://192.168.43.134:3001/api/v1';

module.exports = {
  expo: {
    name: process.env.APP_NAME || 'SmartTech',
    slug: 'smarttech-app',
    version: process.env.APP_VERSION || '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'smarttech',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#1E3A8A',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.smarttech.school',
      infoPlist: {
        NSAppTransportSecurity: { NSAllowsArbitraryLoads: true },
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1E3A8A',
      },
      package: 'com.smarttech.school',
      useNextNotificationsApi: true,
      softwareKeyboardLayoutMode: 'pan',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'smarttech', host: '*' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    plugins: [
      'expo-asset',
      'expo-splash-screen',
      'expo-barcode-scanner',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#1E3A8A',
        },
      ],
    ],
    extra: {
      apiBaseUrl: API_BASE_URL,
      eas: {
        projectId: 'smarttech-app',
      },
    },
    runtimeVersion: { policy: 'appVersion' },
    updates: {
      url: 'https://u.expo.dev/smarttech-app',
      enabled: false,
      fallbackToCacheTimeout: 0,
    },
    jsEngine: 'hermes',
  },
};
