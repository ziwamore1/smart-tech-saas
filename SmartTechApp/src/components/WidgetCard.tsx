import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, shadows, typography } from '../theme';

interface WidgetCardProps {
  title: string;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
  children: React.ReactNode;
}

export const WidgetCard: React.FC<WidgetCardProps> = ({
  title,
  action,
  style,
  children,
}) => {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {action && (
          <TouchableOpacity onPress={action.onPress}>
            <Text style={styles.action}>{action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h4,
  },
  action: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryLight,
  },
});
