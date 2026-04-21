import { SlotIndex, EntityId } from '../entities/cache';

export interface Change {
  lessonId: string;
  fromSlot: SlotIndex;
  toSlot: SlotIndex;
  userId: string;
  timestamp: number;
}

export interface TimetableUser {
  id: string;
  name: string;
  role: 'admin' | 'teacher' | 'viewer';
  color: string;
}

export interface UserPresence {
  userId: string;
  user: TimetableUser;
  joinedAt: number;
  lastActive: number;
}

export interface EditingIndicator {
  lessonId: string;
  userId: string;
  user: TimetableUser;
  startedAt: number;
}

export interface ConflictInfo {
  lessonId: string;
  type: 'teacher' | 'class' | 'room';
  conflictingUser?: string;
  message: string;
}

export interface ApplyResult {
  success: boolean;
  change: Change;
  conflict?: ConflictInfo;
  autoFixed?: boolean;
  resolvedToSlot?: SlotIndex;
}

export interface RoomState {
  timetableId: string;
  lessons: RoomLesson[];
  users: Map<string, UserPresence>;
  editing: Map<string, EditingIndicator>;
  version: number;
  lastUpdated: number;
}

export interface RoomLesson {
  id: string;
  teacherId: EntityId;
  classId: EntityId;
  roomId?: EntityId;
  slot: SlotIndex;
}

export interface ClientMessage {
  type: 'join' | 'leave' | 'edit' | 'editing' | 'stop-editing' | 'sync';
  payload: any;
}

export interface ServerMessage {
  type: 'state' | 'update' | 'conflict' | 'presence' | 'editing' | 'error';
  payload: any;
}
