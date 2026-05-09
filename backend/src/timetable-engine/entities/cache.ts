export type SlotIndex = number;
export type EntityId = string;

type Bitmask = bigint;

export interface BreakConfig {
  afterPeriod: number;
  duration: number;
  name?: string;
}

export interface CacheConfig {
  totalSlots: number;
  periodsPerDay?: number;
  breaks?: BreakConfig[];
  daysPerWeek?: number;
  /** 0-indexed compact period indices where a double lesson is valid
   *  (i.e. the corresponding display periods are consecutive and not separated by a break).
   *  When set, replaces the double-crosses-break check. */
  validCompactDoublePeriods?: number[];
  /** Max lessons a teacher can have in a single day (default 0 = no limit). */
  maxTeacherLessonsPerDay?: number;
}

const DEFAULT_PERIODS_PER_DAY = 7;

export function getDay(slot: number, periodsPerDay: number = DEFAULT_PERIODS_PER_DAY): number {
  return Math.floor(slot / periodsPerDay);
}

export function getPeriod(slot: number, periodsPerDay: number = DEFAULT_PERIODS_PER_DAY): number {
  return (slot % periodsPerDay) + 1;
}

export class TimetableCache {
  private totalSlots: number;
  private periodsPerDay: number;
  private breaks: BreakConfig[];
  private validCompactDoublePeriods: Set<number> | null;
  private maxTeacherLessonsPerDay: number;

  private teacherBits: Record<EntityId, Bitmask> = {};
  private classBits: Record<EntityId, Bitmask> = {};
  private roomBits: Record<EntityId, Bitmask> = {};

  private teacherDayClassSubject: Map<string, Map<number, Set<string>>> = new Map();
  private doublePeriodSlots: Map<string, SlotIndex[]> = new Map();
  private teacherDailyCount: Map<string, Map<number, number>> = new Map();

  private lessonValidSlots: Map<string, SlotIndex[]> = new Map();
  private scoreCache: Map<string, number> = new Map();

  constructor(config: CacheConfig) {
    this.totalSlots = config.totalSlots;
    this.periodsPerDay = config.periodsPerDay ?? DEFAULT_PERIODS_PER_DAY;
    this.breaks = config.breaks ?? [];
    this.validCompactDoublePeriods = config.validCompactDoublePeriods
      ? new Set(config.validCompactDoublePeriods)
      : null;
    this.maxTeacherLessonsPerDay = config.maxTeacherLessonsPerDay ?? 0;
  }

  getPeriodsPerDay(): number {
    return this.periodsPerDay;
  }

  getBreaks(): BreakConfig[] {
    return this.breaks;
  }

  private doubleCrossesBreak(slot: SlotIndex): boolean {
    const periodId = getPeriod(slot, this.periodsPerDay);
    return this.breaks.some(b => b.afterPeriod === periodId);
  }

  getTeacherSlots(teacherId: EntityId): SlotIndex[] {
    const bits = this.teacherBits[teacherId] || 0n;
    const slots: SlotIndex[] = [];
    for (let i = 0; i < this.totalSlots; i++) {
      if ((bits & (1n << BigInt(i))) !== 0n) {
        slots.push(i);
      }
    }
    return slots;
  }

  getClassSlots(classId: EntityId): SlotIndex[] {
    const bits = this.classBits[classId] || 0n;
    const slots: SlotIndex[] = [];
    for (let i = 0; i < this.totalSlots; i++) {
      if ((bits & (1n << BigInt(i))) !== 0n) {
        slots.push(i);
      }
    }
    return slots;
  }

  initTeacher(id: EntityId) {
    if (!this.teacherBits[id]) this.teacherBits[id] = 0n;
  }

  initClass(id: EntityId) {
    if (!this.classBits[id]) this.classBits[id] = 0n;
  }

  initRoom(id: EntityId) {
    if (!this.roomBits[id]) this.roomBits[id] = 0n;
  }

  private bit(slot: SlotIndex): bigint {
    return 1n << BigInt(slot);
  }

  private isFree(bitmask: Bitmask, slot: SlotIndex): boolean {
    return (bitmask & this.bit(slot)) === 0n;
  }

  private assign(bitmask: Bitmask, slot: SlotIndex): Bitmask {
    return bitmask | this.bit(slot);
  }

  private unassign(bitmask: Bitmask, slot: SlotIndex): Bitmask {
    return bitmask & ~this.bit(slot);
  }

  isTeacherFree(teacherId: EntityId, slot: SlotIndex): boolean {
    return this.isFree(this.teacherBits[teacherId] || 0n, slot);
  }

  isClassFree(classId: EntityId, slot: SlotIndex): boolean {
    return this.isFree(this.classBits[classId] || 0n, slot);
  }

  isRoomFree(roomId: EntityId, slot: SlotIndex): boolean {
    return this.isFree(this.roomBits[roomId] || 0n, slot);
  }

