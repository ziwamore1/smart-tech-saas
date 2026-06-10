'use client';
import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PdfPreviewProps {
  file: string | File;
  title?: string;
}

export default function PdfPreview({ file, title = 'PDF Preview' }: PdfPreviewProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);

  const fileSrc = typeof file === 'string' ? file : undefined;
  const fileData = typeof file !== 'string' ? file : undefined;

  return (
    <div style={{ border: '1px solid #e8ddd0', borderRadius: '12px', overflow: 'hidden', background: '#fefcf9' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8ddd0', background: '#f5efe8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fa fa-file-pdf" style={{ color: '#dc2626' }} /> {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} style={{ padding: '4px 8px', border: '1px solid #e8ddd0', borderRadius: '4px', background: '#fefcf9', cursor: 'pointer', color: '#374151', fontSize: '12px' }}>-</button>
          <span style={{ fontSize: '12px', color: '#6b7280', minWidth: '40px', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2, s + 0.1))} style={{ padding: '4px 8px', border: '1px solid #e8ddd0', borderRadius: '4px', background: '#fefcf9', cursor: 'pointer', color: '#374151', fontSize: '12px' }}>+</button>
          <div style={{ width: '1px', height: '20px', background: '#e8ddd0' }} />
          <button onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1}
            style={{ padding: '4px 8px', border: '1px solid #e8ddd0', borderRadius: '4px', background: '#fefcf9', cursor: pageNumber <= 1 ? 'not-allowed' : 'pointer', color: pageNumber <= 1 ? '#d1d5db' : '#374151', fontSize: '12px' }}>
            <i className="fa fa-chevron-left" />
          </button>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>{pageNumber} / {numPages}</span>
          <button onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages}
            style={{ padding: '4px 8px', border: '1px solid #e8ddd0', borderRadius: '4px', background: '#fefcf9', cursor: pageNumber >= numPages ? 'not-allowed' : 'pointer', color: pageNumber >= numPages ? '#d1d5db' : '#374151', fontSize: '12px' }}>
            <i className="fa fa-chevron-right" />
          </button>
        </div>
      </div>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '400px', background: '#f3f4f6', overflow: 'auto' }}>
        <Document file={fileSrc || fileData} onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid #e8ddd0', borderTopColor: '#ea6645', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          }
          error={
            <div style={{ textAlign: 'center', padding: '48px', color: '#ef4444' }}>
              <i className="fa fa-exclamation-triangle" style={{ fontSize: '28px', marginBottom: '12px' }} />
              <p>Failed to load PDF</p>
            </div>
          }>
          <Page pageNumber={pageNumber} scale={scale} renderTextLayer renderAnnotationLayer
            width={Math.min(700, typeof window !== 'undefined' ? window.innerWidth - 80 : 700)} />
        </Document>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
