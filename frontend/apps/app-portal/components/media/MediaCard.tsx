'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import {
  File,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileType,
  Trash2,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';

export interface MediaItem {
  id: string;
  publicId: string;
  url: string;
  secureUrl: string;
  fileName: string;
  originalName: string;
  format: string;
  resourceType: string;
  bytes: number;
  width?: number;
  height?: number;
  folder: string;
  createdAt: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface MediaCardProps {
  item: MediaItem;
  onDelete?: (publicId: string) => void;
}

function getFileTypeIcon(resourceType: string, format: string) {
  if (resourceType === 'image') return FileImage;
  if (format === 'pdf') return FileText;
  if (['doc', 'docx'].includes(format)) return FileText;
  if (['xls', 'xlsx', 'csv'].includes(format)) return FileSpreadsheet;
  if (['ppt', 'pptx'].includes(format)) return FileType;
  if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(format)) return FileType;
  if (['mp3', 'wav', 'ogg', 'flac'].includes(format)) return FileType;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(format)) return FileType;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export default function MediaCard({ item, onDelete }: MediaCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isImage = item.resourceType === 'image';

  const FileIcon = getFileTypeIcon(item.resourceType, item.format);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(item.secureUrl || item.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      //
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await api.delete('/media', { data: { publicId: item.publicId } });
      onDelete?.(item.publicId);
    } catch {
      //
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md">
      <div className="aspect-[4/3] overflow-hidden bg-gray-100">
        {isImage ? (
          <img
            src={item.secureUrl || item.url}
            alt={item.originalName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FileIcon className="h-12 w-12 text-gray-400" />
          </div>
        )}
      </div>

      <div className="space-y-1.5 p-3">
        <p className="truncate text-sm font-medium text-gray-900" title={item.originalName}>
          {item.originalName}
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{formatFileSize(item.bytes)}</span>
          <span>&middot;</span>
          <span className="uppercase">{item.format}</span>
          <span>&middot;</span>
          <span>{formatDate(item.createdAt)}</span>
        </div>
        {item.folder && (
          <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
            {item.folder}
          </span>
        )}
      </div>

      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={handleCopyUrl}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-700 shadow transition-colors hover:bg-gray-100"
          title="Copy URL"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </button>
        <a
          href={item.secureUrl || item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-700 shadow transition-colors hover:bg-gray-100"
          title="Download"
        >
          <Download className="h-4 w-4" />
        </a>
        <button
          onClick={() => setShowConfirm(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-red-600 shadow transition-colors hover:bg-red-50"
          title="Delete"
        >
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>

      {showConfirm && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/95 p-4">
          <div className="text-center">
            <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" />
            <p className="mb-3 text-sm font-medium text-gray-900">Delete this file?</p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
