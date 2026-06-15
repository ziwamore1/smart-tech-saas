'use client';

import { useState } from 'react';

interface TemplatePreviewProps {
  template: {
    name: string;
    templateType: string;
    pageSize?: string;
    orientation?: string;
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    fontSize?: number;
    components?: any[];
    certificate?: any;
  };
  height?: number;
  width?: number;
}

export function TemplatePreview({ template, height, width }: TemplatePreviewProps) {
  const pageWidth = width || (template.orientation === 'landscape' ? 680 : 500);
  const pageHeight = height || (template.orientation === 'landscape' ? 480 : 680);
  const primaryColor = template.primaryColor || '#1a365d';

  return (
    <div style={{
      width: pageWidth,
      height: pageHeight,
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      overflow: 'hidden',
      position: 'relative',
      border: '1px solid #e5e7eb',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        padding: '16px',
        display: 'flex', flexDirection: 'column', gap: '6px',
        fontSize: '10px',
      }}>
        {/* Header */}
        <div style={{
          textAlign: 'center',
          padding: '8px 12px',
          background: primaryColor,
          color: 'white',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.5px',
        }}>
          {template.name}
        </div>

        {/* School Info */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '6px 8px', background: '#f9fafb', borderRadius: '4px' }}>
          <div style={{
            width: '32px', height: '32px',
            background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}88)`,
            borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '14px', fontWeight: 700,
          }}>
            S
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ height: '8px', width: '60%', background: '#e5e7eb', borderRadius: '2px', marginBottom: '3px' }}></div>
            <div style={{ height: '6px', width: '40%', background: '#e5e7eb', borderRadius: '2px' }}></div>
          </div>
          <div style={{ width: '24px', height: '24px', background: '#e5e7eb', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-camera" style={{ fontSize: '10px', color: '#9ca3af' }}></i>
          </div>
        </div>

        {/* Student Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', padding: '6px 8px', background: '#f9fafb', borderRadius: '4px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: '6px', width: `${50 + i * 15}%`, background: '#e5e7eb', borderRadius: '2px' }}></div>
          ))}
        </div>

        {/* Components Preview (Results table simulation) */}
        <div style={{ flex: 1, background: '#f9fafb', borderRadius: '4px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {/* Table header */}
          <div style={{ display: 'flex', gap: '4px', padding: '4px 6px', background: primaryColor, borderRadius: '3px' }}>
            {['Subject', 'Score', 'Grade', 'Remark'].map(h => (
              <div key={h} style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }}></div>
            ))}
          </div>
          {/* Table rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '4px', padding: '4px 6px', background: i % 2 === 0 ? 'white' : '#f3f4f6', borderRadius: '2px' }}>
              <div style={{ flex: 1, height: '7px', background: '#e5e7eb', borderRadius: '2px' }}></div>
              <div style={{ flex: 0.5, height: '7px', background: i < 4 ? '#bbf7d0' : '#fecaca', borderRadius: '2px' }}></div>
              <div style={{ flex: 0.4, height: '7px', background: '#e5e7eb', borderRadius: '2px' }}></div>
              <div style={{ flex: 0.6, height: '7px', background: '#e5e7eb', borderRadius: '2px' }}></div>
            </div>
          ))}
        </div>

        {/* Remarks area */}
        <div style={{ display: 'flex', gap: '4px', padding: '6px 8px', background: '#fefce8', borderRadius: '4px', border: '1px solid #fde68a' }}>
          <i className="fa fa-comment" style={{ fontSize: '10px', color: '#a16207', marginTop: '1px' }}></i>
          <div style={{ flex: 1, height: '20px', background: '#fef9c3', borderRadius: '2px', display: 'flex', gap: '4px', flexDirection: 'column' }}>
            <div style={{ height: '6px', width: '80%', background: '#fde68a', borderRadius: '2px' }}></div>
            <div style={{ height: '6px', width: '50%', background: '#fde68a', borderRadius: '2px' }}></div>
          </div>
        </div>

        {/* Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px' }}>
          <div style={{ width: '80px', height: '20px', borderTop: '1px solid #d1d5db', textAlign: 'center', fontSize: '7px', color: '#9ca3af', paddingTop: '4px' }}>
            Teacher
          </div>
          <div style={{ width: '80px', height: '20px', borderTop: '1px solid #d1d5db', textAlign: 'center', fontSize: '7px', color: '#9ca3af', paddingTop: '4px' }}>
            Head Teacher
          </div>
          <div style={{ width: '24px', height: '24px', background: '#e5e7eb', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-qrcode" style={{ fontSize: '12px', color: '#9ca3af' }}></i>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '4px', fontSize: '7px', color: '#9ca3af', borderTop: '1px solid #e5e7eb' }}>
          {template.pageSize || 'A4'} · {template.orientation || 'portrait'} · Preview
        </div>
      </div>
    </div>
  );
}

interface TemplateCardProps {
  template: any;
  onPreview?: (id: string) => void;
  onApply?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export function TemplateCard({ template, onPreview, onApply, onDuplicate }: TemplateCardProps) {
  const primaryColor = template.primaryColor || '#1a365d';

  return (
    <div style={{
      background: '#fefcf9',
      borderRadius: '16px',
      border: '1px solid #f3f4f6',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{
        height: '120px',
        background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}aa)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <div style={{
          width: '48px', height: '48px',
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}>
          <i className="fa fa-file-alt" style={{ fontSize: '22px', color: 'white' }}></i>
        </div>
        <div style={{
          position: 'absolute', top: '10px', right: '10px',
          padding: '3px 8px', background: 'rgba(255,255,255,0.2)',
          borderRadius: '12px', fontSize: '10px', fontWeight: 600, color: 'white',
          textTransform: 'capitalize', backdropFilter: 'blur(4px)',
        }}>
          {template.templateType?.replace(/_/g, ' ')}
        </div>
      </div>
      <div style={{ padding: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', margin: '0 0 6px' }}>{template.name}</h3>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, overflow: 'hidden' }}>
          {template.description || 'Professional report template'}
        </p>
        <div style={{ display: 'flex', gap: '6px' }}>
          {onPreview && <ActionButton icon="eye" label="Preview" onClick={() => onPreview(template.id)} color="#7c3aed" />}
          {onApply && <ActionButton icon="check" label="Apply" onClick={() => onApply(template.id)} color="#059669" />}
          {onDuplicate && <ActionButton icon="copy" label="Duplicate" onClick={() => onDuplicate(template.id)} color="#2563eb" />}
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, color }: { icon: string; label: string; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '6px 12px', border: 'none', borderRadius: '6px',
        fontSize: '11px', fontWeight: 600, cursor: 'pointer',
        background: `${color}15`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = 'white'; }}
      onMouseLeave={e => { e.currentTarget.style.background = `${color}15`; e.currentTarget.style.color = color; }}
    >
      <i className={`fa fa-${icon}`}></i> {label}
    </button>
  );
}
