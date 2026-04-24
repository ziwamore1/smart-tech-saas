import { Lesson, Assignment } from './fastCSPSolver';
import { Chromosome } from './fastHybridSolver';
import { SlotIndex } from '../entities/cache';

export interface Features {
  teacherGaps: number;
  subjectSpread: number;
  lateLessons: number;
  doubleBookings: number;
  consecutiveLessons: number;
  teacherDayBalance: number;
  morningLessons: number;
  afternoonLessons: number;
}

export interface TrainingExample {
  features: Features;
  rating: number;
}

export interface MLModel {
  weights: Record<keyof Features, number>;
  bias: number;
}

export interface HybridFitnessConfig {
  mlWeight: number;
  heuristicWeight: number;
}

export const DEFAULT_ML_MODEL: MLModel = {
  weights: {
    teacherGaps: -30,
    subjectSpread: 15,
    lateLessons: -10,
    doubleBookings: -1000,
    consecutiveLessons: 5,
    teacherDayBalance: 10,
    morningLessons: 5,
    afternoonLessons: -3,
  },
  bias: 500,
};

export const DEFAULT_FITNESS_CONFIG: HybridFitnessConfig = {
  mlWeight: 0.6,
  heuristicWeight: 0.4,
};

export function extractFeatures(
  chromosome: Chromosome,
  lessonMap: Map<string, Lesson>,
  slotsPerDay: number = 8
): Features {
  return {
    teacherGaps: countTeacherGaps(chromosome, lessonMap, slotsPerDay),
    subjectSpread: measureSubjectSpread(chromosome, lessonMap, slotsPerDay),
    lateLessons: countLateLessons(chromosome, lessonMap, slotsPerDay),
    doubleBookings: countConflicts(chromosome, lessonMap),
    consecutiveLessons: countConsecutiveLessons(chromosome, lessonMap, slotsPerDay),
    teacherDayBalance: measureTeacherDayBalance(chromosome, lessonMap, slotsPerDay),
    morningLessons: countMorningLessons(chromosome, lessonMap, slotsPerDay),
    afternoonLessons: countAfternoonLessons(chromosome, lessonMap, slotsPerDay),
  };
}

export function mlFitness(
  chromosome: Chromosome,
  model: MLModel,
  lessonMap: Map<string, Lesson>,
  slotsPerDay: number = 8
): number {
  const features = extractFeatures(chromosome, lessonMap, slotsPerDay);

  let score = model.bias;

  for (const key in features) {
    const featureKey = key as keyof Features;
    score += features[featureKey] * model.weights[featureKey];
  }

  return score;
}

export function heuristicFitness(
  chromosome: Chromosome,
  lessonMap: Map<string, Lesson>,
  slotsPerDay: number = 8
): number {
  const features = extractFeatures(chromosome, lessonMap, slotsPerDay);

  let score = 1000;

  score -= features.teacherGaps * 30;
  score -= features.subjectSpread * 20;
  score -= features.lateLessons * 10;
  score -= features.doubleBookings * 1000;
  score -= features.consecutiveLessons * 15;
  score += features.teacherDayBalance * 5;
  score += features.morningLessons * 5;
  score -= features.afternoonLessons * 3;

  return score;
}

export function hybridFitness(
  chromosome: Chromosome,
  model: MLModel,
  lessonMap: Map<string, Lesson>,
  config: HybridFitnessConfig = DEFAULT_FITNESS_CONFIG,
  slotsPerDay: number = 8
): number {
  const ml = mlFitness(chromosome, model, lessonMap, slotsPerDay);
  const heuristic = heuristicFitness(chromosome, lessonMap, slotsPerDay);

  return ml * config.mlWeight + heuristic * config.heuristicWeight;
}

function countTeacherGaps(
  chromosome: Chromosome,
  lessonMap: Map<string, Lesson>,
  slotsPerDay: number
): number {
  const teacherDays = new Map<string, Set<number>>();

  for (const gene of chromosome) {
    const lesson = lessonMap.get(gene.lessonId);
    if (!lesson) continue;

    const day = Math.floor(gene.slot / slotsPerDay);
    
    if (!teacherDays.has(lesson.teacherId)) {
      teacherDays.set(lesson.teacherId, new Set());
    }
    teacherDays.get(lesson.teacherId)!.add(day);
  }

  let gaps = 0;
  for (const days of teacherDays.values()) {
    const sortedDays = [...days].sort((a, b) => a - b);
    for (let i = 1; i < sortedDays.length; i++) {
      if (sortedDays[i] - sortedDays[i - 1] > 1) {
        gaps += 1;
      }
    }
  }

  return gaps;
}

function measureSubjectSpread(
  chromosome: Chromosome,
  lessonMap: Map<string, Lesson>,
  slotsPerDay: number
): number {
  const classDays = new Map<string, Set<number>>();

  for (const gene of chromosome) {
    const lesson = lessonMap.get(gene.lessonId);
    if (!lesson) continue;

    const day = Math.floor(gene.slot / slotsPerDay);
    
    if (!classDays.has(lesson.classId)) {
      classDays.set(lesson.classId, new Set());
    }
    classDays.get(lesson.classId)!.add(day);
  }

  let totalSpread = 0;
  for (const days of classDays.values()) {
    totalSpread += days.size;
  }

  return Math.max(0, 5 - totalSpread / Math.max(1, classDays.size));
}

