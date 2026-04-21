import { Server as SocketIOServer, Socket } from 'socket.io';
import { TimetableCache, SlotIndex, EntityId } from '../entities/cache';
import { 
  Change, 
  RoomState, 
  RoomLesson, 
  ApplyResult, 
  ConflictInfo,
  TimetableUser,
  UserPresence,
  EditingIndicator 
} from './types';

export interface RealtimeConfig {
  port: number;
  corsOrigin: string;
  autoFixEnabled: boolean;
  conflictStrategy: 'timestamp' | 'role' | 'last-write';
  softLockTimeoutMs: number;
  syncIntervalMs: number;
}

export const DEFAULT_CONFIG: RealtimeConfig = {
  port: 3001,
  corsOrigin: '*',
  autoFixEnabled: true,
  conflictStrategy: 'timestamp',
  softLockTimeoutMs: 30000,
  syncIntervalMs: 5000,
};

const rooms = new Map<string, RoomState>();
const userColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

export class RealtimeStateEngine {
  private io: SocketIOServer;
  private config: RealtimeConfig;
  private caches = new Map<string, TimetableCache>();

  constructor(config: Partial<RealtimeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.io = new SocketIOServer(this.config.port, {
      cors: { origin: this.config.corsOrigin },
    });
    this.setupHandlers();
  }

  private setupHandlers() {
    this.io.on('connection', (socket: Socket) => {
      let currentRoom: string | null = null;
      let currentUser: TimetableUser | null = null;

      socket.on('join', (data: { timetableId: string; user: TimetableUser }) => {
        const { timetableId, user } = data;
        currentRoom = timetableId;
        currentUser = user;

        socket.join(timetableId);

        if (!rooms.has(timetableId)) {
          this.initRoom(timetableId);
        }

        const room = rooms.get(timetableId)!;
        
        room.users.set(user.id, {
          userId: user.id,
          user,
          joinedAt: Date.now(),
          lastActive: Date.now(),
        });

        const state = this.serializeRoom(room);
        socket.emit('state', state);

        this.io.to(timetableId).emit('presence', {
          type: 'join',
          user,
          users: Array.from(room.users.values()).map(u => u.user),
        });

        console.log(`User ${user.name} joined timetable ${timetableId}`);
      });

      socket.on('edit', (data: { timetableId: string; change: Change }) => {
        if (!currentRoom || !currentUser) return;

        const result = this.applyChange(currentRoom, data.change);

        if (result.success) {
          const room = rooms.get(currentRoom)!;
          room.version++;
          room.lastUpdated = Date.now();

          this.io.to(currentRoom).emit('update', {
            change: data.change,
            version: room.version,
          });

          this.schedulePersist(currentRoom);
        } else if (result.autoFixed && this.config.autoFixEnabled) {
          const room = rooms.get(currentRoom)!;
          room.version++;
          room.lastUpdated = Date.now();

          this.io.to(currentRoom).emit('update', {
            change: {
              ...data.change,
              toSlot: result.resolvedToSlot,
            },
            version: room.version,
            autoFixed: true,
          });
        } else {
          socket.emit('conflict', {
            lessonId: data.change.lessonId,
            conflict: result.conflict,
          });
        }
      });

      socket.on('editing', (data: { timetableId: string; lessonId: string }) => {
        if (!currentRoom || !currentUser) return;

        const room = rooms.get(currentRoom);
        if (!room) return;

        const indicator: EditingIndicator = {
          lessonId: data.lessonId,
          userId: currentUser.id,
          user: currentUser,
          startedAt: Date.now(),
        };

        room.editing.set(data.lessonId, indicator);

        this.io.to(currentRoom).emit('editing', {
          type: 'start',
          indicator,
        });

        setTimeout(() => {
          if (room?.editing.get(data.lessonId)?.userId === currentUser.id) {
            room.editing.delete(data.lessonId);
            this.io.to(currentRoom).emit('editing', {
              type: 'stop',
              lessonId: data.lessonId,
            });
          }
        }, this.config.softLockTimeoutMs);
      });

      socket.on('stop-editing', (data: { timetableId: string; lessonId: string }) => {
        if (!currentRoom) return;

        const room = rooms.get(currentRoom);
        if (!room) return;

        room.editing.delete(data.lessonId);

        this.io.to(currentRoom).emit('editing', {
          type: 'stop',
          lessonId: data.lessonId,
          userId: currentUser?.id,
        });
      });

      socket.on('leave', () => {
        if (!currentRoom || !currentUser) return;

        const room = rooms.get(currentRoom);
        if (room) {
          room.users.delete(currentUser.id);
          
          this.io.to(currentRoom).emit('presence', {
            type: 'leave',
            user: currentUser,
            users: Array.from(room.users.values()).map(u => u.user),
          });

          if (room.users.size === 0) {
            this.scheduleCleanup(currentRoom);
          }
        }

        socket.leave(currentRoom);
        currentRoom = null;
        currentUser = null;
      });

      socket.on('disconnect', () => {
        if (!currentRoom || !currentUser) return;

        const room = rooms.get(currentRoom);
        if (room) {
          room.users.delete(currentUser.id);
          
          this.io.to(currentRoom).emit('presence', {
            type: 'leave',
            user: currentUser,
            users: Array.from(room.users.values()).map(u => u.user),
          });
        }
      });
    });
  }

