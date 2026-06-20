'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { intelligenceApi, subjectApi } from '@/lib/api';
import { classApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface Message {
  role: 'user' | 'tutor' | 'system';
  content: string;
  timestamp: string;
}

export default function AiTutorPage() {
  const { user } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const context = useMemo(() => ({
    role: user?.roles?.[0]?.toLowerCase().replace(' ', '_') || 'student',
    screen: 'ai_tutor',
    subject: selectedSubject ? subjects.find((s: any) => s.id === selectedSubject)?.name || undefined : undefined,
    subjectId: selectedSubject || undefined,
  }), [user, selectedSubject, subjects]);

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classApi.getAll();
      const d = res.data?.data || res.data?.classes || res.data?.result || res.data;
      return Array.isArray(d) ? d : [];
    },
  });

  const { data: subjectsResponse } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await subjectApi.getAll();
      const d = res.data?.data || res.data;
      return Array.isArray(d) ? d : [];
    },
  });
  const subjects = useMemo(() => {
    const raw = Array.isArray(subjectsResponse?.data) ? subjectsResponse.data :
      Array.isArray(subjectsResponse) ? subjectsResponse : [];
    return raw;
  }, [subjectsResponse]);

  const { data: students } = useQuery({
    queryKey: ['class-students', selectedStudent],
    enabled: false,
  });

  const startSession = useMutation({
    mutationFn: () => intelligenceApi.startTutorSession(selectedStudent, selectedSubject || undefined, undefined, context),
    onSuccess: (res) => {
      const data = res.data?.data || res.data;
      setSessionId(data.sessionId || data.id);
      setChatMessages([{
        role: 'tutor',
        content: `Hello! I'm your AI tutor. I'm here to help you with ${selectedSubject || 'your studies'}. What would you like to learn about?`,
        timestamp: new Date().toISOString(),
      }]);
    },
  });

  const sendMessage = useMutation({
    mutationFn: (msg: string) => intelligenceApi.sendTutorMessage(sessionId!, selectedStudent, msg, context),
    onSuccess: (res) => {
      const data = res.data?.data || res.data;
      setChatMessages(prev => [...prev, {
        role: 'tutor',
        content: data.response || data.message || 'Let me think about that...',
        timestamp: new Date().toISOString(),
      }]);
    },
  });

  const askQuestion = useMutation({
    mutationFn: (question: string) => intelligenceApi.askTutor(selectedStudent, question, selectedSubject || undefined, context),
    onSuccess: (res) => {
      const data = res.data?.data || res.data;
      setChatMessages(prev => [...prev, {
        role: 'tutor',
        content: data.response || data.answer || data.message || 'Here is what I think...',
        timestamp: new Date().toISOString(),
      }]);
    },
  });

  const handleSend = () => {
    if (!message.trim() || !selectedStudent) return;
    const userMsg = message.trim();
    setChatMessages(prev => [...prev, {
      role: 'user',
      content: userMsg,
      timestamp: new Date().toISOString(),
    }]);
    setMessage('');

    if (sessionId) {
      sendMessage.mutate(userMsg);
    } else {
      askQuestion.mutate(userMsg);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI Tutor</h1>
        <p className="text-gray-600 mt-1">Intelligent tutoring assistant for personalized learning</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Student</label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select Student</option>
              {(classes || []).flatMap((cls: any) =>
                cls.students?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({cls.name})</option>
                )) || []
              )}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject (Optional)</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">General</option>
              {subjects.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code || ''})</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => startSession.mutate()}
              disabled={!selectedStudent || startSession.isPending}
              className="w-full px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {startSession.isPending ? 'Starting...' : sessionId ? 'New Session' : 'Start Tutoring'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow flex flex-col" style={{ height: '500px' }}>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {chatMessages.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <i className="fa fa-robot text-5xl text-gray-300 mb-4"></i>
              <p>Select a student and start a tutoring session</p>
              <p className="text-sm mt-2">Or type a question below for a quick answer</p>
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-5 py-3 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                    : msg.role === 'system'
                    ? 'bg-gray-100 text-gray-600 italic'
                    : 'bg-gray-50 border border-gray-200 text-gray-800'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1 ${
                    msg.role === 'user' ? 'text-white/70' : 'text-gray-400'
                  }`}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
          {(sendMessage.isPending || askQuestion.isPending) && (
            <div className="flex justify-start">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={selectedStudent ? 'Ask a question or type a message...' : 'Select a student first...'}
              disabled={!selectedStudent}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || !selectedStudent}
              className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <i className="fa fa-paper-plane mr-2"></i>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
