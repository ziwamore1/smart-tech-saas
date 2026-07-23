'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useIsPureSuperAdmin } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  HardDrive,
  FileImage,
  FolderOpen,
  Trash2,
  Search,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import FileUpload from '@/components/media/FileUpload';
import MediaGrid from '@/components/media/MediaGrid';
import type { MediaItem } from '@/components/media/MediaCard';

interface MediaStats {
  totalFiles: number;
  totalSize: number;
  byFolder: Record<string, number>;
}

const PAGE_LIMIT = 20;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function MediaPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const isPureSuperAdmin = useIsPureSuperAdmin();
  const router = useRouter();

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [folder, setFolder] = useState('');
  const [searchFolder, setSearchFolder] = useState('');
  const [orphaning, setOrphaning] = useState(false);
  const [folderSuggestions, setFolderSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const loadStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const res = await api.get('/media/stats');
      const data = res.data?.data || res.data;
      setStats(data);
      if (data?.byFolder) {
        setFolderSuggestions(Object.keys(data.byFolder).filter(Boolean));
      }
    } catch {
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadMedia = useCallback(async (p: number, f: string) => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, string | number> = { page: p, limit: PAGE_LIMIT };
      if (f) params.folder = f;
      const res = await api.get('/media', { params });
      const data = res.data?.data || res.data;
      const items = Array.isArray(data) ? data : data?.files || data?.items || [];
      setMediaItems(items);
      setTotalPages(data?.totalPages || data?.pagination?.totalPages || 1);
      setTotal(data?.total || data?.pagination?.total || items.length);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load media');
      setMediaItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadStats();
    }
  }, [isAuthenticated, loadStats]);

  useEffect(() => {
    if (isAuthenticated) {
      loadMedia(page, searchFolder);
    }
  }, [isAuthenticated, page, searchFolder, loadMedia]);

  const handleUploadComplete = () => {
    loadMedia(page, searchFolder);
    loadStats();
  };

  const handleDelete = (publicId: string) => {
    setMediaItems((prev) => prev.filter((i) => i.publicId !== publicId));
    loadStats();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearchFolder(folder);
  };

  const handleClearSearch = () => {
    setFolder('');
    setSearchFolder('');
    setPage(1);
  };

  const handleCleanupOrphaned = async () => {
    if (!confirm('Are you sure you want to delete all orphaned media files? This action cannot be undone.')) return;
    try {
      setOrphaning(true);
      await api.delete('/media/orphaned');
      loadMedia(page, searchFolder);
      loadStats();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to clean up orphaned files';
      setError(msg);
    } finally {
      setOrphaning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Media Manager</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload, browse, and manage your media files
        </p>
      </div>

      {!loadingStats && stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <FileImage className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.totalFiles}</p>
                <p className="text-xs text-gray-500">Total Files</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <HardDrive className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatBytes(stats.totalSize)}</p>
                <p className="text-xs text-gray-500">Storage Used</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <FolderOpen className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.byFolder ? Object.keys(stats.byFolder).length : 0}
                </p>
                <p className="text-xs text-gray-500">Folders</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Upload Files</h2>
        <FileUpload
          mode="multiple"
          folder={searchFolder}
          onUploadComplete={handleUploadComplete}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Files
            {total > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">({total} total)</span>
            )}
          </h2>
          <div className="flex items-center gap-3">
            <form onSubmit={handleSearch} className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="Filter by folder..."
                list="folder-suggestions"
                className="w-48 rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <datalist id="folder-suggestions">
                {folderSuggestions.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </form>
            {searchFolder && (
              <button
                onClick={handleClearSearch}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear filter
              </button>
            )}
            <button
              onClick={() => loadMedia(page, searchFolder)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            {isPureSuperAdmin && (
              <button
                onClick={handleCleanupOrphaned}
                disabled={orphaning}
                className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {orphaning ? 'Cleaning...' : 'Cleanup Orphaned'}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <MediaGrid
          items={mediaItems}
          isLoading={loading}
          onDelete={handleDelete}
          onPageChange={(p) => setPage(p)}
          pagination={{
            page,
            limit: PAGE_LIMIT,
            total,
            totalPages,
          }}
        />
      </div>
    </div>
  );
}
