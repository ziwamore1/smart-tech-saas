import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, spacing, shadows } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'small' | 'medium' | 'large';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'default',
  padding = 'medium',
}) => {
  const getPadding = () => {
    switch (padding) {
      case 'none':
        return 0;
      case 'small':
        return spacing.sm;
      case 'large':
        return spacing.lg;
      default:
        return spacing.md;
    }
  };

  const getVariantStyle = () => {
    switch (variant) {
      case 'elevated':
        return [styles.elevated, shadows.md];
      case 'outlined':
        return styles.outlined;
      default:
        return styles.default;
    }
  };

  return (
    <View
      style={[
        styles.card,
        getVariantStyle(),
        { padding: getPadding() },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
  },
  default: {
    ...shadows.sm,
  },
  elevated: {
    backgroundColor: colors.white,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.border,
  },
});