  isSlotFree(
    teacherId: EntityId,
    classId: EntityId,
    slot: SlotIndex,
    roomId?: EntityId
  ): boolean {
    return (
      this.isTeacherFree(teacherId, slot) &&
      this.isClassFree(classId, slot) &&
      (!roomId || this.isRoomFree(roomId, slot))
    );
  }

  recordTeacherDayClassSubject(teacherId: string, day: number, classId: string, subjectId: string) {
    const teacherMap = this.teacherDayClassSubject.get(teacherId) || new Map();
    const daySet = teacherMap.get(day) || new Set();
    daySet.add(`${classId}::${subjectId}`);
    teacherMap.set(day, daySet);
    this.teacherDayClassSubject.set(teacherId, teacherMap);
  }

  removeTeacherDayClassSubject(teacherId: string, day: number, classId: string, subjectId: string) {
    const teacherMap = this.teacherDayClassSubject.get(teacherId);
    if (!teacherMap) return;
    const daySet = teacherMap.get(day);
    if (!daySet) return;
    daySet.delete(`${classId}::${subjectId}`);
    if (daySet.size === 0) teacherMap.delete(day);
    this.teacherDayClassSubject.set(teacherId, teacherMap);
  }

  hasTeacherDayClassSubject(teacherId: string, day: number, classId: string, subjectId: string): boolean {
    const teacherMap = this.teacherDayClassSubject.get(teacherId);
    if (!teacherMap) return false;
    const daySet = teacherMap.get(day);
    if (!daySet) return false;
    return daySet.has(`${classId}::${subjectId}`);
  }

  canAssign(
    teacherId: EntityId,
    classId: EntityId,
    slot: SlotIndex,
    subjectId?: string
  ): { valid: boolean; reason?: string } {
    const day = getDay(slot, this.periodsPerDay);

    if (!this.isTeacherFree(teacherId, slot)) {
      return { valid: false, reason: 'teacher_busy' };
    }

    if (!this.isClassFree(classId, slot)) {
      return { valid: false, reason: 'class_busy' };
    }

    if (this.maxTeacherLessonsPerDay > 0) {
      const dayMap = this.teacherDailyCount.get(teacherId);
      const count = dayMap?.get(day) ?? 0;
      if (count >= this.maxTeacherLessonsPerDay) {
        return { valid: false, reason: 'teacher_max_per_day' };
      }
    }

    return { valid: true };
  }

  canAssignDouble(
    teacherId: EntityId,
    classId: EntityId,
    slot1: SlotIndex,
    slot2: SlotIndex,
    subjectId?: string
  ): { valid: boolean; reason?: string } {
    const period1 = getPeriod(slot1, this.periodsPerDay);
    const period2 = getPeriod(slot2, this.periodsPerDay);
    const day1 = getDay(slot1, this.periodsPerDay);
    const day2 = getDay(slot2, this.periodsPerDay);

    if (day1 !== day2) {
      return { valid: false, reason: 'double_periods_different_days' };
    }

    if (Math.abs(period1 - period2) !== 1) {
      return { valid: false, reason: 'double_periods_not_consecutive' };
    }

    if (this.validCompactDoublePeriods) {
      const compactPeriod = slot1 % this.periodsPerDay;
      if (!this.validCompactDoublePeriods.has(compactPeriod)) {
        return { valid: false, reason: 'double_crosses_break' };
      }
    } else if (this.doubleCrossesBreak(slot1)) {
      return { valid: false, reason: 'double_crosses_break' };
    }

    for (const s of [slot1, slot2]) {
      if (!this.isTeacherFree(teacherId, s)) {
        return { valid: false, reason: 'teacher_busy' };
      }
      if (!this.isClassFree(classId, s)) {
        return { valid: false, reason: 'class_busy' };
      }
    }

    if (this.maxTeacherLessonsPerDay > 0) {
      const dayMap = this.teacherDailyCount.get(teacherId);
      const count = dayMap?.get(day1) ?? 0;
      if (count + 2 > this.maxTeacherLessonsPerDay) {
        return { valid: false, reason: 'teacher_max_per_day' };
      }
    }

    return { valid: true };
  }

  getValidDoubleSlots(
    teacherId: EntityId,
    classId: EntityId,
    slots: SlotIndex[],
    subjectId?: string,
  ): SlotIndex[] {
    const result: SlotIndex[] = [];
    const sortedSlots = [...slots].sort((a, b) => a - b);

    for (let i = 0; i < sortedSlots.length - 1; i++) {
      const slot1 = sortedSlots[i];
      const slot2 = sortedSlots[i + 1];
      const period1 = getPeriod(slot1, this.periodsPerDay);
      const period2 = getPeriod(slot2, this.periodsPerDay);
      const day1 = getDay(slot1, this.periodsPerDay);
      const day2 = getDay(slot2, this.periodsPerDay);

      if (day1 !== day2) continue;
      if (period2 !== period1 + 1) continue;

      const check = this.canAssignDouble(teacherId, classId, slot1, slot2, subjectId);
      if (check.valid) {
        result.push(slot1);
      }
    }

    return result;
  }

