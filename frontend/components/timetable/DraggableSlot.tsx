"use client"

import { useDraggable } from "@dnd-kit/core"
import { Slot } from "@/types/timetable"
import { getSubjectColor } from "@/config/subjectColors"
import { abbreviateSubject } from "@/lib/abbreviations";
import TooltipWrap from "./TooltipWrap";

type Props = {
  slot: Slot
  locked?: boolean
}

export default function DraggableSlot({ slot, locked }: Props) {

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: slot.id ?? `slot-${slot.day}-${slot.period}`,
      disabled: locked,
      data: { slot }
    })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
      }
    : undefined

  const subject = slot.subject?.name?.toUpperCase()
  const colorConfig = subject ? getSubjectColor(subject) : null

  return (

    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={`
        px-2
        py-1
        rounded-lg
        text-xs
        font-bold
        shadow-sm
        cursor-grab
        select-none
        transition-all duration-150
        ${colorConfig ? `${colorConfig.bg} ${colorConfig.text} border ${colorConfig.border}` : 'bg-slate-200 text-slate-800 border-slate-300'}
        ${isDragging ? "opacity-80 scale-105 shadow-xl cursor-grabbing ring-2 ring-offset-1 ring-blue-400" : ""}
        ${locked ? "cursor-not-allowed opacity-70" : ""}
        relative
      `}
    >
      <TooltipWrap text={slot.subject?.name || ''}><span>{abbreviateSubject(slot.subject?.name)}</span></TooltipWrap>
    </div>

  )
}
