import { create } from "zustand";
import type {
  WizardStep,
  TimeSettings,
  TeacherConstraints,
  TimeOffSchedule,
  Teacher,
  Subject,
  Classroom,
  Lesson,
  DEFAULT_TIME_SETTINGS,
  DEFAULT_TEACHER_CONSTRAINTS,
} from "@/types/timetable";
import { DEFAULT_TIME_SETTINGS as DEFAULT_TIME, DEFAULT_TEACHER_CONSTRAINTS as DEFAULT_CONSTRAINTS } from "@/types/timetable";

const STORAGE_KEY = "wizard-state";

function loadState() {
  try {
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed;
  } catch {
    return null;
  }
}

function saveState(state: Partial<WizardState>) {
  try {
    if (typeof window === "undefined") return;
    const toSave = {
      step: state.step,
      settings: state.settings,
      selectedTeachers: state.selectedTeachers,
      timeOffSchedule: state.timeOffSchedule,
      teacherConstraints: state.teacherConstraints,
      lessons: state.lessons,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
  }
}

interface WizardState {
  step: WizardStep;
  setStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;

  settings: TimeSettings;
  setSettings: (settings: Partial<TimeSettings>) => void;

  selectedTeachers: Teacher[];
  addTeacher: (teacher: Teacher) => void;
  removeTeacher: (id: string) => void;
  updateSelectedTeacher: (teacher: Teacher) => void;

  timeOffSchedule: TimeOffSchedule;
  setTimeOffSchedule: (teacherId: string, schedule: TimeOffSchedule[string]) => void;

  teacherConstraints: Record<string, TeacherConstraints>;
  setTeacherConstraints: (teacherId: string, constraints: TeacherConstraints) => void;

  lessons: Lesson[];
  setLessons: (lessons: Lesson[]) => void;
  addLesson: (lesson: Lesson) => void;
  updateLesson: (id: string, lesson: Partial<Lesson>) => void;
  removeLesson: (id: string) => void;

  isGenerating: boolean;
  generateProgress: number;
  setIsGenerating: (isGenerating: boolean) => void;
  setGenerateProgress: (progress: number) => void;

  selectedYear: string;
  setSelectedYear: (year: string) => void;

  modalOpen: boolean;
  modalType: string;
  newItem: Record<string, any>;
  editItem: Record<string, any> | null;
  openModal: (type: string) => void;
  closeModal: () => void;
  setNewItem: (data: Record<string, any>) => void;
  setEditItem: (data: Record<string, any> | null) => void;

  selectedTeacher: Teacher | null;
  teacherModalType: string;
  setSelectedTeacher: (teacher: Teacher | null) => void;
  setTeacherModalType: (type: string) => void;

  importTeacherId: string;
  setImportTeacherId: (id: string) => void;

  _hydrated: boolean;
  hydrate: () => void;
  saveWizard: () => void;
  resetWizard: () => void;
}

const initialState = {
  step: "intro" as WizardStep,
  settings: DEFAULT_TIME,
  selectedTeachers: [] as Teacher[],
  timeOffSchedule: {} as TimeOffSchedule,
  teacherConstraints: {} as Record<string, TeacherConstraints>,
  lessons: [] as Lesson[],
  isGenerating: false,
  generateProgress: 0,
  selectedYear: "",
  modalOpen: false,
  modalType: "",
  newItem: {},
  editItem: null,
  selectedTeacher: null,
  teacherModalType: "",
  importTeacherId: "",
  _hydrated: false,
};

export const useWizardStore = create<WizardState>((set, get) => ({
  ...initialState,

  setStep: (step) => set({ step }),

  nextStep: () =>
    set((state) => {
      const stepOrder: WizardStep[] = ["intro", "school", "subjects", "classes", "classrooms", "teachers", "lessons", "end"];
      const currentIndex = stepOrder.indexOf(state.step);
      if (currentIndex < stepOrder.length - 1) {
        return { step: stepOrder[currentIndex + 1] };
      }
      return {};
    }),

  prevStep: () =>
    set((state) => {
      const stepOrder: WizardStep[] = ["intro", "school", "subjects", "classes", "classrooms", "teachers", "lessons", "end"];
      const currentIndex = stepOrder.indexOf(state.step);
      if (currentIndex > 0) {
        return { step: stepOrder[currentIndex - 1] };
      }
      return {};
    }),

  setSettings: (settings) =>
    set((state) => ({
      settings: { ...state.settings, ...settings },
    })),

  addTeacher: (teacher) =>
    set((state) => ({
      selectedTeachers: [...state.selectedTeachers, teacher],
    })),

  removeTeacher: (id) =>
    set((state) => ({
      selectedTeachers: state.selectedTeachers.filter((t) => t.id !== id),
    })),

  updateSelectedTeacher: (teacher) =>
    set((state) => ({
      selectedTeachers: state.selectedTeachers.map((t) =>
        t.id === teacher.id ? teacher : t
      ),
    })),

  setTimeOffSchedule: (teacherId, schedule) =>
    set((state) => ({
      timeOffSchedule: { ...state.timeOffSchedule, [teacherId]: schedule },
    })),

  setTeacherConstraints: (teacherId, constraints) =>
    set((state) => ({
      teacherConstraints: {
        ...state.teacherConstraints,
        [teacherId]: constraints,
      },
    })),

  setLessons: (lessons) => set({ lessons }),

  addLesson: (lesson) =>
    set((state) => ({
      lessons: [...state.lessons, lesson],
    })),

  updateLesson: (id, lesson) =>
    set((state) => ({
      lessons: state.lessons.map((l) =>
        l.id === id ? { ...l, ...lesson } : l
      ),
    })),

  removeLesson: (id) =>
    set((state) => ({
      lessons: state.lessons.filter((l) => l.id !== id),
    })),

  setIsGenerating: (isGenerating) => set({ isGenerating }),

  setGenerateProgress: (generateProgress) => set({ generateProgress }),

  setSelectedYear: (selectedYear) => set({ selectedYear }),

  openModal: (type) => set({ modalType: type, modalOpen: true, newItem: {}, editItem: null }),

  closeModal: () => set({ modalOpen: false, newItem: {}, editItem: null, modalType: "" }),

  setNewItem: (newItem) => set({ newItem }),

  setEditItem: (editItem) => set({ editItem }),

  setSelectedTeacher: (selectedTeacher) => set({ selectedTeacher }),

  setTeacherModalType: (teacherModalType) => set({ teacherModalType }),

  setImportTeacherId: (importTeacherId) => set({ importTeacherId }),

  saveWizard: () => {
    const state = get();
    saveState(state);
  },

  hydrate: () => {
    const saved = loadState();
    if (saved) {
      set({
        step: saved.step || "intro",
        settings: saved.settings || DEFAULT_TIME,
        selectedTeachers: saved.selectedTeachers || [],
        timeOffSchedule: saved.timeOffSchedule || {},
        teacherConstraints: saved.teacherConstraints || {},
        lessons: saved.lessons || [],
        selectedYear: saved.selectedYear || "",
        _hydrated: true,
      });
    } else {
      set({ _hydrated: true });
    }
  },

  resetWizard: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ ...initialState, _hydrated: true });
  },
}));