  private initRoom(timetableId: string) {
    const totalSlots = 35;
    
    rooms.set(timetableId, {
      timetableId,
      lessons: [],
      users: new Map(),
      editing: new Map(),
      version: 0,
      lastUpdated: Date.now(),
    });

    this.caches.set(timetableId, new TimetableCache({ totalSlots }));
  }

  private applyChange(timetableId: string, change: Change): ApplyResult {
    const room = rooms.get(timetableId);
    const cache = this.caches.get(timetableId);
    
    if (!room || !cache) {
      return {
        success: false,
        change,
        conflict: { lessonId: change.lessonId, type: 'teacher', message: 'Room not found' },
      };
    }

    const lesson = room.lessons.find(l => l.id === change.lessonId);
    if (!lesson) {
      return {
        success: false,
        change,
        conflict: { lessonId: change.lessonId, type: 'teacher', message: 'Lesson not found' },
      };
    }

    if (change.fromSlot !== lesson.slot) {
      cache.unassignLesson(lesson.teacherId, lesson.classId, lesson.slot, lesson.roomId);
    }

    if (cache.isSlotFree(lesson.teacherId, lesson.classId, change.toSlot, lesson.roomId)) {
      cache.assignLesson(lesson.teacherId, lesson.classId, change.toSlot, lesson.roomId);
      lesson.slot = change.toSlot;

      return {
        success: true,
        change,
      };
    }

    if (this.config.autoFixEnabled) {
      const resolvedSlot = this.findValidSlot(lesson, cache);
      
      if (resolvedSlot !== null) {
        cache.assignLesson(lesson.teacherId, lesson.classId, resolvedSlot, lesson.roomId);
        lesson.slot = resolvedSlot;

        return {
          success: true,
          change,
          autoFixed: true,
          resolvedToSlot: resolvedSlot,
        };
      }
    }

    cache.assignLesson(lesson.teacherId, lesson.classId, lesson.slot, lesson.roomId);

    const conflict = this.detectConflict(lesson.teacherId, lesson.classId, change.toSlot, cache);
    
    return {
      success: false,
      change,
      conflict: {
        lessonId: change.lessonId,
        type: conflict,
        message: this.getConflictMessage(conflict),
      },
    };
  }

  private detectConflict(
    teacherId: EntityId, 
    classId: EntityId, 
    slot: SlotIndex, 
    cache: TimetableCache
  ): 'teacher' | 'class' | 'room' {
    if (!cache.isSlotFree(teacherId, classId, slot)) {
      return 'teacher';
    }
    return 'teacher';
  }

  private getConflictMessage(type: 'teacher' | 'class' | 'room'): string {
    switch (type) {
      case 'teacher':
        return 'Teacher is busy in this slot';
      case 'class':
        return 'Class has another lesson in this slot';
      case 'room':
        return 'Room is already booked';
    }
  }

  private findValidSlot(lesson: RoomLesson, cache: TimetableCache): SlotIndex | null {
    for (let slot = 0; slot < 35; slot++) {
      if (cache.isSlotFree(lesson.teacherId, lesson.classId, slot, lesson.roomId)) {
        return slot;
      }
    }
    return null;
  }

  private serializeRoom(room: RoomState) {
    return {
      timetableId: room.timetableId,
      lessons: room.lessons,
      users: Array.from(room.users.values()).map(u => u.user),
      editing: Array.from(room.editing.values()),
      version: room.version,
      lastUpdated: room.lastUpdated,
    };
  }

  private schedulePersist(timetableId: string) {
    // Debounced persist would go here
  }

  private scheduleCleanup(timetableId: string) {
    setTimeout(() => {
      const room = rooms.get(timetableId);
      if (room && room.users.size === 0) {
        rooms.delete(timetableId);
        this.caches.delete(timetableId);
        console.log(`Cleaned up empty room: ${timetableId}`);
      }
    }, 60000);
  }

  public setLessons(timetableId: string, lessons: RoomLesson[]) {
    const room = rooms.get(timetableId);
    const cache = this.caches.get(timetableId);
    
    if (!room || !cache) {
      this.initRoom(timetableId);
    }

    const currentRoom = rooms.get(timetableId)!;
    const currentCache = this.caches.get(timetableId)!;

    currentRoom.lessons = lessons;
    cache.reset();

    for (const lesson of lessons) {
      currentCache.initTeacher(lesson.teacherId);
      currentCache.initClass(lesson.classId);
      if (lesson.roomId) {
        currentCache.initRoom(lesson.roomId);
      }
      currentCache.assignLesson(
        lesson.teacherId, 
        lesson.classId, 
        lesson.slot, 
        lesson.roomId
      );
    }
  }

  public getRoomState(timetableId: string): RoomState | undefined {
    return rooms.get(timetableId);
  }

  public close() {
    this.io.close();
  }
}

export function createRealtimeServer(config?: Partial<RealtimeConfig>) {
  return new RealtimeStateEngine(config);
}