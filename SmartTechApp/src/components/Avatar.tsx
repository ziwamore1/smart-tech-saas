import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme';

interface AvatarProps {
  photoUrl?: string | null;
  firstName?: string;
  lastName?: string;
  size?: number;
  style?: ViewStyle;
}

type ImageStyleProp = { width: number; height: number; borderRadius: number };

export const Avatar: React.FC<AvatarProps> = ({
  photoUrl,
  firstName,
  lastName,
  size = 100,
  style,
}) => {
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  const fontSize = size * 0.36;

  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[
          styles.image,
          { width: size, height: size, borderRadius: size / 2 } as ImageStyleProp,
          style as any,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.background,
  },
  fallback: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontWeight: '700',
    color: colors.white,
  },
});
