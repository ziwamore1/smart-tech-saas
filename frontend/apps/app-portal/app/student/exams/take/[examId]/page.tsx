'use client';

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { examApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function TakeExam() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const examId = params?.examId as string;

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [submitted, setSubmitted] = useState(false);

  const { data: examData, isLoading } = useQuery({
    queryKey: ['exam-take', examId],
    queryFn: async () => {
      const res = await examApi.getById(examId);
      return res.data?.data || res.data;
    },
    enabled: !!examId,
  });

  const { data: sectionsData } = useQuery({
    queryKey: ['exam-sections-take', examId],
    queryFn: async () => {
      const res = await examApi.getSections(examId);
      return res.data?.data || res.data || [];
    },
    enabled: !!examId,
  });

  const startAttempt = useMutation({
    mutationFn: async () => {
      const res = await examApi.startAttempt(examId, String(user?.id));
      return res.data?.data || res.data;
    },
    onSuccess: (data) => {
      setAttemptId(data.id || data.attemptId);
    },
  });

  const submitAnswer = useMutation({
    mutationFn: ({ questionId, answer }: { questionId: string; answer: string }) =>
      examApi.submitAnswer(String(attemptId), { questionId, answer }),
  });

  const [submissionResult, setSubmissionResult] = useState<any>(null);

  const submitExamMutation = useMutation({
    mutationFn: () => examApi.submitExam(String(attemptId)),
    onSuccess: (data) => {
      const res = data?.data?.data || data?.data || data;
      setSubmissionResult(res);
      setSubmitted(true);
    },
  });

  useEffect(() => {
    if (examData && !attemptId && user?.id) {
      startAttempt.mutate();
    }
  }, [examData, user?.id]);

  useEffect(() => {
    if (examData?.duration) {
      setTimeLeft(examData.duration * 60);
    }
  }, [examData?.duration]);

  const handleSubmit = useCallback(async () => {
    if (!attemptId || submitted) return;
    try {
      await submitExamMutation.mutateAsync();
    } catch {}
  }, [attemptId, submitted, submitExamMutation]);

  useEffect(() => {
    if (timeLeft <= 0 || submitted) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, submitted, handleSubmit]);

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    if (attemptId) {
      submitAnswer.mutate({ questionId, answer });
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const sections = Array.isArray(sectionsData) ? sectionsData : [];
  const questions = sections.flatMap((s: any) => s.questions || []);
  const allQuestions = questions.length > 0 ? questions : examData?.questions || [];
  const currentQ = allQuestions[currentQuestion];

  if (submitted) {
    const score = submissionResult?.percentage || submissionResult?.score || 0;
    const grade = submissionResult?.grade || '';
    const total = submissionResult?.exam?.totalScore || examData?.totalScore || 0;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-md w-full">
          <span className="text-6xl">✅</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-4">Exam Submitted!</h1>
          <p className="text-gray-500 mt-2">Your answers have been recorded and graded.</p>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-sm text-blue-600 font-medium">Score</p>
              <p className="text-2xl font-bold text-blue-700">{typeof score === 'number' ? `${score.toFixed(1)}%` : `${score}%`}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-sm text-green-600 font-medium">Grade</p>
              <p className="text-2xl font-bold text-green-700">{grade || 'N/A'}</p>
            </div>
          </div>
          <button onClick={() => router.push('/student/exams')} className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Back to Exams</button>
        </div>
      </div>
    );
  }

  if (isLoading || !examData) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Loading exam...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-semibold text-gray-900 truncate max-w-xs">{examData.title}</h1>
            <span className="text-sm text-gray-500">{currentQuestion + 1}/{allQuestions.length}</span>
          </div>
          <div className={`text-lg font-bold ${timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-gray-900'}`}>{formatTime(timeLeft)}</div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {currentQ && (
          <div className="bg-white rounded-xl p-8 shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-600 mb-1">Question {currentQuestion + 1} of {allQuestions.length}</p>
                <p className="text-base text-gray-900 whitespace-pre-wrap">{currentQ.question || currentQ.text}</p>
              </div>
              <span className="text-sm text-gray-400 ml-4">{currentQ.score || currentQ.marks || 1} pt</span>
            </div>

            {currentQ.type === 'MULTIPLE_CHOICE' || currentQ.type === 'TRUE_FALSE' ? (
              <div className="space-y-3">
                {(currentQ.options || currentQ.choices || []).map((opt: string, i: number) => (
                  <label key={i} className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${answers[currentQ.id] === opt ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name={`q-${currentQ.id}`} value={opt} checked={answers[currentQ.id] === opt} onChange={() => handleAnswer(currentQ.id, opt)} className="w-4 h-4 text-blue-600" />
                    <span className="text-gray-700">{opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                value={answers[currentQ.id] || ''}
                onChange={(e) => handleAnswer(currentQ.id, e.target.value)}
                className="w-full h-32 p-4 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-700"
                placeholder="Type your answer here..."
              />
            )}
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
            disabled={currentQuestion === 0}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            ← Previous
          </button>

          <div className="flex items-center gap-2">
            {allQuestions.map((_: any, i: number) => (
              <button
                key={i}
                onClick={() => setCurrentQuestion(i)}
                className={`w-8 h-8 rounded-full text-xs font-medium ${i === currentQuestion ? 'bg-blue-600 text-white' : answers[allQuestions[i]?.id] ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {currentQuestion < allQuestions.length - 1 ? (
            <button onClick={() => setCurrentQuestion(prev => prev + 1)} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Next →</button>
          ) : (
            <button onClick={() => { if (window.confirm('Submit exam? You cannot change answers after submission.')) handleSubmit(); }} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Submit Exam</button>
          )}
        </div>
      </div>
    </div>
  );
}
