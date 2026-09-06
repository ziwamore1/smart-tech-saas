'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  Academic: '📚',
  Attendance: '✅',
  Finance: '💰',
  Communication: '📢',
  'AI Insights': '🤖',
  'System Notifications': '🔔',
};

export default function ParentNotificationsPage() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<string>('');

  const { data, isLoading } = useQuery<{ notifications: NotificationItem[]; unread: number }>({
    queryKey: ['parent-notifications-page', category],
    queryFn: async () => {
      const res = await notificationsApi.getNotifications({ limit: 50, ...(category ? { category } : {}) });
      const d = res.data;
      const notifications = d?.data?.notifications || d?.notifications || [];
      const unread = notifications.filter((n: NotificationItem) => !n.isRead).length;
      return { notifications, unread };
    },
    refetchInterval: 20000,
  });

  const { data: totals } = useQuery<{ notifications: NotificationItem[] }>({
    queryKey: ['parent-notifications-totals'],
    queryFn: async () => {
      const res = await notificationsApi.getNotifications({ limit: 100 });
      const d = res.data;
      return { notifications: d?.data?.notifications || d?.notifications || [] };
    },
  });

  const notifications = data?.notifications || [];
  const categories = [...new Set((totals?.notifications || []).map(n => n.category))];

  const markRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      queryClient.invalidateQueries({ queryKey: ['parent-notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['parent-notifications-totals'] });
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      queryClient.invalidateQueries({ queryKey: ['parent-notifications-page'] });
      queryClient.invalidateQueries({ queryKey: ['parent-notifications-totals'] });
    } catch { /* ignore */ }
  };

  return (
    <div className="px-4 py-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-500">School announcements, academic updates and alerts</p>
        </div>
        {data && data.unread > 0 && (
          <button
            onClick={markAllRead}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 active:scale-[0.98] transition-all"
          >
            Mark all read ({data.unread})
          </button>
        )}
      </div>

      {categories.length > 1 && (
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => setCategory('')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${!category ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            All
          </button>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${category === c ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
            >
              {CATEGORY_ICONS[c] || '🔔'} {c}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-20 text-gray-500">Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
          <span className="text-5xl">🔕</span>
          <p className="text-gray-500 mt-4">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => (
            <button
              key={n.id}
              onClick={() => !n.isRead && markRead(n.id)}
              className={`w-full text-left p-4 rounded-2xl border transition-all hover:shadow-sm active:scale-[0.99] ${n.isRead ? 'bg-white border-gray-100' : 'bg-indigo-50/60 border-indigo-200'}`}
            >
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 shrink-0 rounded-full bg-white border border-gray-100 flex items-center justify-center text-lg">
                  {CATEGORY_ICONS[n.category] || '🔔'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`font-semibold ${n.isRead ? 'text-gray-800' : 'text-gray-900'}`}>{n.title}</p>
                    {!n.isRead && <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />}
                  </div>
                  {n.body && <p className="text-sm text-gray-600 mt-1">{n.body}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${n.isRead ? 'bg-gray-100 text-gray-500' : 'bg-indigo-100 text-indigo-700'}`}>
                      {n.category}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}