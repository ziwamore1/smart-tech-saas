'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { messagesApi, parentApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface Conversation {
  id: string;
  lastMessage?: string | null;
  lastMessageAt: string;
  unreadCount: number;
  participants: string[];
  participantDetails: { id: string; name: string }[];
}

interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  isRead: boolean;
  createdAt: string;
  senderName?: string;
}

interface ChildInfo {
  id: string;
  firstName: string;
  lastName: string;
  class?: string;
  className?: string;
  classTeacher?: { userId: string; name: string } | null;
}

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function ParentMessagesPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-gray-500">Loading messages...</div>}>
      <ParentMessagesCore />
    </Suspense>
  );
}

function ParentMessagesCore() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [composer, setComposer] = useState<{ toUserId: string; name: string; context: string } | null>(null);
  const [composerText, setComposerText] = useState('');

  const myId = user?.id || '';

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['messages-conversations'],
    queryFn: () => messagesApi.getConversations().then(r => r.data?.data || r.data || []),
    refetchInterval: 20000,
  });

  const { data: children = [] } = useQuery<ChildInfo[]>({
    queryKey: ['parent-children-messages'],
    queryFn: () => parentApi.getChildren().then(r => r.data?.data || r.data || []),
  });

  const { data: thread, isLoading: threadLoading } = useQuery<{ id: string; messages: ChatMessage[]; participants: string[] }>({
    queryKey: ['messages-thread', activeConversationId],
    queryFn: () => activeConversationId
      ? messagesApi.getConversation(activeConversationId).then(r => r.data?.data || r.data)
      : Promise.resolve(null),
    enabled: !!activeConversationId,
    refetchInterval: 15000,
  });

  const { data: unreadRes } = useQuery({
    queryKey: ['messages-unread-parent'],
    queryFn: () => messagesApi.getUnreadCount().then(r => r.data),
    refetchInterval: 20000,
  });

  useEffect(() => {
    if (activeConversationId) {
      messagesApi.markAsRead(activeConversationId).then(() => {
        queryClient.invalidateQueries({ queryKey: ['messages-conversations'] });
        queryClient.invalidateQueries({ queryKey: ['messages-unread-parent'] });
      }).catch(() => {});
    }
  }, [activeConversationId, queryClient]);

  const teacherContacts = useMemo(() => {
    const out: { userId: string; name: string; child: string; className: string }[] = [];
    (children as ChildInfo[]).forEach(c => {
      if (c.classTeacher?.userId && c.classTeacher?.name) {
        out.push({
          userId: c.classTeacher.userId,
          name: c.classTeacher.name,
          child: `${c.firstName} ${c.lastName}`.trim(),
          className: c.class || c.className || 'the class',
        });
      }
    });
    return out;
  }, [children]);

  const contactName = (conv?: Conversation) => {
    if (!conv) return '';
    const others = (conv.participantDetails || []).filter(p => p.id !== myId);
    if (others.length > 0) return others.map(o => o.name).join(', ');
    return (conv.participantDetails || []).map(p => p.name).join(', ') || 'Unknown';
  };

  const sendMessage = async (content: string) => {
    if (!activeConversationId || !content.trim() || sending) return;
    setSending(true);
    try {
      await messagesApi.sendMessage(activeConversationId, content.trim());
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['messages-thread', activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ['messages-conversations'] });
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const startConversation = async (toUserId: string, initialMessage: string) => {
    if (!toUserId || !initialMessage.trim()) return;
    setSending(true);
    try {
      const res = await messagesApi.createConversation([myId, toUserId], initialMessage.trim());
      const conv = res.data?.data || res.data;
      queryClient.invalidateQueries({ queryKey: ['messages-conversations'] });
      if (conv?.id) {
        setActiveConversationId(conv.id);
      }
      setComposer(null);
      setComposerText('');
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to start conversation.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const to = searchParams.get('to');
    const name = searchParams.get('name');
    const context = searchParams.get('child') || 'your child\'s class';
    if (to && name) {
      setComposer({ toUserId: to, name, context });
      const q = new URLSearchParams(searchParams.toString());
      q.delete('to');
      q.delete('name');
      q.delete('child');
      router.replace(`/parent/messages${q.toString() ? `?${q.toString()}` : ''}`, { scroll: false });
    }
  }, [searchParams, router]);

  const unreadCount = unreadRes?.unreadCount ?? 0;

  return (
    <div className="px-4 py-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="text-gray-500">Chat privately with your children&apos;s class teachers</p>
        </div>
        {unreadCount > 0 && (
          <span className="px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-sm font-semibold">
            {unreadCount} unread
          </span>
        )}
      </div>

      {teacherContacts.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
          <p className="text-sm font-medium text-gray-600 mb-3">💬 Message a Class Teacher</p>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap sm:overflow-x-auto">
            {teacherContacts.map(t => (
              <button
                key={t.userId}
                onClick={() => setComposer({ toUserId: t.userId, name: t.name, context: `${t.child} (${t.className})` })}
                className="flex-1 min-w-[180px] px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200 text-left hover:bg-indigo-100 active:scale-[0.98] transition-all"
              >
                <p className="font-semibold text-sm text-indigo-800">👩‍🏫 {t.name}</p>
                <p className="text-xs text-indigo-600 mt-0.5">{t.child} · {t.className}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Conversations</h2>
              <span className="text-xs text-gray-400">{conversations.length}</span>
            </div>
            <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-50">
              {conversations.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <span className="text-4xl">💬</span>
                  <p className="text-gray-400 mt-3 text-sm">No conversations yet</p>
                  <p className="text-gray-400 text-xs mt-1">Use the class teacher buttons above to start one.</p>
                </div>
              ) : (
                conversations.map(conv => {
                  const active = conv.id === activeConversationId;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setActiveConversationId(conv.id)}
                      className={`w-full text-left px-5 py-4 transition-colors ${active ? 'bg-indigo-50/70' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm text-gray-900 truncate">{contactName(conv)}</p>
                        {conv.unreadCount > 0 && (
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 truncate">{conv.lastMessage || 'No messages yet'}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{formatTime(conv.lastMessageAt)}</p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[560px]">
            {!activeConversationId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <span className="text-5xl">💬</span>
                <h3 className="text-lg font-semibold text-gray-700 mt-4">Select a conversation</h3>
                <p className="text-sm text-gray-500 mt-2 max-w-sm">
                  Pick a conversation on the left, or tap a class teacher button above to send a message.
                </p>
              </div>
            ) : (
              <>
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">{contactName(conversations.find(c => c.id === activeConversationId) as Conversation) || 'Conversation'}</h2>
                    <p className="text-xs text-gray-400">Safe in-app messaging with the school</p>
                  </div>
                  <button
                    onClick={() => { setActiveConversationId(''); }}
                    className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100"
                  >
                    ← Back
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50/50">
                  {threadLoading ? (
                    <p className="text-center text-gray-400 py-10">Loading messages...</p>
                  ) : !thread || thread.messages.length === 0 ? (
                    <div className="text-center py-10">
                      <span className="text-4xl">👋</span>
                      <p className="text-gray-400 mt-3 text-sm">Say hello to start the conversation!</p>
                    </div>
                  ) : (
                    thread.messages.map(m => {
                      const mine = m.senderId === myId;
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-white border border-gray-200 rounded-bl-md shadow-sm'}`}>
                            {!mine && <p className="text-[11px] font-semibold mb-1 text-indigo-600">{m.senderName || 'Teacher'}</p>}
                            <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                            <p className={`text-[10px] mt-1 ${mine ? 'text-indigo-200' : 'text-gray-400'}`}>{formatTime(m.createdAt)}{mine && m.isRead ? ' · Read' : ''}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-white">
                  <div className="flex gap-2 items-end">
                    <textarea
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage(draft);
                        }
                      }}
                      rows={2}
                      placeholder="Type a message... (Enter to send)"
                      className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-gray-50"
                    />
                    <button
                      onClick={() => sendMessage(draft)}
                      disabled={sending || !draft.trim()}
                      className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 active:scale-[0.97] transition-all"
                    >
                      {sending ? 'Sending...' : 'Send ➤'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {composer && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setComposer(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">Message {composer.name}</h3>
            <p className="text-sm text-gray-500 mt-1">Regarding: {composer.context}</p>
            <textarea
              value={composerText}
              onChange={e => setComposerText(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Write your message to the class teacher..."
              className="w-full mt-4 resize-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => setComposer(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => startConversation(composer.toUserId, composerText)}
                disabled={sending || !composerText.trim()}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {sending ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}