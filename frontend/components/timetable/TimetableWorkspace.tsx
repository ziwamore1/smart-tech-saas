"use client"

import { DndContext } from "@dnd-kit/core"
import SubjectPalette from "./SubjectPalette"
import MasterTimetableMatrix from "./MasterTimetableMatrix"
import TeacherTimetable from "./TeacherTimetable"
import RoomTimetable from "./RoomTimetable"
import TimetableToolbar from "./TimetableToolbar"
import TimetableFilters from "./TimetableFilters"
import { useState } from "react"

export default function TimetableWorkspace({
  schoolId,
  termId,
}: {
  schoolId: string
  termId: string
}) {

  const [view, setView] = useState<"master" | "class" | "teacher" | "room">("master")
  const [classId, setClassId] = useState("")
  const [teacherId, setTeacherId] = useState("")
  const [roomId, setRoomId] = useState("")

  return (
    <div className="flex flex-col h-screen bg-gray-100">

      {/* ================= HEADER ================= */}
      <div className="bg-white border-b shadow-sm z-10">
        <TimetableToolbar termId={termId} />
        <TimetableFilters
          view={view}
          setView={setView}
          classId={classId}
          setClassId={setClassId}
          teacherId={teacherId}
          setTeacherId={setTeacherId}
          roomId={roomId}
          setRoomId={setRoomId}
        />
      </div>

      {/* ================= WORKSPACE ================= */}
      <DndContext>

        <div className="flex flex-1 overflow-hidden">

          {/* LEFT SIDEBAR */}
          <aside className="w-72 bg-white border-r flex flex-col overflow-hidden">

            {/* Sidebar Header */}
            <div className="p-4 border-b font-semibold text-sm bg-gray-50">
              Subjects
            </div>

            {/* Scrollable Palette */}
            <div className="flex-1 overflow-y-auto p-3">
              <SubjectPalette schoolId={schoolId} />
            </div>

          </aside>

          {/* ================= MAIN CONTENT ================= */}
          <main className="flex-1 overflow-auto p-6">

            {/* View Container Card */}
            <div className="bg-white rounded-2xl shadow-lg border min-h-full">

              {view === "master" && (
                <MasterTimetableMatrix
                  schoolId={schoolId}
                  termId={termId}
                />
              )}

              {view === "teacher" && (
                <TeacherTimetable
                  teacherId={teacherId}
                  termId={termId}
                />
              )}

              {view === "room" && (
                <RoomTimetable
                  roomId={roomId}
                  termId={termId}
                />
              )}

            </div>

          </main>

        </div>

      </DndContext>

    </div>
  )
}