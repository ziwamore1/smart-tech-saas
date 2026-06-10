'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { intelligenceApi, classApi } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface Question {
  id: string;
  questionText: string;
  type: string;
  options?: string[];
  difficulty?: number;
  topic?: string;
}

export default function AdaptiveTestingPage() {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [startTime, setStartTime] = useState<number>(0);
  const [results, setResults] = useState<any>(null);
  const [answeredCount, setAnsweredCount] = useState(0);

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classApi.getAll();
      const d = res.data?.data || res.data?.classes || res.data?.result || res.data;
      return Array.isArray(d) ? d : [];
    },
  });

  const startSession = useMutation({
    mutationFn: () => intelligenceApi.startAdaptiveSession(selectedStudent, selectedSubject),
    onSuccess: (res) => {
      const data = res.data?.data || res.data;
      setSessionId(data.sessionId || data.id);
      setAnsweredCount(0);
      setResults(null);
      setCurrentQuestion(data.firstQuestion || data.question || null);
      setStartTime(Date.now());
    },
  });

  const submitAnswer = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string }) => {
      const responseTimeMs = Date.now() - startTime;
      return intelligenceApi.submitAdaptiveAnswer(sessionId!, questionId, answer, responseTimeMs);
    },
    onSuccess: (res) => {
      const data = res.data?.data || res.data;
      setAnsweredCount(prev => prev + 1);
      if (data.nextQuestion) {
        setCurrentQuestion(data.nextQuestion);
        setSelectedAnswer('');
        setStartTime(Date.now());
      } else {
        setCurrentQuestion(null);
        setResults(data.result || data);
      }
    },
  });

  const fetchResult = useQuery({
    queryKey: ['adaptive-result', sessionId],
    queryFn: () => intelligenceApi.getAdaptiveResult(sessionId!).then(r => r.data?.data || r.data),
    enabled: !!sessionId && !currentQuestion && !results,
  });

  const handleSubmitAnswer = () => {
    if (!currentQuestion || !selectedAnswer) return;
    submitAnswer.mutate({ questionId: currentQuestion.id, answer: selectedAnswer });
  };

  const subjects = [
    'mathematics', 'english', 'science', 'social-studies', 'integrated-science',
  ];

  if (results || fetchResult.data) {
    const finalResult = results || fetchResult.data;
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Adaptive Testing</h1>
          <p className="text-gray-600 mt-1">Session Complete</p>
        </div>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
            <i className="fa fa-check-circle text-4xl text-green-600"></i>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Assessment Complete</h2>
          <p className="text-gray-600 mb-6">You answered {answeredCount} questions</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">{finalResult.abilityEstimate?.toFixed(2) || 'N/A'}</div>
              <div className="text-sm text-gray-600">Ability Estimate (θ)</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{finalResult.standardError?.toFixed(3) || 'N/A'}</div>
              <div className="text-sm text-gray-600">Standard Error</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{finalResult.proficiencyLevel || 'N/A'}</div>
              <div className="text-sm text-gray-600">Proficiency Level</div>
            </div>
          </div>

          {finalResult.metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(finalResult.metrics).map(([key, val]: [string, any]) => (
                <div key={key} className="bg-white border rounded-lg p-3">
                  <div className="font-semibold text-gray-900">{typeof val === 'number' ? val.toFixed(2) : String(val)}</div>
                  <div className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => { setSessionId(null); setResults(null); setCurrentQuestion(null); }}
            className="mt-6 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-amber-600 transition-all"
          >
            Start New Test
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Adaptive Testing</h1>
        <p className="text-gray-600 mt-1">Computerized adaptive testing using Item Response Theory</p>
      </div>

      {!sessionId && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Start New Assessment</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Student</label>
              <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select Student</option>
                {(classes || []).flatMap((cls: any) =>
                  cls.students?.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({cls.name})</option>
                  )) || []
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
              <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                <option value="">Select Subject</option>
                {subjects.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => startSession.mutate()}
                disabled={!selectedStudent || !selectedSubject || startSession.isPending}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {startSession.isPending ? 'Starting...' : 'Begin Test'}
              </button>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            <i className="fa fa-info-circle mr-2"></i>
            The test adapts to each student's ability level. Questions become harder or easier based on previous answers.
          </div>
        </div>
      )}

      {currentQuestion && (
        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex justify-between items-center mb-6">
            <div className="text-sm text-gray-500">
              Question {answeredCount + 1}
            </div>
            <div className="flex gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                (currentQuestion.difficulty || 0.5) < 0.3 ? 'bg-green-100 text-green-700' :
                (currentQuestion.difficulty || 0.5) < 0.7 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                Difficulty: {currentQuestion.difficulty?.toFixed(2) || '0.50'}
              </span>
              {currentQuestion.topic && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {currentQuestion.topic}
                </span>
              )}
            </div>
          </div>

          <div className="mb-8">
            <p className="text-lg text-gray-900 font-medium">{currentQuestion.questionText}</p>
          </div>

          {currentQuestion.options && currentQuestion.options.length > 0 && (
            <div className="space-y-3 mb-8">
              {currentQuestion.options.map((option, i) => (
                <label
                  key={i}
                  className={`block p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedAnswer === option
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedAnswer === option ? 'border-orange-500' : 'border-gray-300'
                    }`}>
                      {selectedAnswer === option && <div className="w-3 h-3 rounded-full bg-orange-500" />}
                    </div>
                    <span className="text-gray-800">{option}</span>
                  </div>
                </label>
              ))}
            </div>
          )}

          {currentQuestion.type === 'short-answer' && (
            <div className="mb-8">
              <input
                type="text"
                value={selectedAnswer}
                onChange={(e) => setSelectedAnswer(e.target.value)}
                placeholder="Type your answer..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
              />
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-400">
              {answeredCount} questions completed
            </div>
            <button
              onClick={handleSubmitAnswer}
              disabled={!selectedAnswer || submitAnswer.isPending}
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg font-medium hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitAnswer.isPending ? 'Submitting...' : 'Submit Answer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
