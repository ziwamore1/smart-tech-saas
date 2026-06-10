export type Class = {
    id: string;
    name: string;
};

export type Slot = {
    id?: string;
    day: number;
    period: number;
    subject: {
        id?: string;
        name: string;
    };
    teacher: {
        id?: string;
        user: {
            username?: string;
            firstName?: string;
            lastName?: string;
        };
    };
    classroom?: {
        id?: string;
        name: string;
    };
    room?: {
        id?: string;
        name: string;
    };
    classGroup?: {
        id?: string;
        name: string;
    };
    weekType?: 'regular' | 'A' | 'B';
    isCancelled?: boolean;
    isSubstituted?: boolean;
    [key: string]: any;
};

export type ClassMatrix = Record<string, Record<number, Record<number, Slot>>>;

export type WizardStep = 'intro' | 'school' | 'subjects' | 'classes' | 'classrooms' | 'teachers' | 'lessons' | 'end';

export type DayConfig = {
    name: string;
    shortName: string;
};

export type BellBreak = {
    afterPeriod: number;
    duration: number;
    name?: string;
};

export type TimeSettings = {
    startTime: string;
    periodsPerDay: number;
    periodDuration: number;
    daysPerWeek: number;
    breakAfterPeriod: number;
    breakDuration: number;
    breaks: BellBreak[];
    periodDurations: number[];
    useZeroPeriod: boolean;
    showDayNumber: boolean;
    days: DayConfig[];
};

export type TeacherConstraints = {
    maxGapsPerWeek: number;
    maxGapsPerDay: number;
    maxConsecutivePeriods: number;
    maxQuestionMarks: number;
    minLessonsPerWeek: number;
    maxLessonsPerWeek: number;
    maxDaysPerWeek: number;
    maxSubjectPerDay: number;
    maxLessonsPerTeacherPerDay: number;
    minSupervisionsPerWeek: number;
    maxSupervisionsPerWeek: number;
    supervisionMinutes: number;
};

export type TimeOffSchedule = Record<string, Record<string, Record<string, 'available' | 'conditional' | 'unavailable'>>>;

export type Teacher = {
    id: string;
    firstName: string;
    lastName: string;
    title?: string;
    gender?: string;
    email?: string;
    abbreviation?: string;
    color?: string;
    [key: string]: any;
};

export type Subject = {
    id: string;
    name: string;
    code?: string;
    color?: string;
    [key: string]: any;
};

export type Classroom = {
    id: string;
    name: string;
    code?: string;
    capacity?: number;
    schoolId?: string;
    [key: string]: any;
};

export type Lesson = {
    id?: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    lessonsPerWeek: number;
    lessonCount?: number;
    lessonType?: 'single' | 'double' | 'triple' | 'quadruple' | 'quintuple' | 'sextuple' | 'septuple' | 'octuple';
    [key: string]: any;
};

export const DEFAULT_TIME_SETTINGS: TimeSettings = {
    startTime: '07:00',
    periodsPerDay: 8,
    periodDuration: 40,
    daysPerWeek: 5,
    breakAfterPeriod: 4,
    breakDuration: 20,
    breaks: [
        { afterPeriod: 2, duration: 10, name: 'Short Break' },
        { afterPeriod: 4, duration: 20, name: 'Long Break' },
        { afterPeriod: 6, duration: 10, name: 'Short Break' },
    ],
    periodDurations: [40, 40, 40, 40, 40, 40, 40, 40],
    useZeroPeriod: false,
    showDayNumber: false,
    days: [
        { name: 'Monday', shortName: 'Mon' },
        { name: 'Tuesday', shortName: 'Tue' },
        { name: 'Wednesday', shortName: 'Wed' },
        { name: 'Thursday', shortName: 'Thu' },
        { name: 'Friday', shortName: 'Fri' },
        { name: 'Saturday', shortName: 'Sat' },
        { name: 'Sunday', shortName: 'Sun' },
    ],
};

export const DEFAULT_TEACHER_CONSTRAINTS: TeacherConstraints = {
    maxGapsPerWeek: 0,
    maxGapsPerDay: 0,
    maxConsecutivePeriods: 0,
    maxQuestionMarks: 0,
    minLessonsPerWeek: 0,
    maxLessonsPerWeek: 0,
    maxDaysPerWeek: 0,
    maxSubjectPerDay: 2,
    maxLessonsPerTeacherPerDay: 3,
    minSupervisionsPerWeek: 0,
    maxSupervisionsPerWeek: 0,
    supervisionMinutes: 0,
};

export const COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', '#14B8A6',
    '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7',
    '#D946EF', '#EC4899', '#F43F5E', '#6B7280', '#374151', '#1F2937',
];

export const GENDERS = ['Male', 'Female', 'Other'];
export const TITLES = ['Mr.', 'Mrs.', 'Ms.', 'Miss', 'Dr.', 'Prof.'];

export const WIZARD_STEPS: { key: WizardStep; label: string; icon: string }[] = [
    { key: 'intro', label: 'Introduction', icon: '👋' },
    { key: 'school', label: 'School', icon: '🏫' },
    { key: 'subjects', label: 'Subjects', icon: '📚' },
    { key: 'classes', label: 'Classes', icon: '👥' },
    { key: 'classrooms', label: 'Classrooms', icon: '🚪' },
    { key: 'teachers', label: 'Teachers', icon: '👨‍🏫' },
    { key: 'lessons', label: 'Lessons', icon: '📖' },
    { key: 'end', label: 'Generate', icon: '⚡' },
];
