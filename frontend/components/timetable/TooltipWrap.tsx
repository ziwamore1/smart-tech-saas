"use client";

import { useState, useRef } from "react";

export default function TooltipWrap({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
    setShow(true);
  };

  return (
    <span
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShow(false)}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {children}
      {show && text && (
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y - 4,
            transform: 'translateX(-50%) translateY(-100%)',
            background: '#1f2937',
            color: '#fff',
            fontSize: '10px',
            padding: '3px 8px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            zIndex: 99999,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            maxWidth: '300px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}
