"use client";

import { Dispatch, SetStateAction } from "react";

type ViewType = "master" | "class" | "teacher" | "room";

type Props = {
  view: ViewType;
  setView: Dispatch<SetStateAction<ViewType>>;
  classId: string;
  setClassId: Dispatch<SetStateAction<string>>;
  teacherId: string;
  setTeacherId: Dispatch<SetStateAction<string>>;
  roomId: string;
  setRoomId: Dispatch<SetStateAction<string>>;
};

export default function TimetableFilters({
  view,
  setView,
  classId,
  setClassId,
  teacherId,
  setTeacherId,
  roomId,
  setRoomId,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-b px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100">

      {/* VIEW SELECTOR */}
      <div>
        <label className="text-xs text-gray-600 font-semibold block mb-1.5">
          <i className="fa fa-eye mr-1"></i>View Mode
        </label>

        <select
          value={view}
          onChange={(e) => setView(e.target.value as ViewType)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 bg-white shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent font-medium"
        >
          <option value="master">📅 Master View</option>
          <option value="class">🏫 Class View</option>
          <option value="teacher">👨‍🏫 Teacher View</option>
          <option value="room">🏠 Room View</option>
        </select>
      </div>

      {/* CLASS FILTER */}
      {view === "class" && (
        <div>
          <label className="text-xs text-gray-600 font-semibold block mb-1.5">
            <i className="fa fa-building mr-1"></i>Select Class
          </label>

          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 bg-white shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent font-medium"
          >
            <option value="">Select Class</option>
            {/* Map classes here later */}
          </select>
        </div>
      )}

      {/* TEACHER FILTER */}
      {view === "teacher" && (
        <div>
          <label className="text-xs text-gray-600 font-semibold block mb-1.5">
            <i className="fa fa-chalkboard-teacher mr-1"></i>Select Teacher
          </label>

          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 bg-white shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent font-medium"
          >
            <option value="">Select Teacher</option>
            {/* Map teachers here later */}
          </select>
        </div>
      )}

      {/* ROOM FILTER */}
      {view === "room" && (
        <div>
          <label className="text-xs text-gray-600 font-semibold block mb-1.5">
            <i className="fa fa-door-open mr-1"></i>Select Room
          </label>

          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 bg-white shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent font-medium"
          >
            <option value="">Select Room</option>
            {/* Map rooms here later */}
          </select>
        </div>
      )}

    </div>
  );
}