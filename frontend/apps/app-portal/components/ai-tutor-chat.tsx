'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { intelligenceApi, studentApi, subjectApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface TutorMessage {
  id?: string;
  role: 'user' | 'tutor' | 'system';
  content: string;
  createdAt?: string;
}

interface TutorSession {
  id: string;
  studentId?: string;
  subjectId?: string;
  topic?: string;
  status: string;
  createdAt: string;
  lastActive: string;
  lastMessage?: string;
}

interface AiTutorChatProps {
  studentId: string;
  role: 'student' | 'parent';
  childName?: string;
  customContext?: Record<string, any>;
  subjectsOverride?: { id: string; name: string }[];
}

const SUBJECT_TOPICS: Record<string, string[]> = {
  Mathematics: ['Algebra', 'Geometry', 'Fractions', 'Trigonometry', 'Statistics', 'Calculus', 'Word Problems'],
  English: ['Grammar', 'Essay Writing', 'Comprehension', 'Vocabulary', 'Literature', 'Composition'],
  Science: ['Biology', 'Chemistry', 'Physics', 'Photosynthesis', 'The Human Body', 'Forces & Motion'],
  Biology: ['Cells', 'Reproduction', 'Genetics', 'Ecology', 'The Human Body', 'Plants'],
  Chemistry: ['Atoms & Elements', 'Chemical Reactions', 'Acids & Bases', 'Periodic Table', 'Organic Chemistry'],
  Physics: ['Forces', 'Motion', 'Energy', 'Electricity', 'Waves', 'Light & Sound'],
  'Social Studies': ['History', 'Geography', 'Civics', 'Zambia & Africa', 'Current Affairs'],
  Geography: ['Map Reading', 'Climate', 'Rivers & Lakes', 'Population', 'Natural Resources'],
  History: ['Early Civilizations', 'Colonial Era', 'Independence', 'World Wars', 'Modern History'],
  'Religious Education': ['Ethics', 'World Religions', 'Morality', 'Scripture Study'],
  'Computer Studies': ['Programming Basics', 'Hardware', 'Software', 'Internet Safety', 'Spreadsheets'],
  'Business Studies': ['Accounting', 'Commerce', 'Marketing', 'Entrepreneurship', 'Economics'],
  Commerce: ['Trade', 'Banking', 'Insurance', 'Communication', 'Transport'],
  'Civic Education': ['Constitution', 'Rights & Responsibilities', 'Government', 'Elections'],
};

function renderMessage(text: string): string {
  if (!text) return '';
  let t = text
    .replace(/```(\w+)?\n?([\s\S]*?)```/g, (_m, lang, code) => code)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '');
  return t;
}

