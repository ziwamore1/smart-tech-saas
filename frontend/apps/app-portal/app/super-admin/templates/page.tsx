'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { templateBuilderApi } from '@/lib/api';

const gradOrange = 'linear-gradient(135deg, #ea6645, #f59e0b)';
const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
const gradTeal = 'linear-gradient(135deg, #0d9488, #0f766e)';

interface Template {
  id: string;
  name: string;
  type: string;
  status: string;
  school?: { id: string; name: string };
  schoolName?: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
      const response = await templateBuilderApi.getTemplates();
      setTemplates(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await templateBuilderApi.publishTemplate(id);
      loadTemplates();
    } catch (error) {
      console.error('Failed to publish template:', error);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await templateBuilderApi.archiveTemplate(id);
      loadTemplates();
    } catch (error) {
      console.error('Failed to archive template:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      await templateBuilderApi.deleteTemplate(id);
      loadTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const statusChips = ['all', 'draft', 'published', 'archived'];
  const filteredTemplates = statusFilter === 'all'
    ? templates
    : templates.filter(t => t.status?.toLowerCase() === statusFilter);

  const draftCount = templates.filter(t => t.status?.toLowerCase() === 'draft').length;
  const publishedCount = templates.filter(t => t.status?.toLowerCase() === 'published').length;

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'published':
        return { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0', icon: 'fa-check-circle' };
      case 'draft':
        return { bg: '#fef3c7', text: '#92400e', border: '#fde68a', icon: 'fa-pen' };
      case 'archived':
        return { bg: '#fee2e2', text: '#991b1b', border: '#fecaca', icon: 'fa-archive' };
      default:
        return { bg: '#f3f4f6', text: '#374151', border: '#e8ddd0', icon: 'fa-circle' };
    }
  };

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5efe8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: gradOrange, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '18px' }}>
            <i className="fa fa-file-alt"></i>
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
        .stat-card { transition: all 0.3s ease; cursor: pointer; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: 0 10px 40px rgba(0,0,0,0.12); }
        .template-row { transition: all 0.2s ease; }
        .template-row:hover { background: #f5efe8; }
        .chip { transition: all 0.2s ease; cursor: pointer; }
        .chip:hover { transform: translateY(-1px); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: gradOrange, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-file-alt" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Report Templates
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Manage all report templates across schools</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(59,130,246,0.1)', borderBottomLeftRadius: '40px' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: gradBlue, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-file-alt" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: '20px' }}>TOTAL</span>
          </div>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 2px' }}>All Templates</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{templates.length}</p>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(245,158,11,0.1)', borderBottomLeftRadius: '40px' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-pen" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#d97706', background: '#fef3c7', padding: '3px 8px', borderRadius: '20px' }}>DRAFT</span>
          </div>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 2px' }}>Draft Templates</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{draftCount}</p>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(16,185,129,0.1)', borderBottomLeftRadius: '40px' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: gradGreen, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-check-circle" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669', background: '#ecfdf5', padding: '3px 8px', borderRadius: '20px' }}>PUBLISHED</span>
          </div>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 2px' }}>Published Templates</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{publishedCount}</p>
        </div>

        <div className="stat-card" style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'rgba(139,92,246,0.1)', borderBottomLeftRadius: '40px' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: gradPurple, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-store" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#7c3aed', background: '#f5f3ff', padding: '3px 8px', borderRadius: '20px' }}>ARCHIVED</span>
          </div>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 2px' }}>Archived Templates</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: 0 }}>{templates.length - draftCount - publishedCount}</p>
        </div>
      </div>

      {/* Status Chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {statusChips.map(chip => (
          <button
            key={chip}
            className="chip"
            onClick={() => setStatusFilter(chip)}
            style={{
              padding: '8px 18px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              background: statusFilter === chip ? gradOrange : 'white',
              color: statusFilter === chip ? 'white' : '#6b7280',
              boxShadow: statusFilter === chip ? '0 2px 8px rgba(234,102,69,0.3)' : '0 1px 3px rgba(0,0,0,0.06)',
              border: statusFilter === chip ? 'none' : '1px solid #e8ddd0',
              textTransform: 'capitalize'
            }}
          >
            {chip === 'all' ? 'All' : chip}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #f5efe8, #f3f4f6)', borderBottom: '1px solid #e8ddd0' }}>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Type</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>School</th>
                <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last Updated</th>
                <th style={{ padding: '14px 20px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.map((template) => {
                const badge = getStatusBadge(template.status);
                return (
                  <tr key={template.id} className="template-row" style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>{template.name}</div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 500, borderRadius: '6px', background: '#f3f4f6', color: '#374151', textTransform: 'capitalize' }}>
                        {template.type || 'Standard'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', background: badge.bg, color: badge.text, border: `1px solid ${badge.border}`, display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'capitalize' }}>
                        <i className={`fa ${badge.icon}`} style={{ fontSize: '10px' }}></i>
                        {template.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: '14px', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa fa-building" style={{ fontSize: '12px', color: '#9ca3af' }}></i>
                        {template.school?.name || template.schoolName || 'System'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>
                        {template.updatedAt ? new Date(template.updatedAt).toLocaleDateString() : '-'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => router.push(`/super-admin/templates/${template.id}`)}
                          style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <i className="fa fa-eye" style={{ fontSize: '10px' }}></i> View
                        </button>
                        {template.status?.toLowerCase() !== 'published' && (
                          <button
                            onClick={() => handlePublish(template.id)}
                            style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, background: gradGreen, color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <i className="fa fa-check" style={{ fontSize: '10px' }}></i> Publish
                          </button>
                        )}
                        {template.status?.toLowerCase() !== 'archived' && template.status?.toLowerCase() === 'published' && (
                          <button
                            onClick={() => handleArchive(template.id)}
                            style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <i className="fa fa-archive" style={{ fontSize: '10px' }}></i> Archive
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(template.id)}
                          style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <i className="fa fa-trash" style={{ fontSize: '10px' }}></i> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredTemplates.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center' }}>
                    <i className="fa fa-file-alt" style={{ fontSize: '32px', color: '#d1d5db', marginBottom: '12px', display: 'block' }}></i>
                    <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>No templates found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
