"use client";

import { useState, useEffect } from "react";
import { useWizardStore } from "@/hooks/useWizardStore";
import { Badge } from "@/components/ui/badge";
import { WIZARD_STEPS } from "@/types/timetable";

export default function Stepper() {
  const { step, setStep } = useWizardStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {WIZARD_STEPS.map((s) => (
        <Badge
          key={s.key}
          variant={mounted && step === s.key ? "default" : "secondary"}
          className="cursor-pointer shrink-0 text-xs px-3 py-1.5"
          onClick={() => setStep(s.key)}
        >
          {s.icon} {s.label}
        </Badge>
      ))}
    </div>
  );
}
