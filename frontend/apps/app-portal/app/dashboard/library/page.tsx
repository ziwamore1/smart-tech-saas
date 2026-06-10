'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { libraryApi } from '@/lib/api';

interface LibraryItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  { value: 'textbook', label: 'Textbooks', icon: 'fa-book', color: '#3b82f6' },
  { value: 'syllabus', label: 'Syllabus', icon: 'fa-list-alt', color: '#8b5cf6' },
  { value: 'guide', label: 'Teacher Guides', icon: 'fa-chalkboard-teacher', color: '#10b981' },
  { value: 'exam', label: 'Past Papers', icon: 'fa-file-alt', color: '#ef4444' },
  { value: 'lesson', label: 'Lesson Notes', icon: 'fa-sticky-note', color: '#f59e0b' },
  { value: 'resource', label: 'Resources', icon: 'fa-folder', color: '#6b7280' },
];

export default function LibraryPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [documents, setDocuments] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<LibraryItem | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<LibraryItem | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [readTime, setReadTime] = useState(0);
  const [pagesViewed, setPagesViewed] = useState<string[]>([]);
  const readingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [newDoc, setNewDoc] = useState({
    title: '',
    description: '',
    category: 'resource',
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadDocuments();
    }
  }, [isAuthenticated]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await libraryApi.getAll();
      setDocuments(response.data?.data || response.data || []);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newDoc.title.trim()) return;
    
    try {
      const response = await libraryApi.create(newDoc);
      setDocuments([...documents, response.data]);
      setShowAddModal(false);
      setNewDoc({ title: '', description: '', category: 'resource' });
    } catch (error) {
      console.error('Failed to create document:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await libraryApi.delete(id);
      setDocuments(documents.filter(d => d.id !== id));
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const handleFileUpload = async (docId: string, file: File) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      
      await libraryApi.uploadFile(docId, formData);
      await loadDocuments();
    } catch (error) {
      console.error('Failed to upload file:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: LibraryItem) => {
    if (!doc.fileUrl) return;
    
    try {
      setDownloading(doc.id);
      const response = await libraryApi.downloadFile(doc.id);
      const ext = doc.fileUrl.split('.').pop() || 'pdf';
      const filename = `${doc.title}.${ext}`;
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download:', error);
    } finally {
      setDownloading(null);
    }
  };

  const handleView = (doc: LibraryItem) => {
    if (!doc.fileUrl) return;
    setViewingDoc(doc);
    setReadTime(0);
    setPagesViewed([]);
    
    if (readingTimerRef.current) {
      clearInterval(readingTimerRef.current);
    }
    readingTimerRef.current = setInterval(() => {
      setReadTime(prev => prev + 1);
    }, 1000);
  };

  const handleCloseViewer = async () => {
    if (readingTimerRef.current) {
      clearInterval(readingTimerRef.current);
      readingTimerRef.current = null;
    }

    if (viewingDoc && readTime > 0) {
      try {
        await libraryApi.logReadingSession(viewingDoc.id, {
          durationSeconds: readTime,
          pagesViewed: pagesViewed,
          completedAt: new Date().toISOString(),
        });
      } catch {
        // Backend endpoint not implemented yet - silent fail for now
      }
    }

    setViewingDoc(null);
    setReadTime(0);
    setPagesViewed([]);
  };

  const trackPageView = useCallback((pageNum: string) => {
    setPagesViewed(prev => {
      if (!prev.includes(pageNum)) {
        return [...prev, pageNum];
      }
      return prev;
    });
  }, []);

  const getViewerUrl = () => {
    if (!viewingDoc?.fileUrl) return '';
    const baseUrl = viewingDoc.fileUrl.startsWith('http') ? '' : 'http://localhost:3001';
    return `${baseUrl}${viewingDoc.fileUrl}`;
  };

  const filteredDocs = documents.filter(doc => {
    const title = doc.title || '';
    const desc = doc.description || '';
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryInfo = (category: string) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[CATEGORIES.length - 1];
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <style>{`
        .doc-card { transition: all 0.3s ease; }
        .doc-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.1); }
        .btn-primary { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; transition: all 0.2s; }
        .btn-primary:hover { background: linear-gradient(135deg, #2563eb, #1d4ed8); }
        .btn-green { background: linear-gradient(135deg, #10b981, #059669); color: white; }
        .btn-green:hover { background: linear-gradient(135deg, #059669, #047857); }
        .btn-red { background: '#fef2f2'; color: '#dc2626'; }
        .btn-red:hover { background: '#fee2e2'; }
        input, select, textarea { border: '1px solid #e8ddd0; border-radius: 8px; padding: 12px; width: 100%; font-size: 14px; transition: all 0.2s; box-sizing: border-box; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
            <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa fa-book-open" style={{ color: 'white', fontSize: '18px' }}></i>
            </div>
            Digital Library
          </h1>
          <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>Upload and manage school documents, textbooks, and learning materials</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: '600', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}
        >
          <i className="fa fa-plus"></i> Add Document
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <div style={{ flex: '1 1 200px', minWidth: '200px' }}>
          <div style={{ position: 'relative' }}>
            <i className="fa fa-search" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}></i>
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '40px', boxSizing: 'border-box' }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedCategory('all')}
            style={{ padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: '1px solid #e8ddd0', transition: 'all 0.2s',
              background: selectedCategory === 'all' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'white',
              color: selectedCategory === 'all' ? 'white' : '#4b5563' }}
          >
            <i className="fa fa-folder mr-2"></i>All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              style={{ padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: '1px solid #e8ddd0', transition: 'all 0.2s',
                background: selectedCategory === cat.value ? `linear-gradient(135deg, ${cat.color}, ${cat.color}dd)` : 'white',
                color: selectedCategory === cat.value ? 'white' : '#4b5563' }}
            >
              <i className={`fa ${cat.icon} mr-2`}></i>{cat.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {filteredDocs.map(doc => {
          const catInfo = getCategoryInfo(doc.category);
          return (
            <div
              key={doc.id}
              className="doc-card"
              style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ width: '48px', height: '48px', background: `${catInfo.color}15`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className={`fa ${catInfo.icon}`} style={{ color: catInfo.color, fontSize: '20px' }}></i>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: `${catInfo.color}15`, color: catInfo.color, textTransform: 'capitalize' }}>
                  {doc.category}
                </span>
              </div>
              
              <h3 style={{ fontWeight: '700', color: '#111827', marginBottom: '8px', fontSize: '16px' }}>{doc.title}</h3>
              {doc.description && (
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{doc.description}</p>
              )}
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>
                {doc.fileSize && <span>{formatFileSize(doc.fileSize)}</span>}
                <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                {!doc.fileUrl ? (
                  <label style={{ flex: '1', padding: '10px 12px', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <i className="fa fa-upload"></i>
                    {uploading ? 'Uploading...' : 'Upload File'}
                    <input
                      type="file"
                      style={{ display: 'none' }}
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(doc.id, e.target.files[0])}
                      disabled={uploading}
                    />
                  </label>
                ) : (
                  <>
                    <button
                      onClick={() => handleView(doc)}
                      style={{ flex: '1', padding: '10px 12px', background: '#f0fdf4', color: '#059669', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', border: '1px solid #bbf7d0' }}
                    >
                      <i className="fa fa-eye mr-2"></i>
                      View
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={downloading === doc.id}
                      style={{ flex: '1', padding: '10px 12px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: downloading === doc.id ? 'not-allowed' : 'pointer', opacity: downloading === doc.id ? 0.7 : 1 }}
                    >
                      <i className={`fa ${downloading === doc.id ? 'fa-spinner fa-spin' : 'fa-download'} mr-2`}></i>
                      Download
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDelete(doc.id)}
                  style={{ padding: '10px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                >
                  <i className="fa fa-trash"></i>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredDocs.length === 0 && (
        <div style={{ background: '#fefcf9', borderRadius: '16px', border: '1px solid #f3f4f6', padding: '48px', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', margin: '0 auto 16px', background: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa fa-book-open" style={{ color: '#9ca3af', fontSize: '32px' }}></i>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>No Documents Found</h3>
          <p style={{ color: '#6b7280', marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px' }}>
            {searchQuery || selectedCategory !== 'all'
              ? 'No documents match your filters. Try adjusting your search.'
              : 'Start by adding documents to your library for teachers and students to access.'}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}
          >
            <i className="fa fa-plus"></i> Add First Document
          </button>
        </div>
      )}

      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }} onClick={() => setShowAddModal(false)}>
          <div style={{ background: '#fefcf9', borderRadius: '16px', padding: '24px', maxWidth: '480px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: 0 }}>Add Document</h2>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '4px' }}>
                <i className="fa fa-times" style={{ fontSize: '20px' }}></i>
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Title *</label>
                <input
                  type="text"
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  placeholder="e.g., Grade 10 Mathematics Syllabus"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Category</label>
                <select
                  value={newDoc.category}
                  onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value })}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Description</label>
                <textarea
                  value={newDoc.description}
                  onChange={(e) => setNewDoc({ ...newDoc, description: e.target.value })}
                  rows={3}
                  placeholder="Optional description..."
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ flex: '1', padding: '12px', border: '1px solid #e8ddd0', color: '#374151', background: '#fefcf9', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newDoc.title.trim()}
                style={{ flex: '1', padding: '12px', background: newDoc.title.trim() ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : '#9ca3af', color: 'white', border: 'none', borderRadius: '10px', cursor: newDoc.title.trim() ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '600' }}
              >
                Create Document
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingDoc && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#1f2937' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <i className="fa fa-file-alt" style={{ color: 'white', fontSize: '24px' }}></i>
                <div>
                  <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>{viewingDoc.title}</h3>
                  <p style={{ color: '#9ca3af', fontSize: '13px', margin: '4px 0 0' }}>Read-only mode • {Math.floor(readTime / 60)}:{(readTime % 60).toString().padStart(2, '0')} read</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', color: '#9ca3af', fontSize: '13px' }}>
                  <span><i className="fa fa-clock-o mr-1"></i> {Math.floor(readTime / 60)}:{(readTime % 60).toString().padStart(2, '0')}</span>
                  <span><i className="fa fa-file mr-1"></i> {pagesViewed.length} pages</span>
                </div>
                <button
                  onClick={() => handleDownload(viewingDoc)}
                  style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <i className="fa fa-download"></i> Download
                </button>
                <button
                  onClick={handleCloseViewer}
                  style={{ padding: '10px 20px', background: '#374151', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
                >
                  <i className="fa fa-times mr-2"></i> Close
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '24px', background: '#111827' }}>
              {viewingDoc.fileUrl ? (
                viewingDoc.fileUrl.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={getViewerUrl()}
                    style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px' }}
                    title={viewingDoc.title}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
                    <div style={{ textAlign: 'center' }}>
                      <i className="fa fa-file" style={{ fontSize: '64px', marginBottom: '16px' }}></i>
                      <p style={{ fontSize: '18px' }}>Preview not available for this file type</p>
                      <p style={{ fontSize: '14px', marginTop: '8px' }}>Click Download to view the file</p>
                    </div>
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>
                  <div style={{ textAlign: 'center' }}>
                    <i className="fa fa-upload" style={{ fontSize: '64px', marginBottom: '16px' }}></i>
                    <p style={{ fontSize: '18px' }}>No file uploaded yet</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}