'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { landingMockupApi } from '@/lib/api';

const gradOrange = 'linear-gradient(135deg, #f97316, #ea580c)';
const gradGreen = 'linear-gradient(135deg, #10b981, #059669)';
const gradRed = 'linear-gradient(135deg, #ef4444, #dc2626)';
const gradPurple = 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
const gradBlue = 'linear-gradient(135deg, #3b82f6, #2563eb)';

interface Mockup {
  id: string;
  label: string;
  role: string;
  category: string;
  imageUrl: string;
  thumbnailUrl?: string;
  order: number;
  isActive: boolean;
}

const roleOptions = ['student', 'parent', 'teacher', 'director', 'super_admin'];
const categoryOptions = ['dashboard', 'attendance', 'results', 'ai_tutor', 'report_card', 'analytics', 'certificates', 'timetable'];

export default function LandingMockupsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [mockups, setMockups] = useState<Mockup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Mockup | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    label: '',
    role: 'student',
    category: 'dashboard',
    order: 0,
    isActive: true,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) loadMockups();
  }, [isAuthenticated]);

  const loadMockups = async () => {
    try {
      setLoading(true);
      const res = await landingMockupApi.getAll();
      const data = res.data?.data || res.data || [];
      setMockups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load mockups', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ label: '', role: 'student', category: 'dashboard', order: mockups.length, isActive: true });
    setSelectedFile(null);
    setPreview(null);
    setShowForm(true);
  };

  const openEdit = (m: Mockup) => {
    setEditing(m);
    setForm({ label: m.label, role: m.role, category: m.category, order: m.order, isActive: m.isActive });
    setSelectedFile(null);
    setPreview(m.imageUrl);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.label || !selectedFile && !editing) return;

    try {
      setUploading(true);

      if (editing) {
        const updateData: any = { ...form };
        if (selectedFile) {
          const fd = new FormData();
          fd.append('file', selectedFile);
          fd.append('label', form.label);
          fd.append('role', form.role);
          fd.append('category', form.category);
          fd.append('order', String(form.order));
          fd.append('isActive', String(form.isActive));
          const uploadRes = await landingMockupApi.upload(fd);
          const uploaded = uploadRes.data?.data || uploadRes.data;
          await landingMockupApi.update(editing.id, {
            label: form.label,
            role: form.role,
            category: form.category,
            order: form.order,
            isActive: form.isActive,
            imageUrl: uploaded.imageUrl,
          });
        } else {
          await landingMockupApi.update(editing.id, updateData);
        }
      } else {
        const fd = new FormData();
        fd.append('file', selectedFile!);
        fd.append('label', form.label);
        fd.append('role', form.role);
        fd.append('category', form.category);
        fd.append('order', String(form.order));
        fd.append('isActive', String(form.isActive));
        await landingMockupApi.upload(fd);
      }

      setShowForm(false);
      loadMockups();
    } catch (err) {
      console.error('Failed to save mockup', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this mockup?')) return;
    try {
      await landingMockupApi.delete(id);
      loadMockups();
    } catch (err) {
      console.error('Failed to delete mockup', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px' }}>
      <style>{`
        .mc { transition: all 0.3s ease; }
        .mc:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(249,115,22,0.12); }
        .mc-img { transition: all 0.3s ease; }
        .mc:hover .mc-img { transform: scale(1.05); }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: gradOrange, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>📱</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Landing Page Mockups</h1>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>Manage phone screenshots displayed on the marketing landing page</p>
            </div>
          </div>
        </div>
        <button onClick={openCreate} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
          border: 'none', borderRadius: 10, background: gradOrange, color: '#fff',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}>
          + Add Mockup
        </button>
      </div>

      {/* Upload Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => !uploading && setShowForm(false)}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 32, width: 480,
            maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto',
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#111827' }}>
              {editing ? 'Edit Mockup' : 'Upload New Mockup'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* File Upload */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Screenshot Image</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed #d1d5db', borderRadius: 12, padding: 24,
                    textAlign: 'center', cursor: 'pointer', background: '#f9fafb',
                  }}
                >
                  {preview ? (
                    <img src={preview} alt="Preview" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8 }} />
                  ) : (
                    <div>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📱</div>
                      <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Click to upload a phone screenshot</p>
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>PNG, JPG, WebP (max 10MB)</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} style={{ display: 'none' }} />
              </div>

              {/* Label */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Label</label>
                <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g. Student Dashboard"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none' }}
                />
              </div>

              {/* Role + Category */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Role</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff' }}
                  >
                    {roleOptions.map((r) => <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff' }}
                  >
                    {categoryOptions.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                  </select>
                </div>
              </div>

              {/* Order + Active */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Display Order</label>
                  <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Status</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      style={{ width: 18, height: 18 }}
                    />
                    <span style={{ fontSize: 14, color: '#374151' }}>Active (visible on landing page)</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button onClick={() => setShowForm(false)} disabled={uploading} style={{
                  padding: '10px 20px', border: '1px solid #d1d5db', borderRadius: 8,
                  background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', color: '#374151',
                }}>Cancel</button>
                <button onClick={handleSubmit} disabled={uploading || !form.label || (!selectedFile && !editing)} style={{
                  padding: '10px 20px', border: 'none', borderRadius: 8,
                  background: gradOrange, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#fff',
                  opacity: (uploading || !form.label || (!selectedFile && !editing)) ? 0.6 : 1,
                }}>
                  {uploading ? 'Uploading...' : editing ? 'Update' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      )}

      {/* Grid */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {mockups.map((m) => (
            <div key={m.id} className="mc" style={{
              background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: '#f3f4f6' }}>
                <img src={m.imageUrl} alt={m.label} className="mc-img"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{
                  position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4,
                }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: m.isActive ? 'rgba(16,185,129,0.9)' : 'rgba(156,163,175,0.9)',
                    color: '#fff',
                  }}>{m.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{m.label}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: '#fef3c7', color: '#92400e' }}>
                    {m.role.replace('_', ' ')}
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: '#dbeafe', color: '#1e40af' }}>
                    {m.category.replace('_', ' ')}
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500, background: '#e5e7eb', color: '#374151' }}>
                    #{m.order}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
                  <button onClick={() => openEdit(m)} style={{
                    flex: 1, padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: 6,
                    background: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#374151',
                  }}>Edit</button>
                  <button onClick={() => handleDelete(m.id)} style={{
                    flex: 1, padding: '6px 12px', border: '1px solid #fca5a5', borderRadius: 6,
                    background: '#fef2f2', fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#dc2626',
                  }}>Delete</button>
                </div>
              </div>
            </div>
          ))}

          {mockups.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
              <p style={{ fontSize: 15, margin: 0 }}>No mockups yet. Click "Add Mockup" to upload your first phone screenshot.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
