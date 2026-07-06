'use client';

import { useState, useRef, useCallback } from 'react';
import { intelligenceApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Paperclip, X, File, FileImage, FileText, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AttachedFile {
  id: string;
  file: File;
  status: 'uploading' | 'success' | 'error';
  progress: number;
  url?: string;
  error?: string;
}

interface FileAttachmentProps {
  sessionId?: string;
  studentId: string;
  onFilesUploaded: (urls: string[]) => void;
  disabled?: boolean;
}

function getIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (mimeType === 'application/pdf') return FileText;
  return File;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export default function FileAttachment({ sessionId, studentId, onFilesUploaded, disabled }: FileAttachmentProps) {
  const [attached, setAttached] = useState<AttachedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (item: AttachedFile) => {
    setAttached(prev => prev.map(f => f.id === item.id ? { ...f, status: 'uploading' } : f));
    try {
      const res = await intelligenceApi.uploadTutorFile(item.file, sessionId, studentId, (pct) => {
        setAttached(prev => prev.map(f => f.id === item.id ? { ...f, progress: pct } : f));
      });
      const data = res.data?.data || res.data;
      const url = data.secureUrl || data.url;
      setAttached(prev => prev.map(f => f.id === item.id ? { ...f, status: 'success', progress: 100, url } : f));
      onFilesUploaded([url]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Upload failed';
      setAttached(prev => prev.map(f => f.id === item.id ? { ...f, status: 'error', error: msg } : f));
    }
  }, [sessionId, studentId, onFilesUploaded]);

  const handleSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newItems: AttachedFile[] = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'uploading' as const,
      progress: 0,
    }));
    setAttached(prev => [...prev, ...newItems]);
    newItems.forEach(uploadFile);
    if (inputRef.current) inputRef.current.value = '';
  }, [uploadFile]);

  const removeFile = useCallback((id: string) => {
    setAttached(prev => prev.filter(f => f.id !== id));
  }, []);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleSelect}
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv"
      />

      {attached.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 flex flex-wrap gap-2">
          {attached.map(item => {
            const Icon = getIcon(item.file.type);
            const isImage = item.file.type.startsWith('image/');
            const previewUrl = isImage ? URL.createObjectURL(item.file) : null;
            return (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs shadow-sm',
                  item.status === 'error' && 'border-red-200 bg-red-50',
                  item.status === 'success' && 'border-green-200 bg-green-50',
                  item.status === 'uploading' && 'border-blue-100 bg-blue-50',
                )}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="h-8 w-8 rounded object-cover" onLoad={() => URL.revokeObjectURL(previewUrl!)} />
                ) : (
                  <Icon className="h-4 w-4 shrink-0 text-gray-500" />
                )}
                <div className="min-w-0 max-w-[120px]">
                  <p className="truncate font-medium text-gray-900">{item.file.name}</p>
                  {item.status === 'uploading' && (
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                  {item.status === 'error' && <p className="text-red-600">{item.error}</p>}
                  {item.status === 'success' && <p className="text-green-600">{formatSize(item.file.size)}</p>}
                </div>
                <button onClick={() => removeFile(item.id)} className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        title="Attach file"
      >
        <Paperclip className="h-5 w-5" />
      </button>
    </div>
  );
}
