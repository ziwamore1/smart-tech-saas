'use client';

import { cn } from '@/lib/utils';
import { FolderOpen } from 'lucide-react';
import MediaCard, { type MediaItem } from './MediaCard';

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface MediaGridProps {
  items: MediaItem[];
  isLoading?: boolean;
  pagination?: PaginationData;
  onPageChange?: (page: number) => void;
  onDelete?: (publicId: string) => void;
  className?: string;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="aspect-[4/3] rounded-t-xl bg-gray-200" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-3 w-1/2 rounded bg-gray-100" />
        <div className="h-3 w-1/3 rounded bg-gray-100" />
      </div>
    </div>
  );
}

export default function MediaGrid({
  items,
  isLoading,
  pagination,
  onPageChange,
  onDelete,
  className,
}: MediaGridProps) {
  if (isLoading) {
    return (
      <div className={cn('grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4', className)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <FolderOpen className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">No files found</h3>
        <p className="mt-1 text-sm text-gray-500">
          Upload files to see them here or adjust your search filters.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <MediaCard key={item.publicId || item.id} item={item} onDelete={onDelete} />
        ))}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => onPageChange?.(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(pagination.totalPages, 5) }).map((_, i) => {
              let pageNum: number;
              const total = pagination.totalPages;
              const current = pagination.page;
              if (total <= 5) {
                pageNum = i + 1;
              } else if (current <= 3) {
                pageNum = i + 1;
              } else if (current >= total - 2) {
                pageNum = total - 4 + i;
              } else {
                pageNum = current - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange?.(pageNum)}
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors',
                    pageNum === pagination.page
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => onPageChange?.(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
