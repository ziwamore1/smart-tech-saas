import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { G, Circle, Path, Rect, Text as SvgText, Defs, LinearGradient, Stop, Image } from 'react-native-svg';

const SCREEN_WIDTH = Dimensions.get('window').width;

export interface StampConfig {
  id: string;
  name: string;
  title?: string;
  schoolName?: string;
  type: 'official' | 'approval' | 'verified' | 'draft' | 'confidential';
  color?: string;
  size?: number;
  opacity?: number;
  imageUrl?: string;
  svgContent?: string;
}

interface DigitalStampProps {
  config: StampConfig;
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  rotation?: number;
  showBorder?: boolean;
}

const STAMP_COLORS = {
  official: '#1E3A8A',
  approval: '#059669',
  verified: '#0891B2',
  draft: '#6B7280',
  confidential: '#DC2626',
};

export const DigitalStamp: React.FC<DigitalStampProps> = ({
  config,
  position = { x: 0, y: 0 },
  width = 150,
  height = 150,
  rotation = 0,
  showBorder = true,
}) => {
  const color = config.color || STAMP_COLORS[config.type] || STAMP_COLORS.official;
  const opacity = config.opacity ?? 0.85;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 10;

  if (config.imageUrl) {
    return (
      <View
        style={[
          styles.stampContainer,
          {
            left: position.x,
            top: position.y,
            width,
            height,
            transform: [{ rotate: `${rotation}deg` }],
            opacity,
          },
        ]}
      >
        <Svg width={width} height={height}>
          <Image href={{ uri: config.imageUrl }} x={0} y={0} width={width} height={height} preserveAspectRatio="xMidYMid meet" />
        </Svg>
      </View>
    );
  }

  if (config.svgContent) {
    return (
      <View
        style={[
          styles.stampContainer,
          {
            left: position.x,
            top: position.y,
            width,
            height,
            transform: [{ rotate: `${rotation}deg` }],
            opacity,
          },
        ]}
      >
        <Svg width={width} height={height}>
          <G dangerouslySetInnerHTML={{ __html: config.svgContent }} />
        </Svg>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.stampContainer,
        {
          left: position.x,
          top: position.y,
          width,
          height,
          transform: [{ rotate: `${rotation}deg` }],
          opacity,
        },
      ]}
    >
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="stampGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={color} stopOpacity={0.6} />
          </LinearGradient>
        </Defs>

        {showBorder && (
          <>
            <Circle cx={centerX} cy={centerY} r={radius} fill="none" stroke={color} strokeWidth={3} strokeDasharray="8 4" />
            <Circle cx={centerX} cy={centerY} r={radius - 8} fill="none" stroke={color} strokeWidth={1.5} />
          </>
        )}

        <SvgText
          x={centerX}
          y={centerY - 20}
          textAnchor="middle"
          fill={color}
          fontSize={config.type === 'official' ? 14 : 12}
          fontWeight="800"
          fontFamily="serif"
        >
          {config.schoolName || 'SMART TECH'}
        </SvgText>

        <SvgText
          x={centerX}
          y={centerY}
          textAnchor="middle"
          fill={color}
          fontSize={16}
          fontWeight="900"
          fontFamily="serif"
          letterSpacing={2}
        >
          {config.type.toUpperCase()}
        </SvgText>

        {config.name && (
          <SvgText
            x={centerX}
            y={centerY + 20}
            textAnchor="middle"
            fill={color}
            fontSize={10}
            fontWeight="600"
            fontFamily="serif"
          >
            {config.name}
          </SvgText>
        )}

        {config.title && (
          <SvgText
            x={centerX}
            y={centerY + 34}
            textAnchor="middle"
            fill={color}
            fontSize={8}
            fontWeight="500"
            fontFamily="serif"
          >
            {config.title}
          </SvgText>
        )}

        <SvgText
          x={centerX}
          y={centerY + 50}
          textAnchor="middle"
          fill={color}
          fontSize={7}
          fontWeight="400"
          fontFamily="monospace"
        >
          {new Date().toLocaleDateString()} • {config.id.substring(0, 8)}
        </SvgText>
      </Svg>
    </View>
  );
};

export const StampPreview: React.FC<{ config: StampConfig }> = ({ config }) => {
  const color = config.color || STAMP_COLORS[config.type];

  return (
    <View style={styles.previewCard}>
      <View style={[styles.previewBadge, { backgroundColor: `${color}15`, borderColor: `${color}40` }]}>
        <View style={[styles.previewDot, { backgroundColor: color }]} />
        <Text style={[styles.previewType, { color }]}>{config.type.toUpperCase()}</Text>
      </View>
      <View style={styles.previewStampArea}>
        <DigitalStamp config={config} width={120} height={120} position={{ x: 0, y: 0 }} />
      </View>
      <Text style={styles.previewName}>{config.name}</Text>
      {config.title && <Text style={styles.previewTitle}>{config.title}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  stampContainer: {
    position: 'absolute',
    pointerEvents: 'none',
  },
  previewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginVertical: 8,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  previewType: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  previewStampArea: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  previewTitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },
});
