import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { colors, spacing, borderRadius } from '../../theme';

interface InteractiveContainerProps {
  children: React.ReactNode;
  width?: number;
  height?: number;
  minZoom?: number;
  maxZoom?: number;
  label?: string;
}

export function MobileInteractiveContainer({
  children,
  width = 220,
  height = 180,
  minZoom = 0.5,
  maxZoom = 4,
  label,
}: InteractiveContainerProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const [showHint, setShowHint] = useState(true);

  const hideHint = useCallback(() => setShowHint(false), []);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, minZoom), maxZoom);
    })
    .onEnd(() => {
      if (scale.value <= 1.05) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
      if (scale.value > 1.05) runOnJS(hideHint)();
    });

  const panGesture = Gesture.Pan()
    .minPointers(2)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => runOnJS(hideHint)());

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      runOnJS(() => setShowHint(true))();
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);
  const allGestures = Gesture.Exclusive(doubleTapGesture, composed);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={[styles.container, { width, minHeight: height }]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <GestureDetector gesture={allGestures}>
        <Animated.View style={[styles.content, animatedStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
      {showHint && (
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>Pinch to zoom • Two-finger pan</Text>
        </View>
      )}
    </View>
  );
}

interface DraggablePointProps {
  cx: number;
  cy: number;
  onDragEnd?: (x: number, y: number) => void;
  color?: string;
  radius?: number;
}

export function DraggablePoint({
  cx,
  cy,
  onDragEnd,
  color = '#EA580C',
  radius = 7,
}: DraggablePointProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const size = radius * 2;

  const dragGesture = Gesture.Pan()
    .onStart(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      if (onDragEnd) {
        runOnJS(onDragEnd)(cx + translateX.value, cy + translateY.value);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: cx - radius,
            top: cy - radius,
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: color,
            borderWidth: 2,
            borderColor: '#fff',
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3,
            zIndex: 10,
          },
          animatedStyle,
        ]}
      />
    </GestureDetector>
  );
}

interface AnimatedLabelProps {
  children: React.ReactNode;
  delay?: number;
  onTap?: () => void;
}

export function AnimatedLabel({
  children,
  delay = 0,
  onTap,
}: AnimatedLabelProps) {
  const opacity = useSharedValue(0);
  const offsetY = useSharedValue(12);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 400 });
      offsetY.value = withSpring(0, { damping: 14 });
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, opacity, offsetY]);

  const labelStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: offsetY.value }],
  }));

  const content = (
    <Animated.View style={labelStyle}>{children}</Animated.View>
  );

  if (onTap) {
    return (
      <Pressable onPress={onTap} style={styles.touchableLabel}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.orange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    position: 'absolute',
    bottom: spacing.xs,
    alignSelf: 'center',
  },
  hintText: {
    fontSize: 9,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  touchableLabel: {
    zIndex: 5,
  },
});