  toDisplaySlot(slot: SlotIndex): { day: number; period: number } {
    return {
      day: getDay(slot, this.periodsPerDay),
      period: getPeriod(slot, this.periodsPerDay),
    };
  }

  assignLesson(
    teacherId: EntityId,
    classId: EntityId,
    slot: SlotIndex,
    subjectId?: string,
    roomId?: EntityId
  ) {
    this.teacherBits[teacherId] = this.assign(
      this.teacherBits[teacherId] || 0n,
      slot
    );

    this.classBits[classId] = this.assign(
      this.classBits[classId] || 0n,
      slot
    );

    if (roomId) {
      this.roomBits[roomId] = this.assign(
        this.roomBits[roomId] || 0n,
        slot
      );
    }

    if (subjectId) {
      const day = getDay(slot, this.periodsPerDay);
      this.recordTeacherDayClassSubject(teacherId, day, classId, subjectId);
    }

    const day = getDay(slot, this.periodsPerDay);
    if (!this.teacherDailyCount.has(teacherId)) {
      this.teacherDailyCount.set(teacherId, new Map());
    }
    const dayMap = this.teacherDailyCount.get(teacherId)!;
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }

  assignDoubleLesson(
    teacherId: EntityId,
    classId: EntityId,
    slot1: SlotIndex,
    slot2: SlotIndex,
    lessonId: string,
    subjectId?: string,
    roomId?: EntityId
  ) {
    this.assignLesson(teacherId, classId, slot1, subjectId, roomId);
    this.assignLesson(teacherId, classId, slot2, subjectId, roomId);
    this.doublePeriodSlots.set(lessonId, [slot1, slot2]);
  }

  unassignLesson(
    teacherId: EntityId,
    classId: EntityId,
    slot: SlotIndex,
    subjectId?: string,
    roomId?: EntityId
  ) {
    this.teacherBits[teacherId] = this.unassign(
      this.teacherBits[teacherId],
      slot
    );

    this.classBits[classId] = this.unassign(
      this.classBits[classId],
      slot
    );

    if (roomId) {
      this.roomBits[roomId] = this.unassign(
        this.roomBits[roomId],
        slot
      );
    }

    if (subjectId) {
      const day = getDay(slot, this.periodsPerDay);
      this.removeTeacherDayClassSubject(teacherId, day, classId, subjectId);
    }

    const day = getDay(slot, this.periodsPerDay);
    const dayMap = this.teacherDailyCount.get(teacherId);
    if (dayMap) {
      const count = dayMap.get(day) ?? 0;
      if (count <= 1) {
        dayMap.delete(day);
      } else {
        dayMap.set(day, count - 1);
      }
    }
  }

  getValidSlots(lessonId: string): SlotIndex[] | undefined {
    return this.lessonValidSlots.get(lessonId);
  }

  setValidSlots(lessonId: string, slots: SlotIndex[]) {
    this.lessonValidSlots.set(lessonId, slots);
  }

  clearValidSlots(lessonId?: string) {
    if (lessonId) {
      this.lessonValidSlots.delete(lessonId);
    } else {
      this.lessonValidSlots.clear();
    }
  }

  getScore(hash: string): number | undefined {
    return this.scoreCache.get(hash);
  }

  setScore(hash: string, score: number) {
    this.scoreCache.set(hash, score);
  }

  clearScoreCache() {
    this.scoreCache.clear();
  }

  reset() {
    this.teacherBits = {};
    this.classBits = {};
    this.roomBits = {};
    this.teacherDayClassSubject.clear();
    this.doublePeriodSlots.clear();
    this.teacherDailyCount.clear();
    this.lessonValidSlots.clear();
    this.scoreCache.clear();
  }

  clone(): TimetableCache {
    const copy = new TimetableCache({
      totalSlots: this.totalSlots,
      periodsPerDay: this.periodsPerDay,
      breaks: [...this.breaks],
      validCompactDoublePeriods: this.validCompactDoublePeriods
        ? [...this.validCompactDoublePeriods]
        : undefined,
      maxTeacherLessonsPerDay: this.maxTeacherLessonsPerDay,
    });

    copy.teacherBits = { ...this.teacherBits };
    copy.classBits = { ...this.classBits };
    copy.roomBits = { ...this.roomBits };

    this.teacherDayClassSubject.forEach((dayMap, teacherId) => {
      const newDayMap = new Map<number, Set<string>>();
      dayMap.forEach((set, day) => {
        newDayMap.set(day, new Set(set));
      });
      copy.teacherDayClassSubject.set(teacherId, newDayMap);
    });

    this.doublePeriodSlots.forEach((slots, lessonId) => {
      copy.doublePeriodSlots.set(lessonId, [...slots]);
    });

    copy.lessonValidSlots = new Map(this.lessonValidSlots);
    copy.scoreCache = new Map(this.scoreCache);

    return copy;
  }

  getStateSnapshot() {
    return {
      teachers: this.teacherBits,
      classes: this.classBits,
      rooms: this.roomBits,
    };
  }
}
