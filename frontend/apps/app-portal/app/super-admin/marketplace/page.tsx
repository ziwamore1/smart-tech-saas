'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { templateBuilderApi, api } from '@/lib/api';

const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';

interface MarketplaceTemplate {
  id: string;
  title: string;
  description: string;
  school?: { id: string; name: string };
  schoolName?: string;
  downloads: number;
  likes: number;
  featured: boolean;
  category?: string;
  createdAt: string;
}

export default function MarketplacePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<MarketplaceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadTemplates();
    }
  }, [isAuthenticated]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await templateBuilderApi.getMarketplaceTemplates();
      setTemplates(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Failed to load marketplace templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = !search ||
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.school?.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.schoolName?.toLowerCase().includes(search.toLowerCase());
    const matchesFeatured = featuredOnly ? t.featured : true;
    return matchesSearch && matchesFeatured;
  });

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradPurple, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
            <i className="fa fa-store"></i>
          </div>
          <div style={{ width: '40px', height: '40px', border: '3px solid #e8ddd0', borderTopColor: '#7c3aed', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .marketplace-card { transition: all 0.3s ease; cursor: pointer; }
        .marketplace-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(139,92,246,0.15); }
        .search-input:focus { border-color: #8b5cf6 !important; box-shadow: 0 0 0 3px rgba(139,92,246,0.1); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: gradPurple, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-store" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Marketplace
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Explore and manage marketplace templates</p>
        </div>
        <button
          onClick={async () => {
            try {
              setSeeding(true);
              const res = await templateBuilderApi.getMarketplaceTemplates();
              const res2 = await api.post('/super-admin/academic-templates/seed-marketplace');
              alert('System templates published to marketplace!');
              loadTemplates();
            } catch (err) {
              console.error('Seed failed:', err);
            } finally {
              setSeeding(false);
            }
          }}
          disabled={seeding}
          style={{
            padding: '10px 20px', background: gradGreen, color: 'white', border: 'none',
            borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '8px',
            opacity: seeding ? 0.7 : 1,
          }}
        >
          <i className={`fa ${seeding ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'}`}></i>
          {seeding ? 'Publishing...' : 'Publish All System Templates'}
        </button>
      </div>

      {/* Search and Filter */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
          style={{
            flex: 1,
            minWidth: '250px',
            padding: '12px 16px',
            borderRadius: '10px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            outline: 'none',
            background: '#fefcf9'
          }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
          <div
            onClick={() => setFeaturedOnly(!featuredOnly)}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '6px',
              border: featuredOnly ? 'none' : '2px solid #d1d5db',
              background: featuredOnly ? gradPurple : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {featuredOnly && <i className="fa fa-check" style={{ fontSize: '11px', color: 'white' }}></i>}
          </div>
          Featured only
        </label>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            className="marketplace-card"
            style={{
              background: '#fefcf9',
              borderRadius: '16px',
              border: '1px solid #f3f4f6',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {template.featured && (
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                padding: '4px 12px',
                background: gradOrange,
                color: 'white',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                zIndex: 1
              }}>
                <i className="fa fa-star" style={{ fontSize: '10px' }}></i>
                Featured
              </div>
            )}
            <div style={{ padding: '24px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <i className="fa fa-file-alt" style={{ fontSize: '22px', color: '#7c3aed' }}></i>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: '0 0 8px', lineHeight: 1.3 }}>{template.title}</h3>
              <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {template.description || 'No description provided'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                <i className="fa fa-building" style={{ fontSize: '12px', color: '#9ca3af' }}></i>
                <span style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>{template.school?.name || template.schoolName || 'System'}</span>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa fa-download" style={{ fontSize: '13px', color: '#8b5cf6' }}></i>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{template.downloads || 0}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa fa-heart" style={{ fontSize: '13px', color: '#ef4444' }}></i>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>{template.likes || 0}</span>
                </div>
              </div>
              <button
                onClick={() => router.push(`/super-admin/academic-templates/${template.template?.id || template.id}`)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                  color: '#7c3aed',
                  border: 'none',
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
                onMouseEnter={(e) => { e.currentTarget.style.background = gradPurple; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(135deg, #f5f3ff, #ede9fe)'; e.currentTarget.style.color = '#7c3aed'; }}
              >
                <i className="fa fa-eye" style={{ fontSize: '13px' }}></i>
                View Template
              </button>
            </div>
          </div>
        ))}
        {filteredTemplates.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 20px' }}>
            <i className="fa fa-store" style={{ fontSize: '40px', color: '#d1d5db', marginBottom: '12px', display: 'block' }}></i>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>No marketplace templates found</p>
          </div>
        )}
      </div>
    </div>
  );
}
