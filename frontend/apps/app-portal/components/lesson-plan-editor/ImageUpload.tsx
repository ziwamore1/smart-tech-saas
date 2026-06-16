'use client';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { api } from '../../lib/api';

interface ImageUploadProps {
  onUploaded: (url: string) => void;
}

export default function ImageUpload({ onUploaded }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'smarttech/lesson-plans');

      const res = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = res.data?.data?.url || res.data?.url || res.data?.secureUrl;
      if (url) {
        onUploaded(url);
      } else {
        setError('Upload succeeded but no URL returned');
      }
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [onUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'] },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? '#ea6645' : '#D1D5DB'}`,
          borderRadius: '8px', padding: '20px', textAlign: 'center', cursor: 'pointer',
          background: isDragActive ? '#FEF2ED' : '#F9FAFB', transition: 'all 0.2s',
        }}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div>
            <i className="fa fa-spinner fa-spin" style={{ fontSize: '24px', color: '#ea6645' }} />
            <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '8px' }}>Uploading...</p>
          </div>
        ) : (
          <div>
            <i className="fa fa-cloud-upload" style={{ fontSize: '32px', color: isDragActive ? '#ea6645' : '#9CA3AF' }} />
            <p style={{ fontSize: '14px', color: '#374151', fontWeight: 500, marginTop: '8px' }}>
              {isDragActive ? 'Drop image here' : 'Drag & drop or click to upload'}
            </p>
            <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>PNG, JPG, GIF, WebP, SVG (max 10MB)</p>
          </div>
        )}
      </div>
      {error && <p style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>{error}</p>}
    </div>
  );
}
