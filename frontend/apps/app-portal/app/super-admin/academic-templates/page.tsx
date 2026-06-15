'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
const gradRed = 'linear-gradient(135deg, #ef4444, #dc2626)';
const gradTeal = 'linear-gradient(135deg, #0d9488, #0f766e)';
const gradPink = 'linear-gradient(135deg, #ec4899, #db2777)';
const gradIndigo = 'linear-gradient(135deg, #6366f1, #4f46e5)';

const categoryColors: Record<string, { bg: string; icon: string }> = {
  'primary-school': { bg: gradBlue, icon: 'school' },
  'secondary-school': { bg: gradGreen, icon: 'book-open' },
  'advanced-secondary': { bg: gradPurple, icon: 'graduation-cap' },
  'certificates': { bg: gradOrange, icon: 'award' },
  'transcripts': { bg: gradTeal, icon: 'scroll' },
  'assessment-reports': { bg: gradPink, icon: 'clipboard-check' },
};

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  educationLevel: string;
  _count: { templates: number };
}

interface Template {
  id: string;
  name: string;
  description: string;
  templateType: string;
  primaryColor: string;
  categoryId: string;
  category?: Category;
  _count: { components: number };
  certificate?: any;
}

export default function AcademicTemplatesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) loadData();
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [catRes, tplRes] = await Promise.all([
        api.get('/super-admin/academic-templates/categories'),
        api.get('/super-admin/academic-templates'),
      ]);
      const cats = catRes.data?.data || catRes.data || [];
      const tpls = tplRes.data?.data || tplRes.data || [];
      setCategories(cats);
      setTemplates(tpls);
      if (cats.length > 0) setActiveCategory(cats[0].id);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates
    .filter(t => !activeCategory || t.categoryId === activeCategory)
    .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase()));

  const getCategoryIcon = (slug: string) => categoryColors[slug]?.icon || 'folder';
  const getCategoryColor = (slug: string) => categoryColors[slug]?.bg || gradBlue;

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Delete this template permanently?')) return;
    try {
      await api.delete(`/super-admin/academic-templates/${id}`);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradOrange, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
            <i className="fa fa-layer-group"></i>
          </div>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .cat-tab { transition: all 0.3s ease; cursor: pointer; }
        .cat-tab:hover { transform: translateY(-2px); }
        .tpl-card { transition: all 0.3s ease; cursor: pointer; }
        .tpl-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.1); }
        .search-input:focus { border-color: #ea6645 !important; box-shadow: 0 0 0 3px rgba(234,102,69,0.1); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: gradOrange, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-layer-group" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Academic Templates
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Manage professionally designed templates by education level</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => router.push('/super-admin/academic-templates/new')} style={{ padding: '10px 20px', background: gradOrange, color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(234,102,69,0.3)' }}>
            <i className="fa fa-plus"></i> New Template
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', overflowX: 'auto', paddingBottom: '4px' }}>
        {categories.map(cat => {
          const isActive = activeCategory === cat.id;
          const color = getCategoryColor(cat.slug);
          return (
            <button
              key={cat.id}
              className="cat-tab"
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '14px 20px',
                borderRadius: '14px',
                border: isActive ? 'none' : '1px solid #e8ddd0',
                background: isActive ? color : '#fefcf9',
                color: isActive ? 'white' : '#374151',
                boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                minWidth: '180px',
                flex: '0 0 auto',
              }}
            >
              <div style={{
                width: '36px', height: '36px',
                background: isActive ? 'rgba(255,255,255,0.2)' : `${cat.color || '#f3f4f6'}`,
                borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className={`fa fa-${cat.icon || getCategoryIcon(cat.slug)}`} style={{ fontSize: '16px', color: isActive ? 'white' : '#6b7280' }}></i>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>{cat.name}</div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>{cat._count?.templates || 0} templates</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search templates..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="search-input"
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '12px 16px',
            borderRadius: '10px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            outline: 'none',
            background: '#fefcf9',
          }}
        />
      </div>

      {/* Template Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
        {filteredTemplates.map(tpl => (
          <div
            key={tpl.id}
            className="tpl-card"
            style={{
              background: '#fefcf9',
              borderRadius: '16px',
              border: '1px solid #f3f4f6',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div style={{
              height: '140px',
              background: `linear-gradient(135deg, ${tpl.primaryColor || '#1a365d'}, ${tpl.secondaryColor || '#f5f5f5'})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M0 0h40v40H0z\'/%3E%3C/g%3E%3C/svg%3E")',
              }}></div>
              <div style={{
                width: '60px', height: '60px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}>
                <i className="fa fa-file-alt" style={{ fontSize: '28px', color: 'white' }}></i>
              </div>
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                padding: '4px 10px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '20px',
                color: 'white',
                fontSize: '11px',
                fontWeight: 600,
                backdropFilter: 'blur(4px)',
                textTransform: 'capitalize',
              }}>
                {tpl.templateType?.replace(/_/g, ' ').toLowerCase()}
              </div>
            </div>
            <div style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1f2937', margin: '0 0 8px', lineHeight: 1.3 }}>{tpl.name}</h3>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {tpl.description || 'No description'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                <i className="fa fa-puzzle-piece" style={{ fontSize: '12px', color: '#9ca3af' }}></i>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{tpl._count?.components || 0} components</span>
                {tpl.certificate && (
                  <>
                    <span style={{ color: '#d1d5db' }}>|</span>
                    <i className="fa fa-qrcode" style={{ fontSize: '12px', color: '#9ca3af' }}></i>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>QR Ready</span>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => router.push(`/super-admin/academic-templates/${tpl.id}`)}
                  style={{
                    flex: 1, padding: '8px 16px',
                    background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                    color: '#7c3aed', border: 'none', borderRadius: '8px',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#7c3aed'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #f5f3ff, #ede9fe)'; e.currentTarget.style.color = '#7c3aed'; }}
                >
                  <i className="fa fa-eye"></i> Preview
                </button>
                <button
                  onClick={() => handleDeleteTemplate(tpl.id)}
                  style={{
                    padding: '8px 12px',
                    background: '#fef2f2', color: '#dc2626',
                    border: '1px solid #fecaca', borderRadius: '8px',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <i className="fa fa-trash"></i>
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredTemplates.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px' }}>
            <i className="fa fa-file-alt" style={{ fontSize: '48px', color: '#d1d5db', marginBottom: '16px', display: 'block' }}></i>
            <p style={{ fontSize: '16px', color: '#6b7280', margin: 0 }}>No templates in this category yet</p>
            <button onClick={() => router.push('/super-admin/academic-templates/new')} style={{ marginTop: '16px', padding: '10px 20px', background: gradOrange, color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              Create Template
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
