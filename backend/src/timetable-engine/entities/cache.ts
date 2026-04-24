export type SlotIndex = number;
export type EntityId = string;

type Bitmask = bigint;

export interface CacheConfig {
  totalSlots: number;
  periodsPerDay?: number;      // Teaching periods only (e.g., 7)
  breakAfterPeriod?: number;     // Break happens after this period (e.g., 3)
  daysPerWeek?: number;        // Days per week (e.g., 5)
}

const DEFAULT_PERIODS_PER_DAY = 7;
const DEFAULT_BREAK_AFTER_PERIOD = 3;

export function getDay(slot: number, periodsPerDay: number = DEFAULT_PERIODS_PER_DAY): number {
  return Math.floor(slot / periodsPerDay);
}

export function getPeriod(slot: number, periodsPerDay: number = DEFAULT_PERIODS_PER_DAY): number {
  return (slot % periodsPerDay) + 1;
}

export function isBreakGap(slot: number, breakAfterPeriod: number, periodsPerDay: number = DEFAULT_PERIODS_PER_DAY): boolean {
  const period = getPeriod(slot, periodsPerDay);
  return period === breakAfterPeriod;
}

export function isSameBlock(slotA: number, slotB: number, breakAfterPeriod: number, periodsPerDay: number = DEFAULT_PERIODS_PER_DAY): boolean {
  const periodA = getPeriod(slotA, periodsPerDay);
  const periodB = getPeriod(slotB, periodsPerDay);

  return (
    (periodA <= breakAfterPeriod && periodB <= breakAfterPeriod) ||
    (periodA > breakAfterPeriod && periodB > breakAfterPeriod)
  );
}

export function toDisplayPeriod(slot: number, breakAfterPeriod: number, periodsPerDay: number = DEFAULT_PERIODS_PER_DAY): number {
  const rawPeriod = getPeriod(slot, periodsPerDay);
  return rawPeriod <= breakAfterPeriod ? rawPeriod : rawPeriod;
}

export class TimetableCache {
  private totalSlots: number;
  private periodsPerDay: number;
  private breakPeriod: number;

  private teacherBits: Record<EntityId, Bitmask> = {};
  private classBits: Record<EntityId, Bitmask> = {};
  private roomBits: Record<EntityId, Bitmask> = {};

  private lessonValidSlots: Map<string, SlotIndex[]> = new Map();
  private scoreCache: Map<string, number> = new Map();

  constructor(config: CacheConfig) {
    this.totalSlots = config.totalSlots;
    this.periodsPerDay = config.periodsPerDay ?? DEFAULT_PERIODS_PER_DAY;
    this.breakPeriod = config.breakAfterPeriod ?? DEFAULT_BREAK_AFTER_PERIOD;
  }

  getPeriodsPerDay(): number {
    return this.periodsPerDay;
  }

  getBreakPeriod(): number {
    return this.breakPeriod;
  }

  isBreakSlot(slot: SlotIndex): boolean {
    const period = getPeriod(slot, this.periodsPerDay);
    return period === this.breakPeriod;
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

  canAssign(
    teacherId: EntityId,
    classId: EntityId,
    slot: SlotIndex,
    roomId?: EntityId
  ): { valid: boolean; reason?: string } {
    const period = getPeriod(slot, this.periodsPerDay);
    
    if (period === this.breakPeriod) {
      return { valid: false, reason: 'break_period' };
    }

    const teacherSlots = this.getTeacherSlots(teacherId);
    const day = getDay(slot, this.periodsPerDay);

    let beforeCount = 0;
    let afterCount = 0;
    let consecutiveCount = 0;
    let prevPeriod = -1;
    let prevDay = -1;

    for (const tSlot of teacherSlots) {
      const tDay = getDay(tSlot, this.periodsPerDay);
      const tPeriod = getPeriod(tSlot, this.periodsPerDay);

      if (tDay === day) {
        if (tPeriod <= this.breakPeriod) {
          beforeCount++;
        } else {
          afterCount++;
        }

        if (tDay === prevDay && tPeriod === prevPeriod + 1) {
          consecutiveCount++;
        } else {
          consecutiveCount = 1;
        }
        prevPeriod = tPeriod;
        prevDay = tDay;
      }
    }

    if (beforeCount > 0 && afterCount > 0) {
      return { valid: false, reason: 'split_by_break' };
    }

    if (consecutiveCount >= 2) {
      return { valid: false, reason: 'too_many_consecutive' };
    }

    return { valid: true };
  }

  toDisplaySlot(slot: SlotIndex): { day: number; period: number } {
    return {
      day: getDay(slot, this.periodsPerDay),
      period: toDisplayPeriod(slot, this.breakPeriod, this.periodsPerDay),
    };
  }

  assignLesson(
    teacherId: EntityId,
    classId: EntityId,
    slot: SlotIndex,
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
  }

  unassignLesson(
    teacherId: EntityId,
    classId: EntityId,
    slot: SlotIndex,
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
    this.lessonValidSlots.clear();
    this.scoreCache.clear();
  }

  clone(): TimetableCache {
    const copy = new TimetableCache({ totalSlots: this.totalSlots });

    copy.teacherBits = { ...this.teacherBits };
    copy.classBits = { ...this.classBits };
    copy.roomBits = { ...this.roomBits };

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
