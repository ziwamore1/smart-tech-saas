export type SlotIndex = number;
export type EntityId = string;

type Bitmask = bigint;

export interface CacheConfig {
  totalSlots: number;
}

export class TimetableCache {
  private totalSlots: number;

  private teacherBits: Record<EntityId, Bitmask> = {};
  private classBits: Record<EntityId, Bitmask> = {};
  private roomBits: Record<EntityId, Bitmask> = {};

  private lessonValidSlots: Map<string, SlotIndex[]> = new Map();
  private scoreCache: Map<string, number> = new Map();

  constructor(config: CacheConfig) {
    this.totalSlots = config.totalSlots;
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
