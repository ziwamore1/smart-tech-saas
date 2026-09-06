'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { libraryApi } from '@/lib/api';

interface LibraryItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  fileType?: string;
  fileName?: string;
  fileUrl?: string;
  coverUrl?: string;
  author?: string;
  size?: number | null;
  createdAt?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  Textbook: '📘',
  Reference: '📖',
  PastPaper: '📝',
  Worksheet: '📋',
  'Study Guide': '📗',
  Story: '📙',
  Magazine: '📰',
  Other: '📁',
};

function fileTypeLabel(item: LibraryItem): string {
  if (item.fileType) return item.fileType;
  const fileName = item.fileName || item.fileUrl || '';
  if (!fileName) return 'File';
  const ext = fileName.split('.').pop() || '';
  return ext.toUpperCase();
}

export default function StudentLibraryPage() {
  const [category, setCategory] = useState<string>('All');

  const { data, isLoading } = useQuery({
    queryKey: ['library-student'],
    queryFn: () => libraryApi.getAll().then(r => r.data?.data || r.data || []),
    retry: false,
  });

  const items = (Array.isArray(data) ? data : []) as LibraryItem[];

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))],
    [items],
  );

  const filtered = category === 'All' ? items : items.filter(i => i.category === category);

  const download = async (item: LibraryItem) => {
    try {
      if (item.fileUrl) {
        window.open(item.fileUrl, '_blank');
        return;
      }
      const res = await libraryApi.downloadFile(item.id);
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = item.fileName || `${item.title}.download`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Failed to open resource.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/student" className="hover:text-indigo-600">Dashboard</Link>
            <span>/</span>
            <span>Library</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Digital Library</h1>
          <p className="text-gray-500 mt-1">Browse learning resources provided by your school</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              category === c ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {CATEGORY_ICONS[c] || '📁'} {c}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-500">Loading library...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <span className="text-5xl">📚</span>
          <p className="text-gray-500 mt-4">No resources available in this category</p>
          <p className="text-sm text-gray-400 mt-1">Resources will appear here once your school adds them.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-32 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <span className="text-5xl">{CATEGORY_ICONS[item.category] || '📁'}</span>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{item.category}</span>
                  <span className="text-xs text-gray-400">{fileTypeLabel(item)}</span>
                </div>
                <h3 className="font-semibold text-gray-900 leading-snug">{item.title}</h3>
                {item.author && <p className="text-sm text-gray-500 mt-1">{item.author}</p>}
                {item.description && <p className="text-sm text-gray-500 mt-2 line-clamp-2">{item.description}</p>}
                <button
                  onClick={() => download(item)}
                  className="mt-4 w-full px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  Open / Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
