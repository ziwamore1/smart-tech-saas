"use client";

import { useWizardStore } from "@/hooks/useWizardStore";
import { useTeachers } from "@/hooks/useTeachers";
import { useSubjects, useClasses, useClassrooms } from "@/hooks/useSubjects";
import { Button } from "@/components/ui/button";
import type { WizardStep } from "@/types/timetable";
import { toast } from "sonner";
import { validateStep } from "@/lib/validation";

interface StepNavigationProps {
  prevStep: WizardStep;
  nextStep: WizardStep;
  onNext?: () => void;
  onPrev?: () => void;
  nextLabel?: string;
  prevLabel?: string;
  validate?: boolean;
}

export default function StepNavigation({
  prevStep,
  nextStep,
  onNext,
  onPrev,
  nextLabel = "Next",
  prevLabel = "Previous",
  validate = true,
}: StepNavigationProps) {
  const { setStep, settings, selectedTeachers, lessons } = useWizardStore();
  const { subjects } = useSubjects();
  const { classes } = useClasses();
  const { classrooms } = useClassrooms();

  const handleNext = () => {
    if (validate) {
      const errors = validateStep(nextStep, {
        subjects,
        classes,
        classrooms,
        teachers: selectedTeachers,
        lessons,
        settings,
      });

      if (errors.length > 0) {
        toast.error(errors[0]);
        return;
      }
    }

    onNext?.();
    setStep(nextStep);
  };

  const handlePrev = () => {
    onPrev?.();
    setStep(prevStep);
  };

  return (
    <div className="sticky bottom-0 bg-white border-t mt-6 -mx-6 px-6 py-4 flex justify-between">
      <Button
        variant="outline"
        onClick={handlePrev}
      >
        {prevLabel}
      </Button>
      <Button
        onClick={handleNext}
      >
        {nextLabel}
      </Button>
    </div>
  );
}
