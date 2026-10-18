'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type Props = { title: string; fileName: string; download: () => Promise<any>; onClose: () => void };

export function FinancialDocumentViewer({ title, fileName, download, onClose }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    download().then((response) => {
      if (cancelled) return;
      const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: 'application/pdf' });
      objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);
    }).catch((e: any) => {
      if (!cancelled) setError(e?.response?.data?.message || e?.message || 'Failed to load PDF preview.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [download]);

  const print = () => { if (iframeRef.current?.contentWindow) { iframeRef.current.contentWindow.focus(); iframeRef.current.contentWindow.print(); } else toast.error('The PDF is still loading.'); };
  const open = () => { if (pdfUrl && !window.open(pdfUrl, '_blank', 'noopener,noreferrer')) toast.error('Allow pop-ups to view this document.'); };
  const save = () => { if (!pdfUrl) return; const link = document.createElement('a'); link.href = pdfUrl; link.download = fileName; link.click(); };

  return <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#111827', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid #374151' }}>
      <div style={{ color: '#fff', fontWeight: 700 }}><i className="fa fa-file-pdf" style={{ color: '#fb7185', marginRight: 8 }} />{title}<div style={{ color: '#9ca3af', fontSize: 12, fontWeight: 400, marginTop: 3 }}>{fileName}</div></div>
      <div style={{ display: 'flex', gap: 8 }}><button style={viewerButton} disabled={!pdfUrl} onClick={open}><i className="fa fa-external-link-alt" /> Open</button><button style={viewerButton} disabled={!pdfUrl} onClick={print}><i className="fa fa-print" /> Print</button><button style={viewerButton} disabled={!pdfUrl} onClick={save}><i className="fa fa-download" /> Download</button><button style={closeButton} onClick={onClose}><i className="fa fa-times" /></button></div>
    </div>
    <div style={{ position: 'relative', flex: 1, background: '#374151' }}>{loading && <div style={viewerMessage}>Loading PDF…</div>}{error && <div style={viewerMessage}><span style={{ color: '#fca5a5' }}>{error}</span></div>}{pdfUrl && <iframe ref={iframeRef} src={pdfUrl} title={title} style={{ width: '100%', height: '100%', border: 0, background: '#fff' }} />}</div>
  </div>;
}

const viewerButton: React.CSSProperties = { border: 0, borderRadius: 8, padding: '8px 12px', background: '#4b5563', color: '#fff', cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' };
const closeButton: React.CSSProperties = { ...viewerButton, background: '#991b1b', width: 34, justifyContent: 'center' };
const viewerMessage: React.CSSProperties = { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', fontSize: 16 };