function countLateLessons(
  chromosome: Chromosome,
  lessonMap: Map<string, Lesson>,
  slotsPerDay: number
): number {
  let count = 0;

  for (const gene of chromosome) {
    const lesson = lessonMap.get(gene.lessonId);
    if (!lesson) continue;

    const period = gene.slot % slotsPerDay;
    if (period >= 6) {
      count++;
    }
  }

  return count;
}

function countConflicts(
  chromosome: Chromosome,
  lessonMap: Map<string, Lesson>
): number {
  const slotTeachers = new Map<SlotIndex, Set<string>>();
  const slotClasses = new Map<SlotIndex, Set<string>>();
  const slotRooms = new Map<SlotIndex, Set<string>>();

  for (const gene of chromosome) {
    const lesson = lessonMap.get(gene.lessonId);
    if (!lesson) continue;

    if (!slotTeachers.has(gene.slot)) {
      slotTeachers.set(gene.slot, new Set());
    }
    if (slotTeachers.get(gene.slot)!.has(lesson.teacherId)) {
      return 1;
    }
    slotTeachers.get(gene.slot)!.add(lesson.teacherId);

    if (!slotClasses.has(gene.slot)) {
      slotClasses.set(gene.slot, new Set());
    }
    if (slotClasses.get(gene.slot)!.has(lesson.classId)) {
      return 1;
    }
    slotClasses.get(gene.slot)!.add(lesson.classId);

    if (lesson.roomId) {
      if (!slotRooms.has(gene.slot)) {
        slotRooms.set(gene.slot, new Set());
      }
      if (slotRooms.get(gene.slot)!.has(lesson.roomId)) {
        return 1;
      }
      slotRooms.get(gene.slot)!.add(lesson.roomId);
    }
  }

  return 0;
}

function countConsecutiveLessons(
  chromosome: Chromosome,
  lessonMap: Map<string, Lesson>,
  slotsPerDay: number
): number {
  const teacherSlots = new Map<string, SlotIndex[]>();

  for (const gene of chromosome) {
    const lesson = lessonMap.get(gene.lessonId);
    if (!lesson) continue;

    if (!teacherSlots.has(lesson.teacherId)) {
      teacherSlots.set(lesson.teacherId, []);
    }
    teacherSlots.get(lesson.teacherId)!.push(gene.slot);
  }

  let consecutive = 0;
  for (const slots of teacherSlots.values()) {
    const sorted = slots.sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] === 1) {
        consecutive++;
      }
    }
  }

  return consecutive;
}

function measureTeacherDayBalance(
  chromosome: Chromosome,
  lessonMap: Map<string, Lesson>,
  slotsPerDay: number
): number {
  const teacherDays = new Map<string, number[]>();

  for (const gene of chromosome) {
    const lesson = lessonMap.get(gene.lessonId);
    if (!lesson) continue;

    const day = Math.floor(gene.slot / slotsPerDay);
    
    if (!teacherDays.has(lesson.teacherId)) {
      teacherDays.set(lesson.teacherId, []);
    }
    teacherDays.get(lesson.teacherId)!.push(day);
  }

  let balanceScore = 0;
  for (const days of teacherDays.values()) {
    const counts = new Map<number, number>();
    for (const day of days) {
      counts.set(day, (counts.get(day) || 0) + 1);
    }
    const avg = days.length / 5;
    let variance = 0;
    for (let d = 0; d < 5; d++) {
      const count = counts.get(d) || 0;
      variance += Math.pow(count - avg, 2);
    }
    balanceScore += Math.sqrt(variance / 5);
  }

  return -balanceScore;
}

function countMorningLessons(
  chromosome: Chromosome,
  lessonMap: Map<string, Lesson>,
  slotsPerDay: number
): number {
  let count = 0;

  for (const gene of chromosome) {
    const lesson = lessonMap.get(gene.lessonId);
    if (!lesson) continue;

    const period = gene.slot % slotsPerDay;
    if (period < 3) {
      count++;
    }
  }

  return count;
}

function countAfternoonLessons(
  chromosome: Chromosome,
  lessonMap: Map<string, Lesson>,
  slotsPerDay: number
): number {
  let count = 0;

  for (const gene of chromosome) {
    const lesson = lessonMap.get(gene.lessonId);
    if (!lesson) continue;

    const period = gene.slot % slotsPerDay;
    if (period >= 5) {
      count++;
    }
  }

  return count;
}

export function updateModel(
  model: MLModel,
  data: TrainingExample[],
  learningRate: number = 0.01
): MLModel {
  const newModel = { ...model, weights: { ...model.weights } };

  for (const { features, rating } of data) {
    const prediction = predict(newModel, features);
    const error = rating - prediction;

    for (const key in features) {
      const featureKey = key as keyof Features;
      newModel.weights[featureKey] += learningRate * error * features[featureKey];
    }
    newModel.bias += learningRate * error;
  }

  return newModel;
}

export function predict(model: MLModel, features: Features): number {
  let score = model.bias;

  for (const key in features) {
    const featureKey = key as keyof Features;
    score += features[featureKey] * model.weights[featureKey];
  }

  return score;
}

export function serializeModel(model: MLModel): string {
  return JSON.stringify(model);
}

export function deserializeModel(data: string): MLModel {
  return JSON.parse(data) as MLModel;
}