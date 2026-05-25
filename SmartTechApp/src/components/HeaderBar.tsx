import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { colors, spacing, typography, shadows } from '../theme';

interface HeaderBarProps {
  title: string;
  subtitle?: string;
  leftIcon?: { name: string; onPress: () => void };
  rightIcon?: { name: string; onPress: () => void };
  colors?: readonly [string, string, ...string[]];
  style?: ViewStyle;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  title,
  subtitle,
  leftIcon,
  rightIcon,
  colors: gradientColors,
  style,
}) => {
  const { isConnected, isOnline } = useNetworkStatus();
  const isOffline = !isConnected || !isOnline;

  return (
    <>
      <LinearGradient
        colors={gradientColors || ['#1E3A8A', '#3B82F6'] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, style]}
      >
        <View style={styles.headerRow}>
          {leftIcon ? (
            <TouchableOpacity onPress={leftIcon.onPress} style={styles.iconBtn}>
              <Text style={styles.iconText}>{leftIcon.name}</Text>
            </TouchableOpacity>
          ) : <View style={styles.iconPlaceholder} />}

          <View style={styles.titleArea}>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          </View>

          {rightIcon ? (
            <TouchableOpacity onPress={rightIcon.onPress} style={styles.iconBtn}>
              <Text style={styles.iconText}>{rightIcon.name}</Text>
            </TouchableOpacity>
          ) : <View style={styles.iconPlaceholder} />}
        </View>
      </LinearGradient>
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>⚠️ You are offline. Some features may be limited.</Text>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    ...shadows.header,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 18,
  },
  iconPlaceholder: {
    width: 40,
  },
  titleArea: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.white,
  },
  subtitle: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  offlineBanner: {
    backgroundColor: colors.warning,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  offlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
});
