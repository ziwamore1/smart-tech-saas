'use client';

import React from 'react';
import { StampConfig, STAMP_COLORS } from '@/types/stamps';

interface DigitalStampProps {
  config: StampConfig;
  width?: number;
  height?: number;
  rotation?: number;
  showBorder?: boolean;
  className?: string;
}

export const DigitalStamp: React.FC<DigitalStampProps> = ({
  config,
  width = 150,
  height = 150,
  rotation = 0,
  showBorder = true,
  className = '',
}) => {
  const color = config.color || STAMP_COLORS[config.type] || STAMP_COLORS.official;
  const opacity = config.opacity ?? 0.85;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 10;

  if (config.imageUrl) {
    return (
      <div
        className={className}
        style={{
          width,
          height,
          transform: `rotate(${rotation}deg)`,
          opacity,
        }}
      >
        <img src={config.imageUrl} alt={config.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    );
  }

  if (config.svgContent) {
    return (
      <div
        className={className}
        style={{
          width,
          height,
          transform: `rotate(${rotation}deg)`,
          opacity,
        }}
        dangerouslySetInnerHTML={{ __html: config.svgContent }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        width,
        height,
        transform: `rotate(${rotation}deg)`,
        opacity,
        position: 'relative',
      }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id={`stampGrad-${config.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity={0.9} />
            <stop offset="100%" stopColor={color} stopOpacity={0.6} />
          </linearGradient>
        </defs>

        {showBorder && (
          <>
            <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke={color} strokeWidth={3} strokeDasharray="8 4" />
            <circle cx={centerX} cy={centerY} r={radius - 8} fill="none" stroke={color} strokeWidth={1.5} />
          </>
        )}

        <text
          x={centerX}
          y={centerY - 20}
          textAnchor="middle"
          fill={color}
          fontSize={config.type === 'official' ? 14 : 12}
          fontWeight="800"
          fontFamily="serif"
        >
          {config.schoolName || 'SMART TECH'}
        </text>

        <text
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
        </text>

        {config.name && (
          <text
            x={centerX}
            y={centerY + 20}
            textAnchor="middle"
            fill={color}
            fontSize={10}
            fontWeight="600"
            fontFamily="serif"
          >
            {config.name}
          </text>
        )}

        {config.title && (
          <text
            x={centerX}
            y={centerY + 34}
            textAnchor="middle"
            fill={color}
            fontSize={8}
            fontWeight="500"
            fontFamily="serif"
          >
            {config.title}
          </text>
        )}

        <text
          x={centerX}
          y={centerY + 50}
          textAnchor="middle"
          fill={color}
          fontSize={7}
          fontWeight="400"
          fontFamily="monospace"
        >
          {new Date().toLocaleDateString()} • {config.id.substring(0, 8)}
        </text>
      </svg>
    </div>
  );
};

export const StampPreview: React.FC<{ config: StampConfig }> = ({ config }) => {
  const color = config.color || STAMP_COLORS[config.type];

  return (
    <div className="bg-white rounded-xl p-4 text-center border border-gray-100">
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold tracking-wider mb-3"
        style={{ backgroundColor: `${color}15`, borderColor: `${color}40`, color }}
      >
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        {config.type.toUpperCase()}
      </div>
      <div className="flex justify-center mb-3">
        <DigitalStamp config={config} width={120} height={120} />
      </div>
      <p className="text-sm font-semibold text-gray-900">{config.name}</p>
      {config.title && <p className="text-xs text-gray-500 mt-0.5">{config.title}</p>}
    </div>
  );
};
