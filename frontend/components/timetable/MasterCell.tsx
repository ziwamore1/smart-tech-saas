"use client"

import { Slot } from "@/types/timetable"
import { useDroppable } from "@dnd-kit/core"
import DraggableSlot from "./DraggableSlot"
import { getSubjectColor } from "@/config/subjectColors"
import { abbreviateSubject, abbreviateTeacher } from "@/lib/abbreviations";
import TooltipWrap from "./TooltipWrap";

type Props = {
  slot?: Slot
  day: number
  period: number
  conflict?: boolean
  locked?: boolean
}

export default function MasterCell({
  slot,
  day,
  period,
  conflict,
  locked,
}: Props) {

  const { setNodeRef, isOver } = useDroppable({
    id: `${day}-${period}`,
    disabled: locked,
  })

  const subjectName = slot?.subject?.name?.toUpperCase() || ""
  const subject = slot?.subject?.name ? abbreviateSubject(slot.subject.name) : ""
  const teacher = slot?.teacher ? abbreviateTeacher(slot.teacher) : ""
  const room = slot?.classroom?.name || slot?.room?.name || ""

  // Get color config for this subject
  const colorConfig = subjectName ? getSubjectColor(subjectName) : null

  // Conflict style
  if (conflict) {
    return (
      <div
        ref={setNodeRef}
        className="border-r border-slate-100 min-h-[80px] p-1 bg-red-50 flex items-center justify-center"
      >
        <div className="bg-red-100 border border-red-300 rounded-lg p-2 text-center w-full">
          <div className="text-xs font-semibold text-red-700">Conflict</div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={`
        relative
        border-r border-slate-100
        min-h-[80px]
        p-1.5
        transition-all duration-150
        ${isOver && !locked ? "ring-2 ring-blue-400 ring-inset bg-blue-50/50" : ""}
        ${locked ? "cursor-not-allowed opacity-80" : ""}
      `}
    >

      {/* SLOT CONTENT - Enhanced Card Style */}
      {slot && (
        <div className={`
          h-full rounded-xl p-2 flex flex-col
          ${colorConfig ? `${colorConfig.bg} border ${colorConfig.border}` : 'bg-slate-100 border-slate-200'}
          ${!locked ? `cursor-move ${colorConfig?.hover || 'hover:bg-slate-200'}` : ''}
          shadow-sm hover:shadow-md transition-shadow
        `}>
          
          {/* Subject Name */}
          <div className="flex-1 flex items-start justify-center">
            {!locked ? (
              <DraggableSlot slot={slot} />
            ) : (
              <div className={`
                font-bold text-sm text-center leading-tight mc-subject
                ${colorConfig?.text || 'text-slate-800'}
              `}>
                <TooltipWrap text={slot?.subject?.name || ''}><span>{subject}</span></TooltipWrap>
              </div>
            )}
          </div>

          {/* Teacher & Room Info */}
          <div className="mt-auto space-y-0.5">
            {teacher && (
              <div className="flex items-center justify-center gap-1">
                {/* Teacher Icon */}
                <svg className="w-3 h-3 text-slate-600/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-[10px] text-slate-700 truncate max-w-[100px] mc-teacher">
                  <TooltipWrap text={`${slot?.teacher?.user?.firstName || ''} ${slot?.teacher?.user?.lastName || ''}`.trim()}><span>{teacher}</span></TooltipWrap>
                </span>
              </div>
            )}
            {room && (
              <div className="flex items-center justify-center gap-1">
                {/* Room Icon */}
                <svg className="w-3 h-3 text-slate-600/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="text-[10px] text-slate-600">
                  {room}
                </span>
              </div>
            )}
          </div>

        </div>
      )}

      {/* EMPTY SLOT */}
      {!slot && (
        <div className="h-full flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-slate-200"></div>
        </div>
      )}

    </div>
  )
}
