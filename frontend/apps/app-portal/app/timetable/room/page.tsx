'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { schoolApi, termApi, timetableApi } from '@/lib/api';
import EduPageMasterTimetable from '@/components/timetable/EduPageMasterTimetable';

export default function RoomViewPage() {
  const [selectedRoom, setSelectedRoom] = useState('');

  const { data: schoolData } = useQuery({
    queryKey: ['school'],
    queryFn: () => schoolApi.getProfile(),
  });

  const { data: termData } = useQuery({
    queryKey: ['current-term'],
    queryFn: () => termApi.getCurrent(),
  });

  const { data: roomsData } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => timetableApi.getRooms().then(res => {
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    }),
  });

  const schoolId = schoolData?.data?.id;
  const termId = termData?.data?.id;
  const rooms = Array.isArray(roomsData) ? roomsData : [];

  if (!schoolId || !termId) {
    return (
      <main className="space-y-4">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Room View</h1>
          <p className="text-gray-500">Loading school data...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Room Timetables</h1>
          <p className="text-sm text-gray-500">View room utilization and schedules</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Room
          </label>
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="">-- Select a room --</option>
            {rooms.map((room: any) => (
              <option key={room.id} value={room.id}>
                {room.name}
                {room.capacity && ` (Capacity: ${room.capacity})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedRoom ? (
        <EduPageMasterTimetable entityType="room" entityId={selectedRoom} termId={termId} />
      ) : (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-4xl">🚪</span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Select a Room</h3>
          <p className="text-gray-500">
            Choose a room from the dropdown above to view its timetable
          </p>
        </div>
      )}
    </main>
  );
}