export default function AiTutorChat({ studentId, role, childName, customContext, subjectsOverride }: AiTutorChatProps) {
  const { user } = useAuth();
  const [view, setView] = useState<'welcome' | 'chat'>('welcome');
  const [activeSession, setActiveSession] = useState<TutorSession | null>(null);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [topic, setTopic] = useState('');
  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>();
  const [sessions, setSessions] = useState<TutorSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const context = useMemo(() => ({
    role,
    studentId,
    userId: user?.id,
    childName,
    ...customContext,
  }), [role, studentId, childName, user?.id, customContext]);

  const { data: sessionData } = useQuery({
    queryKey: ['tutor-sessions', studentId, role],
    queryFn: () => intelligenceApi.getStudentTutorSessions(studentId).then(r => r.data?.data || r.data || []),
    enabled: !!studentId,
    retry: false,
  });

  useEffect(() => {
    const list = Array.isArray(sessionData) ? sessionData : [];
    setSessions(list.filter((s: any) => s.status === 'active'));
    if (activeSession && historyLoaded) {
      const found = list.find((s: any) => s.id === activeSession.id);
      if (found) setActiveSession(found);
    }
  }, [sessionData]);

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects-tutor', studentId],
    queryFn: async () => {
      if (subjectsOverride) return subjectsOverride;
      const res = await subjectApi.getAll();
      return res.data?.data || res.data || [];
    },
    retry: false,
  });

  const subjects: { id: string; name: string }[] = useMemo(() => {
    const list = Array.isArray(subjectsData) ? subjectsData : [];
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];
    (list as any[]).forEach((s: any) => {
      const name = s?.name;
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push({ id: s.id, name });
      }
    });
    return out;
  }, [subjectsData]);

  const suggestedTopics = useMemo(() => {
    if (selectedSubject) {
      const key = Object.keys(SUBJECT_TOPICS).find(k => k.toLowerCase() === selectedSubject.toLowerCase());
      if (key) return SUBJECT_TOPICS[key];
    }
    const flattened = Object.values(SUBJECT_TOPICS).flat();
    const generic = [
      'Explain a topic in my current studies',
      'Help me practice a subject',
      'Give me exam study tips',
      'Explain a concept simply',
      'Help me understand my school performance',
    ];
    return [...new Set([...flattened, ...generic])].slice(0, 12);
  }, [selectedSubject]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  const startSession = async (customTopic?: string, subjId?: string) => {
    const chosenTopic = customTopic ?? topic.trim();
    setLoading(true);
    setTopic('');
    try {
      const res = await intelligenceApi.startTutorSession(studentId, subjId ?? subjectId, chosenTopic || undefined, context);
      const data = res.data?.data || res.data;
      const sessionId = data?.sessionId;
      if (!sessionId) throw new Error('No session created');
      const session: TutorSession = {
        id: sessionId,
        studentId,
        subjectId: subjId ?? subjectId,
        topic: chosenTopic || undefined,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };
      setActiveSession(session);
      setMessages([{ role: 'tutor', content: data?.message || 'Hello! How can I help you learn today?', createdAt: new Date().toISOString() }]);
      setView('chat');
      setHistoryLoaded(true);
      scrollToEnd();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Failed to start tutoring session.');
    } finally {
      setLoading(false);
    }
  };

  const openSession = async (session: TutorSession) => {
    setLoading(true);
    setActiveSession(session);
    setHistoryLoaded(false);
    try {
      const res = await intelligenceApi.getTutorSessionHistory(session.id);
      const data = res.data || {};
      const rawMessages = Array.isArray(data?.messages) ? data.messages : (data?.data && Array.isArray(data.data?.messages) ? data.data.messages : []);
      const msgs: TutorMessage[] = rawMessages.map((m: any) => ({
        id: m.id,
        role: m.role === 'student' ? 'user' : 'tutor',
        content: m.content,
        createdAt: m.createdAt,
      }));
      if (msgs.length === 0) {
        msgs.push({ role: 'tutor', content: 'Welcome back! How can I help you continue learning?', createdAt: new Date().toISOString() });
      }
      setMessages(msgs);
      setSelectedSubject(session.subjectId ? subjects.find(s => s.id === session.subjectId)?.name : undefined);
      setView('chat');
      setHistoryLoaded(true);
      scrollToEnd();
    } catch (e) {
      setMessages([{ role: 'tutor', content: 'Failed to load this session.', createdAt: new Date().toISOString() }]);
      setView('chat');
      setHistoryLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  const endSession = async (sessionId: string) => {
    if (!window.confirm('End this tutoring session?')) return;
    try {
      await intelligenceApi.endTutorSession(sessionId);
    } catch {
      // ignore
    }
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
      setMessages([]);
      setView('welcome');
      setHistoryLoaded(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !activeSession || sending) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text, createdAt: new Date().toISOString() }]);
    setSending(true);
    scrollToEnd();
    try {
      const res = await intelligenceApi.sendTutorMessage(
        activeSession.id,
        studentId,
        text,
        undefined,
        { ...context, subjectId: activeSession.subjectId, topic: activeSession.topic },
      );
      const data = res.data || {};
      const reply = data?.response || data?.message || "I'll help you with that!";
      setMessages(prev => [...prev, { role: 'tutor', content: reply, createdAt: new Date().toISOString() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'tutor', content: "I'm having trouble connecting. Please try again.", createdAt: new Date().toISOString() }]);
    } finally {
      setSending(false);
      scrollToEnd();
    }
  };

  const pickSubject = (s: { id: string; name?: string }) => {
    setSubjectId(s.id);
    setSelectedSubject(s.name);
  };

  if (!studentId) {
    return (
      <div className="text-center py-16 text-gray-500">
        <span className="text-5xl">🤖</span>
        <p className="mt-4">Select a child to start a tutoring session.</p>
      </div>
    );
  }

  if (view === 'chat' && activeSession) {
    return (
      <div className="flex flex-col h-[calc(100vh-220px)] min-h-[480px] bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">AI Tutor</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Online</span>
              {role === 'parent' && childName && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Helping about: {childName}</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {activeSession.topic || 'General conversation'}{selectedSubject ? ` · ${selectedSubject}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveSession(null); setMessages([]); setView('welcome'); setHistoryLoaded(false); }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              ← Sessions
            </button>
            <button
              onClick={() => endSession(activeSession.id)}
              className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
            >
              End
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
          {messages.map((m, i) => (
            <div key={m.id || i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm'
              }`}>
                {m.role === 'tutor' && <p className="text-[11px] font-semibold text-indigo-600 mb-1">AI Tutor</p>}
                <p>{renderMessage(m.content)}</p>
                {m.createdAt && <p className={`text-[10px] mt-1.5 ${m.role === 'user' ? 'text-indigo-200' : 'text-gray-400'}`}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="px-4 py-2.5 bg-white border border-gray-200 rounded-2xl rounded-bl-sm text-sm text-gray-400 italic shadow-sm">
                AI Tutor is thinking...
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 bg-white flex items-end gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={role === 'parent' ? `Ask about ${childName || 'your child'}'s learning, performance, or any question...` : 'Ask a question, type a topic, or ask for help...'}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Your Sessions</h2>
              <p className="text-sm text-gray-500">Continue where you left off</p>
            </div>
            <button
              onClick={() => startSession()}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              + New
            </button>
          </div>
          <div className="p-3">
            {sessions.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-4xl">📚</p>
                <p className="mt-3 text-sm">No active sessions yet</p>
                <p className="text-xs mt-1">Start a new tutoring session to begin.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => openSession(s)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50/40 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.topic || 'General Tutoring'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Last active {new Date(s.lastActive).toLocaleDateString()}</p>
                    </div>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap">Active</span>
                      <span onClick={(e) => { e.stopPropagation(); endSession(s.id); }} className="text-gray-400 hover:text-red-500 text-sm">✕</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mt-6 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Pick a Subject to Learn</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            <button
              onClick={() => { setSubjectId(undefined); setSelectedSubject(undefined); }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${!selectedSubject ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
            >
              🧠 General Questions
            </button>
            {subjects.map((s) => (
              <button
                key={s.id}
                onClick={() => pickSubject(s)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selectedSubject === s.name ? 'bg-indigo-600 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
              >
                📖 {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-6 bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
            <p className="text-4xl">🤖</p>
            <h2 className="text-2xl font-bold mt-2">AI Tutor</h2>
            <p className="text-indigo-100 mt-1 max-w-xl">
              {role === 'parent'
                ? `Your personal learning assistant to understand ${childName || 'your child'}'s performance, strengths and areas for improvement.`
                : 'Your personal learning assistant. Learn any subject in your class, get explanations, practice, and general help.'}
            </p>
          </div>

          <div className="p-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">What would you like to learn or ask about?</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              placeholder={role === 'parent'
                ? 'e.g., How is my child doing in Math? What areas should they focus on? OR enter a topic like Algebra to learn about it.'
                : 'e.g., Algebra, Photosynthesis, Essay writing, or ask me any question...'}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            {selectedSubject && (
              <p className="text-sm text-gray-500 mt-2">
                Learning subject: <span className="font-medium text-indigo-600">{selectedSubject}</span>
              </p>
            )}

            <button
              onClick={() => startSession()}
              disabled={loading}
              className="mt-4 w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Starting session...' : role === 'parent' ? 'Start Tutoring ✓' : 'Start Learning ➤'}
            </button>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Suggested topics{selectedSubject ? ` for ${selectedSubject}` : ''}</h3>
              <div className="flex flex-wrap gap-2">
                {suggestedTopics.map((t) => (
                  <button
                    key={t}
                    onClick={() => startSession(t, selectedSubject ? subjectId : undefined)}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-full bg-gray-100 text-sm text-gray-700 hover:bg-indigo-100 hover:text-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
