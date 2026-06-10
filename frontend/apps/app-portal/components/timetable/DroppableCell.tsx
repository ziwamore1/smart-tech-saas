"use client"

import { useDroppable } from "@dnd-kit/core"
import { abbreviateSubject } from "@/lib/abbreviations";
import TooltipWrap from "./TooltipWrap";

type Props = {
  day: number
  period: number
  slot?: any
  locked?: boolean
  isBreak?: boolean
}

export default function DroppableCell({
  day,
  period,
  slot,
  locked,
  isBreak,
}: Props) {

  const { setNodeRef, isOver } = useDroppable({
    id: `${day}-${period}`,
    disabled: locked || isBreak,
  })

  return (

    <div
      ref={setNodeRef}
      className={`
        border
        min-h-[70px]
        flex
        items-center
        justify-center
        text-xs
        transition-all
        duration-150

        ${isBreak ? "bg-gray-200 font-semibold text-gray-600" : ""}

        ${slot ? "bg-blue-50" : "bg-gray-50"}

        ${isOver ? "ring-2 ring-blue-500 scale-[1.03]" : ""}

        ${locked ? "opacity-60 cursor-not-allowed" : ""}
      `}
    >

      {/* BREAK */}
      {isBreak && (
        <span>BREAK</span>
      )}

      {/* SLOT PREVIEW */}
      {!isBreak && slot && (
        <span className="text-[11px] font-medium dc-subject">
          <TooltipWrap text={slot.subject?.name || ''}><span>{abbreviateSubject(slot.subject?.name)}</span></TooltipWrap>
        </span>
      )}

      {/* EMPTY */}
      {!isBreak && !slot && (
        <span className="opacity-20">—</span>
      )}

    </div>

  )
}