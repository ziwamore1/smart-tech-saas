'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { intelligenceApi, subjectApi, studentApi } from '@/lib/api';
import { classApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { TutorResponse } from '@/components/tutor/tutor-response';
import FileAttachment from '@/components/tutor/file-attachment';
import { Bot, Send } from 'lucide-react';

interface Message {
  role: 'user' | 'tutor' | 'system';
  content: string;
  structured?: any;
  rawContent?: string;
  timestamp: string;
}

export default function AiTutorPage() {
  const { user } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<string[]>([]);

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

  const context = useMemo(() => ({
    role: user?.roles?.[0]?.toLowerCase().replace(' ', '_') || 'student',
    screen: 'ai_tutor',
    subject: selectedSubject ? subjects.find((s: any) => s.id === selectedSubject)?.name || undefined : undefined,
    subjectId: selectedSubject || undefined,
  }), [user, selectedSubject, subjects]);

  const { data: studentsData } = useQuery({
    queryKey: ['ai-tutor-students'],
    queryFn: async () => {
      const res = await studentApi.getAll({ limit: 500 });
      const d = res.data?.data || res.data;
      return Array.isArray(d) ? d : [];
    },
  });
  const students = useMemo(() => {
    if (Array.isArray(studentsData)) return studentsData;
    if (studentsData?.data && Array.isArray(studentsData.data)) return studentsData.data;
    return [];
  }, [studentsData]);

  const startSession = useMutation({
    mutationFn: () => intelligenceApi.startTutorSession(selectedStudent, selectedSubject || undefined, undefined, context),
    onSuccess: (res) => {
      const data = res.data?.data || res.data;
      setSessionId(data.sessionId || data.id);
      const msgContent = data.message || `Hello! I'm your AI tutor. I'm here to help you with ${selectedSubject || 'your studies'}. What would you like to learn about?`;
      let structured = null;
      try {
        const parsed = JSON.parse(msgContent);
        if (parsed && typeof parsed === 'object' && parsed.type) structured = parsed;
      } catch {}
      setChatMessages([{
        role: 'tutor',
        content: structured?.explanation || msgContent,
        structured,
        timestamp: new Date().toISOString(),
      }]);
    },
  });

  const sendMessage = useMutation({
    mutationFn: (params: { msg: string; files?: string[] }) => intelligenceApi.sendTutorMessage(sessionId!, selectedStudent, params.msg, params.files, context),
    onSuccess: (res) => {
      const data = res.data?.data || res.data;
      const response = data.response || data.message || 'Let me think about that...';
      const structured = data.structured || null;
      const rawContent = data.raw || null;
      setChatMessages(prev => [...prev, {
        role: 'tutor',
        content: response,
        structured,
        rawContent,
        timestamp: new Date().toISOString(),
      }]);
    },
  });

  const askQuestion = useMutation({
    mutationFn: (params: { msg: string; files?: string[] }) => intelligenceApi.askTutor(selectedStudent, params.msg, selectedSubject || undefined, params.files, context),
    onSuccess: (res) => {
      const data = res.data?.data || res.data;
      const response = data.response || data.answer || data.message || 'Here is what I think...';
      const structured = data.structured || null;
      const rawContent = data.raw || null;
      setChatMessages(prev => [...prev, {
        role: 'tutor',
        content: response,
        structured,
        rawContent,
        timestamp: new Date().toISOString(),
      }]);
    },
  });

  const handleFileUploaded = (urls: string[]) => {
    setFileUrls(prev => [...prev, ...urls]);
  };

  const handleSend = () => {
    if ((!message.trim() && fileUrls.length === 0) || !selectedStudent) return;
    const userMsg = message.trim() || (fileUrls.length > 0 ? 'See attached files' : '');
    const currentFiles = [...fileUrls];
    setChatMessages(prev => [...prev, {
      role: 'user',
      content: userMsg + (currentFiles.length > 0 ? `\n\n[${currentFiles.length} file(s) attached]` : ''),
      timestamp: new Date().toISOString(),
    }]);
    setMessage('');
    setFileUrls([]);

    if (sessionId) {
      sendMessage.mutate({ msg: userMsg, files: currentFiles });
    } else {
      askQuestion.mutate({ msg: userMsg, files: currentFiles });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI Tutor</h1>
        <p className="text-gray-600 mt-1">Professional mathematics tutoring with step-by-step solutions</p>
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
              {(students || []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName}{s.className || s.class?.name ? ` (${s.className || s.class?.name})` : ''}
                </option>
              ))}
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
              className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-lg shadow-md hover:shadow-lg hover:from-orange-600 hover:to-amber-600 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none transition-all duration-200 not-disabled:cursor-pointer"
            >
              {startSession.isPending ? 'Starting...' : sessionId ? 'New Session' : 'Start Tutoring'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow flex flex-col" style={{ height: '600px' }}>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {chatMessages.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Bot className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p>Select a student and start a tutoring session</p>
              <p className="text-sm mt-2">Or type a question below for a quick answer</p>
            </div>
          ) : (
            chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white max-w-[70%] rounded-2xl px-5 py-3'
                    : msg.role === 'system'
                    ? 'bg-gray-100 text-gray-600 italic max-w-[75%] rounded-2xl px-5 py-3'
                    : 'bg-gray-50 border border-gray-200 text-gray-800 max-w-[85%] rounded-2xl px-5 py-3'
                }`}>
                  {msg.role === 'tutor' && msg.structured ? (
                    <TutorResponse content={msg.content} structured={msg.structured} />
                  ) : msg.role === 'tutor' ? (
                    <TutorResponse content={msg.content} />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                  <p className={`text-xs mt-2 ${
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
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={selectedStudent ? 'Ask a question or type a message...' : 'Select a student first...'}
                disabled={!selectedStudent}
                className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {fileUrls.length > 0 && (
                <div className="absolute -top-2 left-3 -translate-y-full flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  {fileUrls.length} file(s)
                </div>
              )}
            </div>
            <FileAttachment
              sessionId={sessionId || undefined}
              studentId={selectedStudent}
              onFilesUploaded={handleFileUploaded}
              disabled={!selectedStudent}
            />
            <button
              onClick={handleSend}
              disabled={(!message.trim() && fileUrls.length === 0) || !selectedStudent}
              className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-lg shadow-md hover:shadow-lg hover:from-orange-600 hover:to-amber-600 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none transition-all duration-200 not-disabled:cursor-pointer inline-flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
