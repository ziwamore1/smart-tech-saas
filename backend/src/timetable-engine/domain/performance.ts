import { Lesson, Timeslot, TimetableSchedule, ScheduledLesson } from './lesson';
import { hasHardConstraints, ConstraintContext } from './constraints';

export class ConflictMatrix {
  constructor(days: number, periods: number) {
    this.days = days;
    this.periods = periods;
    this.teacherMatrix = this.createMatrix();
    this.classMatrix = this.createMatrix();
    this.roomMatrix = this.createMatrix();
  }

  private days: number;
  private periods: number;
  teacherMatrix: Uint8Array;
  classMatrix: Uint8Array;
  roomMatrix: Uint8Array;

  private createMatrix(): Uint8Array {
    return new Uint8Array(this.days * this.periods);
  }

  private getIndex(day: number, period: number): number {
    return (day - 1) * this.periods + (period - 1);
  }

  setTeacher(day: number, period: number, teacherId: string): void {
    const idx = this.getIndex(day, period);
    this.teacherMatrix[idx] = this.hashString(teacherId);
  }

  hasTeacherConflict(day: number, period: number, teacherId: string): boolean {
    const idx = this.getIndex(day, period);
    return this.teacherMatrix[idx] === this.hashString(teacherId);
  }

  setClass(day: number, period: number, classId: string): void {
    const idx = this.getIndex(day, period);
    this.classMatrix[idx] = this.hashString(classId);
  }

  hasClassConflict(day: number, period: number, classId: string): boolean {
    const idx = this.getIndex(day, period);
    return this.classMatrix[idx] === this.hashString(classId);
  }

  setRoom(day: number, period: number, roomId: string): void {
    const idx = this.getIndex(day, period);
    this.roomMatrix[idx] = this.hashString(roomId);
  }

  hasRoomConflict(day: number, period: number, roomId: string): boolean {
    const idx = this.getIndex(day, period);
    return this.roomMatrix[idx] === this.hashString(roomId);
  }

  clear(): void {
    this.teacherMatrix.fill(0);
    this.classMatrix.fill(0);
    this.roomMatrix.fill(0);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 256;
  }
}

export class MemoizationCache<K, V> {
  private cache = new Map<string, V>();
  privateHits = 0;
  private misses = 0;

  get(key: K): V | undefined {
    const keyStr = this.stringify(key);
    return this.cache.get(keyStr);
  }

  set(key: K, value: V): void {
    const keyStr = this.stringify(key);
    this.cache.set(keyStr, value);
  }

  has(key: K): boolean {
    const keyStr = this.stringify(key);
    return this.cache.has(keyStr);
  }

  clear(): void {
    this.cache.clear();
    this.privateHits = 0;
    this.misses = 0;
  }

  get stats() {
    return { hits: this.privateHits, misses: this.misses, size: this.cache.size };
  }

  private stringify(key: K): string {
    if (typeof key === 'string') return key;
    if (typeof key === 'number') return String(key);
    return JSON.stringify(key);
  }
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

export class TTLCache<K, V> {
  private cache = new Map<string, CacheEntry<V>>();

  constructor(private defaultTTL: number = 60000) {}

  get(key: K): V | undefined {
    const entry = this.cache.get(this.keyToString(key));
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(this.keyToString(key));
      return undefined;
    }

    return entry.value;
  }

  set(key: K, value: V, ttl?: number): void {
    this.cache.set(this.keyToString(key), {
      value,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  private keyToString(key: K): string {
    if (typeof key === 'string') return key;
    if (typeof key === 'number') return String(key);
    return JSON.stringify(key);
  }
}

export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  cache: MemoizationCache<any, any>
): T {
  return ((...args: any[]) => {
    const key = args.join('-');
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

export class ConstraintCache {
  private cache = new Map<string, boolean>();

  check(lessonId: string, timeslotKey: string, compute: () => boolean): boolean {
    const key = `${lessonId}:${timeslotKey}`;
    const existing = this.cache.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const result = compute();
    this.cache.set(key, result);
    return result;
  }

  invalidate(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export class DomainReducer {
  private domains = new Map<string, Set<string>>();

  initialize(lessons: Lesson[], timeslots: Timeslot[]): void {
    this.domains.clear();
    for (const lesson of lessons) {
      this.domains.set(lesson.id, new Set(timeslots.map(ts => ts.toKey())));
    }
  }

  reduce(lessonId: string, timeslotKey: string): void {
    const domain = this.domains.get(lessonId);
    if (domain) {
      domain.delete(timeslotKey);
    }
  }

  getDomain(lessonId: string): string[] {
    const domain = this.domains.get(lessonId);
    return domain ? Array.from(domain) : [];
  }

  isEmpty(lessonId: string): boolean {
    const domain = this.domains.get(lessonId);
    return domain ? domain.size === 0 : true;
  }

  hasValues(lessonId: string): boolean {
    const domain = this.domains.get(lessonId);
    return domain ? domain.size > 0 : false;
  }
}

export function createBitmask(days: number, periods: number): number[] {
  return new Array(days * periods).fill(0);
}

export function setBitmask(bits: number[], day: number, period: number, value: number): void {
  const idx = (day - 1) * periods + (period - 1);
  if (value === 1) {
    bits[idx] |= 1;
  } else {
    bits[idx] &= ~1;
  }
}

export function getBitmask(bits: number[], day: number, periods: number): boolean {
  const idx = (day - 1) * periods + (period - 1);
  return (bits[idx] & 1) === 1;
}

export function clearBitmasks(bits: number[]): void {
  bits.fill(0);
}

export interface PerformanceMetrics {
  iterations: number;
  backtracks: number;
  cacheHits: number;
  domainReductions: number;
  timeElapsed: number;
}

export class PerformanceTracker {
  private startTime: number = 0;
  private iterations: number = 0;
  private backtracks: number = 0;
  private cacheHits: number = 0;
  private domainReductions: number = 0;

  start(): void {
    this.startTime = Date.now();
  }

  recordIteration(): void {
    this.iterations++;
  }

  recordBacktrack(): void {
    this.backtracks++;
  }

  recordCacheHit(): void {
    this.cacheHits++;
  }

  recordDomainReduction(): void {
    this.domainReductions++;
  }

  getMetrics(): PerformanceMetrics {
    return {
      iterations: this.iterations,
      backtracks: this.backtracks,
      cacheHits: this.cacheHits,
      domainReductions: this.domainReductions,
      timeElapsed: Date.now() - this.startTime,
    };
  }

  reset(): void {
    this.startTime = 0;
    this.iterations = 0;
    this.backtracks = 0;
    this.cacheHits = 0;
    this.domainReductions = 0;
  }
}