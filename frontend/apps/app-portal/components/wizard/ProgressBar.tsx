"use client";

import { useState, useEffect } from "react";

interface Props {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const percent = mounted ? Math.round(((current + 1) / total) * 100) : 0;

  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>
          {mounted ? `Step ${current + 1} of ${total}` : "Loading..."}
        </span>
        <span>{percent}%</span>
      </div>
      <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
