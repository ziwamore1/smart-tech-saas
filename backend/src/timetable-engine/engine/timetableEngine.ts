import { ClassRegistry, createClassRegistry, ClassModel, ClassConstraint } from '../models/Class';
import { TeacherRegistry, createTeacherRegistry, TeacherModel } from '../models/Teacher';
import { SubjectRegistry, createSubjectRegistry, SubjectModel } from '../models/Subject';
import { RoomRegistry, createRoomRegistry, RoomModel } from '../models/Room';
import { TimeslotRegistry, createTimeslotRegistry, TimeslotConfig } from '../models/Timeslot';

import { HardConstraintChecker, createHardConstraintChecker } from '../constraints/hardConstraints';
import { SoftConstraintScorer, SoftConstraintDetails, createSoftConstraintScorer, calculateTotalScore } from '../constraints/softConstraints';
import { ScheduledLesson, TimetableState, ValidationResult, SolverConfig, defaultSolverConfig, createTimetableState, cloneTimetableState } from '../constraints/types';

import { createCSPSolver, solveWithFallback, CSPSolverResult } from '../solver/cspSolver';

import { GeneticConfig, defaultGeneticConfig, createGeneticOptimizer, Individual } from '../optimizer/genetic';
import { AnnealingConfig, defaultAnnealingConfig, createSimulatedAnnealingOptimizer } from '../optimizer/annealing';

export interface EngineConfig {
  solver: Partial<SolverConfig>;
  genetic: Partial<GeneticConfig>;
  annealing: Partial<AnnealingConfig>;
}

export const defaultEngineConfig: EngineConfig = {
  solver: defaultSolverConfig,
  genetic: defaultGeneticConfig,
  annealing: defaultAnnealingConfig,
};

export interface TimetableResult {
  state: TimetableState;
  lessonsScheduled: number;
  lessonsTotal: number;
  success: boolean;
  score: number;
  violations: string[];
  solverIterations: number;
  solverBacktracks: number;
}

export class TimetableEngine {
  private classRegistry: ClassRegistry;
  private teacherRegistry: TeacherRegistry;
  private subjectRegistry: SubjectRegistry;
  private roomRegistry: RoomRegistry;
  private timeslotRegistry: TimeslotRegistry;
  private hardChecker: HardConstraintChecker | null = null;
  private softScorer: SoftConstraintScorer | null = null;
  private softDetails: SoftConstraintDetails | null = null;
  private config: EngineConfig;

  constructor(config: Partial<EngineConfig> = {}) {
    this.classRegistry = createClassRegistry();
    this.teacherRegistry = createTeacherRegistry();
    this.subjectRegistry = createSubjectRegistry();
    this.roomRegistry = createRoomRegistry();
    this.timeslotRegistry = createTimeslotRegistry();
    this.config = { ...defaultEngineConfig, ...config };
  }

  loadClasses(classes: ClassModel[]): void {
    for (const cls of classes) {
      this.classRegistry.add(cls);
    }
  }

  loadClassConstraints(constraints: { classId: string; constraint: ClassConstraint }[]): void {
    for (const { classId, constraint } of constraints) {
      this.classRegistry.setConstraint(classId, constraint);
    }
  }

  loadTeachers(teachers: TeacherModel[]): void {
    for (const teacher of teachers) {
      this.teacherRegistry.add(teacher);
    }
  }

  loadSubjects(subjects: SubjectModel[]): void {
    for (const subject of subjects) {
      this.subjectRegistry.add(subject);
    }
  }

  loadRooms(rooms: RoomModel[]): void {
    for (const room of rooms) {
      this.roomRegistry.add(room);
    }
  }

  configureTimeslot(config: Partial<TimeslotConfig>): void {
    this.timeslotRegistry = createTimeslotRegistry(config);
  }

  initialize(): void {
    this.hardChecker = createHardConstraintChecker(
      this.classRegistry,
      this.teacherRegistry,
      this.roomRegistry,
      this.timeslotRegistry,
    );

    const softResult = createSoftConstraintScorer(
      this.classRegistry,
      this.teacherRegistry,
      this.roomRegistry,
      this.timeslotRegistry,
    );

    this.softScorer = softResult.scorer;
    this.softDetails = softResult.details;
  }

