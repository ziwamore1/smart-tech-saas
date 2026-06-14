'use client';

import { useState, useEffect } from 'react';
import { systemCommunicationApi } from '@/lib/api';

const categories = [
  'All', 'Student Registration', 'Teacher Registration', 'Parent Registration',
  'Password Recovery', 'Fee Reminder', 'Attendance Alert', 'Exam Results',
  'School Announcement', 'System Maintenance',
] as const;

const typeIcons: Record<string, string> = {
  Email: 'fa-envelope',
  SMS: 'fa-comment-dots',
  WhatsApp: 'fa-whatsapp',
  Push: 'fa-bell',
  InApp: 'fa-mobile-alt',
};

const typeColors: Record<string, string> = {
  Email: '#2563eb',
  SMS: '#d97706',
  WhatsApp: '#059669',
  Push: '#8b5cf6',
  InApp: '#14b8a6',
};

const typeBg: Record<string, string> = {
  Email: '#dbeafe',
  SMS: '#fef3c7',
  WhatsApp: '#d1fae5',
  Push: '#f5f3ff',
  InApp: '#ccfbf1',
};

export default function TemplatesPage() {
  const [activeCat, setActiveCat] = useState('All');
  const [templates, setTemplates] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<string>(categories[1]);
  const [formType, setFormType] = useState('Email');
  const [formSubject, setFormSubject] = useState('');
  const [formMessage, setFormMessage] = useState('');

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await systemCommunicationApi.getTemplates();
      const body = res.data?.statusCode ? res.data.data : res.data;
      setTemplates(Array.isArray(body) ? body : []);
    } catch (err) {
      console.error('Failed to load templates', err);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const filtered = activeCat === 'All'
    ? templates
    : templates.filter((t) => t.category === activeCat);

  const openEdit = (tpl: any) => {
    setEditingTemplate(tpl);
    setFormName(tpl.name || '');
    setFormCategory(tpl.category || categories[1]);
    setFormType(tpl.type || 'Email');
    setFormSubject(tpl.subject || '');
    setFormMessage(tpl.preview || tpl.message || '');
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormCategory(categories[1]);
    setFormType('Email');
    setFormSubject('');
    setFormMessage('');
    setShowModal(true);
  };

  const handleSave = async () => {
    const data = {
      name: formName,
      category: formCategory,
      type: formType,
      subject: formSubject || undefined,
      message: formMessage,
    };

    try {
      setSaving(true);
      if (editingTemplate?.id) {
        await systemCommunicationApi.updateTemplate(editingTemplate.id, data);
      } else {
        await systemCommunicationApi.createTemplate(data);
      }
      setShowModal(false);
      await loadTemplates();
    } catch (err) {
      console.error('Failed to save template', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .tpl-card { transition: all 0.2s ease; cursor: pointer; }
        .tpl-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .cat-btn { transition: all 0.2s ease; cursor: pointer; }
        .cat-btn:hover { opacity: 0.85; }
        .modal-overlay { animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #f97316, #ea580c)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-file-alt" style={{ fontSize: '20px', color: 'white' }}></i>
            </div>
            Communication Templates
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 0 56px' }}>Manage message templates for all communication channels</p>
        </div>
        <button onClick={openCreate} style={{
          padding: '12px 20px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white',
          borderRadius: '10px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(249,115,22,0.3)',
        }}>
          <i className="fa fa-plus"></i> Create Template
        </button>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            className="cat-btn"
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              border: activeCat === cat ? 'none' : '1px solid #e8ddd0',
              background: activeCat === cat ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#fefcf9',
              color: activeCat === cat ? 'white' : '#6b7280',
              boxShadow: activeCat === cat ? '0 4px 12px rgba(249,115,22,0.25)' : 'none',
            }}
          >
            {cat === 'All' ? cat : <><i className="fa fa-tag" style={{ marginRight: '6px', fontSize: '11px' }}></i>{cat}</>}
          </button>
        ))}
      </div>

      {/* Template Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
        {loading ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
            <i className="fa fa-spinner fa-pulse" style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}></i>
            Loading templates...
          </div>
        ) : filtered.map((tpl) => (
          <div
            key={tpl.id}
            className="tpl-card"
            onClick={() => openEdit(tpl)}
            style={{ background: '#fefcf9', borderRadius: '14px', padding: '20px', border: '1px solid #e8ddd0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', background: typeBg[tpl.type] || '#f3f4f6', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fa ${typeIcons[tpl.type] || 'fa-file'}`} style={{ fontSize: '18px', color: typeColors[tpl.type] || '#6b7280' }}></i>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#1f2937' }}>{tpl.name}</div>
                <div style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: '#f5efe8', color: '#6b7280' }}>{tpl.category}</span>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, background: typeBg[tpl.type] || '#f3f4f6', color: typeColors[tpl.type] || '#6b7280' }}>{tpl.type}</span>
                </div>
              </div>
              <i className="fa fa-chevron-right" style={{ fontSize: '12px', color: '#d1d5db' }}></i>
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.5, background: '#f5efe8', padding: '12px', borderRadius: '8px', fontStyle: 'italic' }}>
              {(tpl.preview || tpl.message || '').length > 120 ? (tpl.preview || tpl.message || '').substring(0, 120) + '...' : (tpl.preview || tpl.message || '')}
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
              {((tpl.preview || tpl.message || '').match(/\{[a-zA-Z]+\}/g) || []).slice(0, 3).map((v: string) => (
                <span key={v} style={{ padding: '2px 8px', background: '#fef3c7', color: '#d97706', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>{v}</span>
              ))}
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: '#9ca3af' }}>
            <i className="fa fa-file-alt" style={{ fontSize: '40px', display: 'block', marginBottom: '12px' }}></i>
            No templates found in this category
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      {showModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
        }} onClick={() => setShowModal(false)}>
          <div style={{
            background: '#fdfaf7', borderRadius: '20px', padding: '32px', width: '600px', maxWidth: '95vw',
            maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1f2937', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className={`fa ${editingTemplate?.id ? 'fa-edit' : 'fa-plus'}`} style={{ color: '#f97316' }}></i>
                {editingTemplate?.id ? 'Edit Template' : 'Create Template'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ width: '32px', height: '32px', border: 'none', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa fa-times" style={{ fontSize: '14px', color: '#6b7280' }}></i>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Template Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Welcome Student"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9' }}
                  >
                    {categories.filter(c => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', background: '#fefcf9' }}
                  >
                    <option value="Email">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Push">Push Notification</option>
                    <option value="InApp">In-App Notification</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>Subject</label>
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="Email subject line (for email templates)"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px', display: 'block' }}>
                  Message <span style={{ fontWeight: 400, color: '#9ca3af' }}>— Use variables like {'{studentName}'}, {'{schoolName}'}, {'{term}'}</span>
                </label>
                <textarea
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  rows={6}
                  placeholder="Dear {studentName}, Welcome to {schoolName}!..."
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ background: '#f5efe8', borderRadius: '10px', padding: '12px 16px' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>Available Variables</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['{studentName}', '{teacherName}', '{parentName}', '{schoolName}', '{username}', '{email}', '{password}', '{amount}', '{term}', '{date}', '{dueDate}', '{announcementText}', '{paymentLink}'].map((v) => (
                    <span key={v} style={{ padding: '3px 8px', background: '#fefcf9', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', color: '#d97706', border: '1px solid #e8ddd0', cursor: 'pointer' }} onClick={() => setFormMessage((prev) => prev + v)}>{v}</span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid #e8ddd0' }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '12px 20px', background: '#f3f4f6', color: '#6b7280', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} style={{
                  padding: '12px 24px', background: saving ? '#d1d5db' : 'linear-gradient(135deg, #f97316, #ea580c)',
                  color: 'white', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: saving ? 'none' : '0 4px 12px rgba(249,115,22,0.3)',
                }}>
                  <i className={`fa ${saving ? 'fa-spinner fa-pulse' : 'fa-save'}`} style={{ marginRight: '6px' }}></i> {saving ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
