import { create } from 'zustand';
import { Exam, ExamAttempt, ExamQuestion, ExamAnswer, ExamStats } from '../types';
import { apiService } from '../services/api';

interface ExamStoreState {
  exams: Exam[];
  currentExam: Exam | null;
  currentAttempt: ExamAttempt | null;
  attemptAnswers: Record<string, string>;
  attemptTimeSpent: Record<string, number>;
  examResults: ExamAttempt[];
  examStats: ExamStats | null;
  uploadedExams: any[];
  loading: boolean;
  error: string | null;

  fetchExams: (filters?: Record<string, string>) => Promise<void>;
  fetchExam: (id: string) => Promise<void>;
  fetchExamResults: (examId: string) => Promise<void>;
  fetchExamStats: (examId: string) => Promise<void>;
  fetchUploadedExams: () => Promise<void>;

  startAttempt: (examId: string, studentId?: string) => Promise<void>;
  submitAnswer: (questionId: string, answer: string) => Promise<void>;
  submitAttempt: () => Promise<void>;
  fetchAttempt: (attemptId: string) => Promise<void>;

  setAnswer: (questionId: string, answer: string) => void;
  setTimeSpent: (questionId: string, seconds: number) => void;
  clearAttempt: () => void;
  clearError: () => void;
}

export const useExamStore = create<ExamStoreState>((set, get) => ({
  exams: [],
  currentExam: null,
  currentAttempt: null,
  attemptAnswers: {},
  attemptTimeSpent: {},
  examResults: [],
  examStats: null,
  uploadedExams: [],
  loading: false,
  error: null,

  fetchExams: async (filters) => {
    set({ loading: true, error: null });
    try {
      const exams = await apiService.getExams(filters);
      set({ exams, loading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to load exams', loading: false });
    }
  },

  fetchExam: async (id) => {
    set({ loading: true, error: null });
    try {
      const exam = await apiService.getExam(id);
      set({ currentExam: exam, loading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to load exam', loading: false });
    }
  },

  fetchExamResults: async (examId) => {
    set({ loading: true, error: null });
    try {
      const results = await apiService.getExamResults(examId);
      set({ examResults: results, loading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to load results', loading: false });
    }
  },

  fetchExamStats: async (examId) => {
    set({ loading: true, error: null });
    try {
      const stats = await apiService.getExamStats(examId);
      set({ examStats: stats, loading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to load stats', loading: false });
    }
  },

  fetchUploadedExams: async () => {
    set({ loading: true, error: null });
    try {
      const uploadedExams = await apiService.getUploadedExams();
      set({ uploadedExams, loading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to load uploaded exams', loading: false });
    }
  },

  startAttempt: async (examId, studentId) => {
    set({ loading: true, error: null, attemptAnswers: {}, attemptTimeSpent: {} });
    try {
      const attempt = await apiService.startExamAttempt(examId, studentId);
      set({ currentAttempt: attempt, loading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to start attempt', loading: false });
    }
  },

  submitAnswer: async (questionId, answer) => {
    const { currentAttempt } = get();
    if (!currentAttempt) return;
    try {
      const timeSpent = get().attemptTimeSpent[questionId] || 0;
      await apiService.submitAnswer(currentAttempt.id, questionId, answer, timeSpent);
      set((state) => ({
        attemptAnswers: { ...state.attemptAnswers, [questionId]: answer },
      }));
    } catch (err: any) {
      set({ error: err?.message || 'Failed to submit answer' });
    }
  },

  submitAttempt: async () => {
    const { currentAttempt } = get();
    if (!currentAttempt) return;
    set({ loading: true });
    try {
      const completed = await apiService.submitExamAttempt(currentAttempt.id);
      set({ currentAttempt: completed, loading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to submit exam', loading: false });
    }
  },

  fetchAttempt: async (attemptId) => {
    set({ loading: true, error: null });
    try {
      const attempt = await apiService.getExamAttempt(attemptId);
      const answers: Record<string, string> = {};
      const timeSpent: Record<string, number> = {};
      attempt.answers?.forEach((a: ExamAnswer) => {
        if (a.answer) answers[a.questionId] = a.answer;
        if (a.timeSpent) timeSpent[a.questionId] = a.timeSpent;
      });
      set({ currentAttempt: attempt, attemptAnswers: answers, attemptTimeSpent: timeSpent, loading: false });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to load attempt', loading: false });
    }
  },

  setAnswer: (questionId, answer) => {
    set((state) => ({
      attemptAnswers: { ...state.attemptAnswers, [questionId]: answer },
    }));
  },

  setTimeSpent: (questionId, seconds) => {
    set((state) => ({
      attemptTimeSpent: { ...state.attemptTimeSpent, [questionId]: seconds },
    }));
  },

  clearAttempt: () => {
    set({ currentAttempt: null, attemptAnswers: {}, attemptTimeSpent: {} });
  },

  clearError: () => set({ error: null }),
}));
