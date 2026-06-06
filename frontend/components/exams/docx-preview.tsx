'use client';
import { useState, useRef, useEffect } from 'react';

interface DocxPreviewProps {
  file: File | string;
  title?: string;
  height?: string;
}

export default function DocxPreview({ file, title = 'Document Preview', height = '600px' }: DocxPreviewProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadDocx = async () => {
      try {
        setLoading(true);
        const mammoth = await import('mammoth');
        let arrayBuffer: ArrayBuffer;
        if (typeof file === 'string') {
          const resp = await fetch(file);
          arrayBuffer = await resp.arrayBuffer();
        } else {
          arrayBuffer = await file.arrayBuffer();
        }
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setHtml(result.value);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to render DOCX');
      } finally {
        setLoading(false);
      }
    };
    loadDocx();
  }, [file]);

  return (
    <div style={{ border: '1px solid #e8ddd0', borderRadius: '12px', overflow: 'hidden', background: '#fefcf9' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8ddd0', background: '#f5efe8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa fa-file-word" style={{ color: '#2563eb' }} /> {title}
        </span>
        {loading && <span style={{ fontSize: '12px', color: '#9ca3af' }}>Loading...</span>}
      </div>
      <div ref={containerRef} style={{ padding: '24px', height, overflowY: 'auto', fontSize: '14px', lineHeight: 1.6, color: '#374151' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#ef4444' }}>
            <i className="fa fa-exclamation-triangle" style={{ fontSize: '28px', marginBottom: '12px' }} />
            <p>{error}</p>
          </div>
        ) : (
          <div className="docx-preview" dangerouslySetInnerHTML={{ __html: html }}
            style={{ maxWidth: '100%', overflowX: 'auto' }} />
        )}
      </div>
      <style>{`
        .docx-preview table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        .docx-preview td, .docx-preview th { border: 1px solid #d1d5db; padding: 8px 12px; }
        .docx-preview img { max-width: 100%; }
        .docx-preview p { margin: 8px 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
