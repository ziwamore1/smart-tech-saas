'use client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface UploadZoneProps {
  onUpload: (files: File[]) => void;
  accept?: Record<string, string[]>;
  maxSize?: number;
  multiple?: boolean;
  label?: string;
}

const defaultAccept: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
};

export default function UploadZone({
  onUpload, accept = defaultAccept, maxSize = 10 * 1024 * 1024,
  multiple = false, label = 'Drag & drop files here',
}: UploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    onUpload(acceptedFiles);
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragReject, fileRejections } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
  });

  const acceptFormats = Object.values(accept).flat().join(', ');

  return (
    <div>
      <div {...getRootProps()} style={{
        border: `2px dashed ${isDragReject ? '#ef4444' : isDragActive ? '#ea6645' : '#d1d5db'}`,
        borderRadius: '12px', padding: '40px 24px', textAlign: 'center',
        background: isDragReject ? '#fef2f2' : isDragActive ? '#fff7ed' : '#f5efe8',
        cursor: 'pointer', transition: 'all 0.2s',
      }}>
        <input {...getInputProps()} />
        <div style={{ marginBottom: '12px' }}>
          {isDragReject ? (
            <i className="fa fa-exclamation-circle" style={{ fontSize: '40px', color: '#ef4444' }} />
          ) : (
            <i className="fa fa-cloud-upload-alt" style={{ fontSize: '40px', color: isDragActive ? '#ea6645' : '#9ca3af' }} />
          )}
        </div>
        <p style={{ fontSize: '14px', fontWeight: 500, color: isDragReject ? '#ef4444' : '#374151', margin: '0 0 4px' }}>
          {isDragReject ? 'File type not accepted' : isDragActive ? 'Drop files here' : label}
        </p>
        <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
          {acceptFormats} &middot; Max {Math.round(maxSize / 1024 / 1024)}MB
        </p>
      </div>
      {fileRejections.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          {fileRejections.map(({ file, errors }) => (
            <p key={file.name} style={{ fontSize: '12px', color: '#ef4444', margin: '2px 0' }}>
              {file.name}: {errors.map(e => e.message).join(', ')}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
