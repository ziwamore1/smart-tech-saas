import { create } from 'zustand';
import { apiService } from '../services/api';

export interface AssessmentDefinition {
  id: string;
  name: string;
  code: string;
  category: string;
  defaultMaxScore: number;
  defaultWeight: number;
  contributesToFinal: boolean;
  sortOrder: number;
}

export interface AssessmentConfig {
  id: string;
  classId: string;
  subjectId: string;
  termId: string;
  assessmentDefId: string;
  maxScore: number;
  weightPercentage: number;
  mandatory: boolean;
  sequenceOrder: number;
  assessmentDef: AssessmentDefinition;
}

export interface AssessmentResult {
  id: string;
  studentId: string;
  subjectId: string;
  termId: string;
  classId: string;
  assessmentDefId: string;
  rawScore: number | null;
  maxScore: number;
  weightedScore: number | null;
  percentage: number | null;
  grade: string | null;
  remarks: string | null;
  status: string;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
  };
}

export interface PendingAssessment {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  termId: string;
  termName: string;
  assessmentDefId: string;
  assessmentName: string;
  maxScore: number;
  weightPercentage: number;
  totalStudents: number;
  enteredCount: number;
  missingCount: number;
  completionRate: number;
}

interface AssessmentState {
  definitions: AssessmentDefinition[];
  configurations: AssessmentConfig[];
  results: AssessmentResult[];
  pendingAssessments: PendingAssessment[];
  loading: boolean;
  error: string | null;

  fetchDefinitions: () => Promise<void>;
  fetchConfigurations: (classId: string, subjectId: string, termId: string) => Promise<void>;
  fetchResults: (classId: string, subjectId: string, termId: string, assessmentDefId?: string) => Promise<void>;
  fetchPendingAssessments: () => Promise<void>;
  submitScore: (data: {
    studentId: string;
    subjectId: string;
    termId: string;
    classId: string;
    assessmentDefId: string;
    rawScore: number | null;
    remarks?: string;
  }) => Promise<void>;
  submitBulkScores: (data: {
    classId: string;
    subjectId: string;
    termId: string;
    assessmentDefId: string;
    maxScore: number;
    scores: { studentId: string; rawScore: number | null; remarks?: string }[];
  }) => Promise<void>;
  updateConfiguration: (
    classId: string,
    subjectId: string,
    termId: string,
    assessmentDefId: string,
    weight: number
  ) => Promise<void>;
  clearResults: () => void;
}

export const useAssessmentStore = create<AssessmentState>((set, get) => ({
  definitions: [],
  configurations: [],
  results: [],
  pendingAssessments: [],
  loading: false,
  error: null,

  fetchDefinitions: async () => {
    set({ loading: true, error: null });
    try {
      const res = await apiService.getAssessmentDefinitions();
      set({ definitions: res.data?.data || res.data || [], loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchConfigurations: async (classId, subjectId, termId) => {
    set({ loading: true, error: null });
    try {
      const res = await apiService.getAssessmentConfigurations(classId, subjectId, termId);
      set({ configurations: res.data?.data || res.data || [], loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchResults: async (classId, subjectId, termId, assessmentDefId) => {
    set({ loading: true, error: null });
    try {
      const res = await apiService.getClassAssessmentResults(classId, subjectId, termId, assessmentDefId);
      set({ results: res.data?.data || res.data || [], loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchPendingAssessments: async () => {
    set({ loading: true, error: null });
    try {
      const res = await apiService.getPendingAssessments();
      set({ pendingAssessments: res.data?.data || res.data || [], loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  submitScore: async (data) => {
    set({ loading: true, error: null });
    try {
      await apiService.submitAssessmentScore(data);
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  submitBulkScores: async (data) => {
    set({ loading: true, error: null });
    try {
      await apiService.submitBulkAssessmentScores(data);
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateConfiguration: async (classId, subjectId, termId, assessmentDefId, weight) => {
    set({ loading: true, error: null });
    try {
      await apiService.updateAssessmentConfiguration(classId, subjectId, termId, assessmentDefId, weight);
      set({ loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  clearResults: () => {
    set({ results: [] });
  },
}));
