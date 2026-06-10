'use client';

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Upload,
  X,
  File,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileType,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif', '.vbs', '.js', '.jar', '.dll', '.sh'];

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  response?: unknown;
}

interface FileUploadProps {
  mode?: 'single' | 'multiple';
  folder?: string;
  onUploadComplete?: (response: unknown) => void;
  className?: string;
  acceptedFileTypes?: string[];
}

function getFileIcon(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext || '')) return FileImage;
  if (['pdf'].includes(ext || '')) return FileText;
  if (['doc', 'docx'].includes(ext || '')) return FileText;
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return FileSpreadsheet;
  if (['ppt', 'pptx'].includes(ext || '')) return FileType;
  if (['mp4', 'avi', 'mov', 'wmv', 'mkv'].includes(ext || '')) return FileType;
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext || '')) return FileType;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) return FileType;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

function getBlockedExtensions(): string[] {
  return BLOCKED_EXTENSIONS;
}

export default function FileUpload({
  mode = 'multiple',
  folder = '',
  onUploadComplete,
  className,
  acceptedFileTypes,
}: FileUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      return `File type "${ext}" is not allowed`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" exceeds the 10MB size limit`;
    }
    if (acceptedFileTypes && acceptedFileTypes.length > 0) {
      const mimeMatch = acceptedFileTypes.some((t) => file.type.match(t));
      const extMatch = acceptedFileTypes.some((t) => ext === t.toLowerCase());
      if (!mimeMatch && !extMatch) {
        return `File type "${ext}" is not accepted`;
      }
    }
    return null;
  }, [acceptedFileTypes]);

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      setValidationError(null);
      const fileArray = Array.from(files);
      const validated: UploadingFile[] = [];
      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          setValidationError(error);
          continue;
        }
        validated.push({
          id: crypto.randomUUID(),
          file,
          progress: 0,
          status: 'pending',
        });
        if (mode === 'single') break;
      }
      if (validated.length > 0) {
        setUploadingFiles((prev) => (mode === 'single' ? validated : [...prev, ...validated]));
        validated.forEach((f) => uploadFile(f));
      }
    },
    [validateFile, mode]
  );

  const uploadFile = useCallback(
    async (uploadingFile: UploadingFile) => {
      const formData = new FormData();
      if (mode === 'multiple') {
        formData.append('files', uploadingFile.file);
      } else {
        formData.append('file', uploadingFile.file);
      }
      if (folder) {
        formData.append('folder', folder);
      }

      setUploadingFiles((prev) =>
        prev.map((f) => (f.id === uploadingFile.id ? { ...f, status: 'uploading' as const } : f))
      );

      try {
        const endpoint = mode === 'multiple' ? '/media/bulk-upload' : '/media/upload';
        const response = await api.post(endpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setUploadingFiles((prev) =>
              prev.map((f) => (f.id === uploadingFile.id ? { ...f, progress } : f))
            );
          },
        });
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === uploadingFile.id
              ? { ...f, status: 'success' as const, progress: 100, response: response.data }
              : f
          )
        );
        onUploadComplete?.(response.data);
      } catch (error: any) {
        const message = error?.response?.data?.message || error?.message || 'Upload failed';
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === uploadingFile.id ? { ...f, status: 'error' as const, error: message } : f
          )
        );
      }
    },
    [mode, folder, onUploadComplete]
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer.files?.length) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleFileSelect = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        processFiles(e.target.files);
        e.target.value = '';
      }
    },
    [processFiles]
  );

  const removeFile = useCallback((id: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setUploadingFiles((prev) => prev.filter((f) => f.status === 'uploading' || f.status === 'error'));
  }, []);

  return (
    <div className={cn('space-y-4', className)}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 transition-all',
          isDragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
        )}
      >
        <div
          className={cn(
            'mb-4 flex h-14 w-14 items-center justify-center rounded-full transition-colors',
            isDragOver ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
          )}
        >
          <Upload className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-gray-700">
          <span className="text-blue-600">Click to upload</span> or drag and drop
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {mode === 'single' ? 'Single file upload' : 'Multiple files'} &mdash; Max 10MB per file
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple={mode === 'multiple'}
          onChange={handleFileSelect}
          className="hidden"
          accept={acceptedFileTypes?.join(',')}
        />
      </div>

      {validationError && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {validationError}
        </div>
      )}

      {uploadingFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              {uploadingFiles.length} file{uploadingFiles.length > 1 ? 's' : ''}
            </p>
            <button
              onClick={clearCompleted}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear completed
            </button>
          </div>
          <div className="space-y-2">
            {uploadingFiles.map((f) => {
              const Icon = getFileIcon(f.file);
              const previewUrl = isImageFile(f.file) ? URL.createObjectURL(f.file) : null;
              return (
                <div
                  key={f.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
                    f.status === 'error' && 'border-red-200 bg-red-50',
                    f.status === 'success' && 'border-green-200 bg-green-50',
                    f.status === 'uploading' && 'border-blue-100 bg-blue-50',
                    f.status === 'pending' && 'border-gray-200 bg-white'
                  )}
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={f.file.name}
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      onLoad={() => URL.revokeObjectURL(previewUrl)}
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                      <Icon className="h-5 w-5 text-gray-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {f.file.name}
                    </p>
                    <p className="text-xs text-gray-500">{formatFileSize(f.file.size)}</p>
                    {f.status === 'uploading' && (
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${f.progress}%` }}
                        />
                      </div>
                    )}
                    {f.status === 'error' && f.error && (
                      <p className="mt-0.5 text-xs text-red-600">{f.error}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {f.status === 'uploading' && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    )}
                    {f.status === 'success' && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {f.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    {(f.status === 'pending' || f.status === 'error') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(f.id);
                        }}
                        className="ml-1 rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
