import { Slot } from "@/types/timetable"
import { getSubjectColor } from "@/config/subjectColors"
import { abbreviateSubject } from "@/lib/abbreviations";
import TooltipWrap from "./TooltipWrap";

type Props = {
  slot?: Slot
  day?: number
  period?: number
  refresh?: () => void
}

export default function TimetableCell({ slot, day, period, refresh }: Props) {
  if (!slot) {
    return (
      <div className="border h-20 bg-gray-50/50 border-dashed border-gray-200 rounded-lg" />
    )
  }

  const subject = slot?.subject?.name?.toUpperCase() || ""
  const teacherName = slot?.teacher?.user?.username ?? "—"
  const room = slot?.classroom?.name || slot?.room?.name || ""
  
  // Get color config
  const colorConfig = getSubjectColor(subject)

  return (
    <div
      className={`
        border h-20 rounded-xl flex flex-col
        items-center justify-center
        text-xs transition-all duration-200
        hover:shadow-lg hover:scale-[1.02]
        ${colorConfig.bg}
        ${colorConfig.border} border
        ${colorConfig.text}
      `}
    >
      {/* Subject */}
      <div className="font-bold text-sm tt-subject"><TooltipWrap text={slot.subject?.name || ''}><span>{abbreviateSubject(slot.subject?.name)}</span></TooltipWrap></div>
      
      {/* Teacher */}
      <div className="text-xs opacity-80 mt-0.5">{teacherName}</div>
      
      {/* Room - optional */}
      {room && (
        <div className="text-[10px] opacity-60 flex items-center gap-1">
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          {room}
        </div>
      )}
    </div>
  )
}
