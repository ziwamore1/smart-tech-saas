export interface RoomModel {
  id: string;
  name: string;
  capacity: number;
  type: 'regular' | 'lab' | 'gym' | 'music' | 'art';
  equipment: string[];
  blockedSlots: { day: number; period: number }[];
}

export interface RoomRegistry {
  get(id: string): RoomModel | undefined;
  getAll(): RoomModel[];
  add(room: RoomModel): void;
  getAvailable(capacity: number, type?: string): RoomModel[];
  isAvailable(roomId: string, day: number, period: number): boolean;
}

export function createRoomRegistry(): RoomRegistry {
  const rooms = new Map<string, RoomModel>();

  return {
    get(id: string) {
      return rooms.get(id);
    },
    getAll() {
      return Array.from(rooms.values());
    },
    add(room: RoomModel) {
      rooms.set(room.id, {
        ...room,
        type: room.type ?? 'regular',
        equipment: room.equipment ?? [],
        blockedSlots: room.blockedSlots ?? [],
      });
    },
    getAvailable(capacity: number, type?: string) {
      return Array.from(rooms.values()).filter(r => {
        if (r.capacity < capacity) return false;
        if (type && r.type !== type) return false;
        return true;
      });
    },
    isAvailable(roomId: string, day: number, period: number) {
      const room = rooms.get(roomId);
      if (!room) return false;
      return !room.blockedSlots.some(
        s => s.day === day && s.period === period
      );
    },
  };
}