  solve(lessons: ScheduledLesson[], options: {
    useOptimization?: boolean;
    useGenetic?: boolean;
    onProgress?: (progress: number, message: string) => void;
  } = {}): TimetableResult {
    const { useOptimization = true, useGenetic = true, onProgress } = options;

    if (!this.hardChecker || !this.softScorer) {
      this.initialize();
    }

    onProgress?.(5, 'Initializing solver...');

    const solver = createCSPSolver(this.hardChecker!, this.softScorer!, this.timeslotRegistry);
    
    onProgress?.(10, 'Running CSP solver...');
    
    const cspResult = solveWithFallback(lessons, this.hardChecker!, this.softScorer!, this.timeslotRegistry, {
      maxIterations: this.config.solver.maxIterations,
      maxTime: this.config.solver.maxTime,
      enablePropagation: this.config.solver.enablePropagation,
      heuristic: 'mrv',
      shuffleLessons: true,
    });

    const lessonsScheduled = cspResult.state.slots.length;
    const success = lessonsScheduled === lessons.length;
    const baseScore = calculateTotalScore(this.softScorer!, cspResult.state);

    let finalState = cspResult.state;
    let finalScore = baseScore;
    let optimizationApplied = false;

    if (useOptimization && success) {
      onProgress?.(60, 'Running optimization...');

      if (useGenetic) {
        const genetic = createGeneticOptimizer(
          this.hardChecker!,
          this.softScorer!,
          this.timeslotRegistry,
          lessons,
        ).configure(this.config.genetic);

        const result = genetic.optimize(cspResult.state);
        finalState = result.state;
        finalScore = result.fitness;
        optimizationApplied = true;
      }

      if (!optimizationApplied || finalScore <= baseScore) {
        const annealing = createSimulatedAnnealingOptimizer(
          this.hardChecker!,
          this.softScorer!,
          this.timeslotRegistry,
        ).configure(this.config.annealing);

        finalState = annealing.optimize(cspResult.state);
        finalScore = calculateTotalScore(this.softScorer!, finalState);
        optimizationApplied = true;
      }
    }

    onProgress?.(100, 'Complete');

    return {
      state: finalState,
      lessonsScheduled: finalState.slots.length,
      lessonsTotal: lessons.length,
      success: finalState.slots.length === lessons.length,
      score: finalScore,
      violations: cspResult.violations,
      solverIterations: cspResult.iterations,
      solverBacktracks: cspResult.backtracks,
    };
  }

  validate(state: TimetableState): ValidationResult {
    if (!this.hardChecker || !this.softScorer) {
      this.initialize();
    }

    const violations: { constraint: string; message: string; severity: 'hard' | 'soft'; penalty?: number }[] = [];

    for (const lesson of state.slots) {
      if (lesson.day === undefined || lesson.period === undefined) continue;

      const hardViolations = this.hardChecker!(state, lesson, lesson.day, lesson.period);
      violations.push(...hardViolations.map(v => ({ ...v, penalty: 0 })));

      if (this.softDetails) {
        const softViolations = this.softDetails(state, lesson, lesson.day, lesson.period);
        violations.push(...softViolations);
      }
    }

    const hardViolationsExist = violations.some(v => v.severity === 'hard');

    return {
      valid: !hardViolationsExist,
      violations,
      score: this.softScorer ? calculateTotalScore(this.softScorer, state) : 0,
    };
  }

  findConflicts(state: TimetableState): { day: number; period: number; conflicts: string[] }[] {
    const conflictMap = new Map<string, string[]>();

    for (const lesson of state.slots) {
      const key = `${lesson.day}-${lesson.period}`;

      if (lesson.classId) {
        const existing = conflictMap.get(key) || [];
        if (!existing.includes(`class:${lesson.classId}`)) {
          existing.push(`class:${lesson.classId}`);
        }
        conflictMap.set(key, existing);
      }

      if (lesson.teacherId) {
        const existing = conflictMap.get(key) || [];
        if (!existing.includes(`teacher:${lesson.teacherId}`)) {
          existing.push(`teacher:${lesson.teacherId}`);
        }
        conflictMap.set(key, existing);
      }

      if (lesson.classroomId) {
        const existing = conflictMap.get(key) || [];
        if (!existing.includes(`room:${lesson.classroomId}`)) {
          existing.push(`room:${lesson.classroomId}`);
        }
        conflictMap.set(key, existing);
      }
    }

    const conflicts: { day: number; period: number; conflicts: string[] }[] = [];

    for (const [key, values] of conflictMap) {
      if (values.length > 1) {
        const [day, period] = key.split('-').map(Number);
        conflicts.push({ day, period, conflicts: values });
      }
    }

    return conflicts;
  }

  getState(state: TimetableState, groupBy: 'class' | 'teacher' | 'day'): Map<string, ScheduledLesson[]> {
    const grouped = new Map<string, ScheduledLesson[]>();

    for (const lesson of state.slots) {
      let key: string;
      
      switch (groupBy) {
        case 'class':
          key = lesson.classId;
          break;
        case 'teacher':
          key = lesson.teacherId;
          break;
        case 'day':
          key = `${lesson.day}`;
          break;
        default:
          key = lesson.id;
      }

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(lesson);
    }

    return grouped;
  }
}

export { ScheduledLesson, TimetableState, ClassModel, TeacherModel, SubjectModel, RoomModel };