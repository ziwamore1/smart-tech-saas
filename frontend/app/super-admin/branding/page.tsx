'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { templateBuilderApi } from '@/lib/api';

const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradPink = 'linear-gradient(135deg, #ec4899, #db2777)';

interface Palette {
  dark1?: string; light1?: string;
  dark2?: string; light2?: string;
  accent1?: string; accent2?: string; accent3?: string;
  accent4?: string; accent5?: string; accent6?: string;
  hyperlink?: string; followedHyperlink?: string;
  [key: string]: string | undefined;
}

interface BrandingPreset {
  id: string;
  name: string;
  palette?: Palette;
  fontFamily?: string;
  headingFont?: string;
  usageCount?: number;
  schools?: { id: string; name: string }[];
  createdAt: string;
}

export default function BrandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [presets, setPresets] = useState<BrandingPreset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadPresets();
    }
  }, [isAuthenticated]);

  const loadPresets = async () => {
    try {
      setLoading(true);
      const response = await templateBuilderApi.getBrandingPresets();
      setPresets(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Failed to load branding presets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the branding preset "${name}"?`)) return;
    try {
      await templateBuilderApi.deleteBrandingPreset(id);
      loadPresets();
    } catch (error) {
      console.error('Failed to delete branding preset:', error);
    }
  };

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradPink, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
            <i className="fa fa-palette"></i>
          </div>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#db2777', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .preset-card { transition: all 0.3s ease; }
        .preset-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(236,72,153,0.12); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: gradPink, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-palette" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Brand Presets
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Manage branding presets system-wide</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Total Presets</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{presets.length}</p>
        </div>
        <div style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 4px' }}>Total Schools Using</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>
            {presets.reduce((sum, p) => sum + (p.usageCount || p.schools?.length || 0), 0)}
          </p>
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {presets.map((preset, idx) => {
          const p = preset.palette || {};
          const textBgColors = [p.dark1, p.light1, p.dark2, p.light2].filter(Boolean) as string[];
          const accentColors = [p.accent1, p.accent2, p.accent3, p.accent4, p.accent5, p.accent6].filter(Boolean) as string[];
          const linkColors = [p.hyperlink, p.followedHyperlink].filter(Boolean) as string[];
          const allColors = [...textBgColors, ...accentColors, ...linkColors];
          const usageCount = preset.usageCount || preset.schools?.length || 0;

          return (
            <div
              key={preset.id || `preset-${idx}`}
              className="preset-card"
              style={{
                background: '#fefcf9',
                borderRadius: '16px',
                border: '1px solid #f3f4f6',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                overflow: 'hidden'
              }}
            >
              {/* Color Palette Preview - all 12 colors */}
              <div style={{ height: '8px', display: 'flex' }}>
                {allColors.map((color, i) => (
                  <div key={i} style={{ flex: 1, background: color }}></div>
                ))}
              </div>
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    background: 'linear-gradient(135deg, #fdf2f8, #fce7f3)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <i className="fa fa-palette" style={{ fontSize: '20px', color: '#db2777' }}></i>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: '0 0 2px' }}>{preset.name}</h3>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>Created {preset.createdAt ? new Date(preset.createdAt).toLocaleDateString() : '-'}</span>
                  </div>
                </div>

                {/* Full Palette - Text/Background + Accents + Hyperlinks */}
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Text / Background</p>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    {textBgColors.map((color, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: color, border: '2px solid #e8ddd0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}></div>
                        <span style={{ fontSize: '8px', color: '#9ca3af', maxWidth: '32px', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{color}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Accents</p>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    {accentColors.map((color, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: color, border: '2px solid #e8ddd0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}></div>
                        <span style={{ fontSize: '8px', color: '#9ca3af', maxWidth: '32px', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{color}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hyperlinks</p>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {linkColors.map((color, i) => (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: color, border: '2px solid #e8ddd0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}></div>
                        <span style={{ fontSize: '8px', color: '#9ca3af', maxWidth: '32px', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{color}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fonts */}
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fonts</p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1, padding: '8px 12px', background: '#f5efe8', borderRadius: '8px', fontSize: '13px', color: '#374151' }}>
                      <span style={{ fontWeight: 600 }}>Body: </span>{preset.fontFamily || 'Default'}
                    </div>
                    <div style={{ flex: 1, padding: '8px 12px', background: '#f5efe8', borderRadius: '8px', fontSize: '13px', color: '#374151' }}>
                      <span style={{ fontWeight: 600 }}>Heading: </span>{preset.headingFont || 'Default'}
                    </div>
                  </div>
                </div>

                {/* Usage Stats */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '10px 14px', background: '#f0fdf4', borderRadius: '10px' }}>
                  <i className="fa fa-building" style={{ fontSize: '14px', color: '#059669' }}></i>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#065f46' }}>
                    {usageCount} {usageCount === 1 ? 'school' : 'schools'} using this preset
                  </span>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(preset.id, preset.name)}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    background: '#fefcf9',
                    color: '#ef4444',
                    border: '1px solid #fecaca',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#fecaca'; }}
                >
                  <i className="fa fa-trash" style={{ fontSize: '12px' }}></i>
                  Delete Preset
                </button>
              </div>
            </div>
          );
        })}
        {presets.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 20px' }}>
            <i className="fa fa-palette" style={{ fontSize: '40px', color: '#d1d5db', marginBottom: '12px', display: 'block' }}></i>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>No branding presets found</p>
          </div>
        )}
      </div>
    </div>
  );
}
