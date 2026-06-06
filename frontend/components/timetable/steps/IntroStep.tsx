"use client";

import { useWizardStore } from "@/hooks/useWizardStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function IntroStep() {
  const { setStep } = useWizardStore();

  return (
    <Card className="p-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-full flex items-center justify-center">
          <i className="fa fa-calendar-alt text-3xl text-indigo-600"></i>
        </div>
        <h2 className="text-2xl font-semibold mb-2">
          Welcome to Timetable Setup
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Configure your school timetable settings, subjects, classes, and
          teachers.
        </p>
      </div>
      <div className="flex justify-center">
        <Button onClick={() => setStep("school")} size="lg">
          Start Setup
        </Button>
      </div>
    </Card>
  );
}
