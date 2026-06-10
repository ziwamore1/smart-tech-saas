"use client";

import { useState, useEffect } from "react";
import { useWizardStore } from "@/hooks/useWizardStore";
import { useClasses, useClassrooms } from "@/hooks/useSubjects";
import { timetableApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import StepNavigation from "@/components/timetable/StepNavigation";
import { Loader2, Save } from "lucide-react";

export default function GenerateStep() {
  const {
    setStep,
    settings,
    selectedTeachers,
    lessons,
    teacherConstraints,
    isGenerating,
    generateProgress,
    setIsGenerating,
    setGenerateProgress,
    saveWizard,
  } = useWizardStore();
  const { classes } = useClasses();
  const { classrooms } = useClassrooms();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSave = () => {
    saveWizard();
    toast.success("Wizard progress saved!");
  };

  const handleGenerate = async () => {
    const classList = classes || [];
    if (classList.length === 0) {
      toast.error("Please add at least one class");
      return;
    }

    if (selectedTeachers.length === 0) {
      toast.error("Please select at least one teacher");
      return;
    }

    if (lessons.length === 0) {
      toast.error("Please create at least one lesson assignment");
      return;
    }

    const toastId = toast.loading("Fetching term info...");
    setIsGenerating(true);
    setGenerateProgress(0);

    try {
      const currentTermRes = await timetableApi.getCurrentTerm();
      const term = currentTermRes?.data?.data || currentTermRes?.data;
      const currentTermId = term?.id;

      if (!currentTermId) {
        toast.error("No active term found. Please set up an academic term first.", { id: toastId });
        setIsGenerating(false);
        setGenerateProgress(0);
        return;
      }

      toast.loading("Preparing lesson requirements...", { id: toastId });
      setGenerateProgress(5);

      const classesWithLessons = new Set(lessons.map(l => l.classId));
      const classesToGenerate = classList.filter(c => classesWithLessons.has(c.id));

      if (classesToGenerate.length === 0) {
        toast.error("No lessons assigned to any class");
        setIsGenerating(false);
        setGenerateProgress(0);
        return;
      }

      console.log('[GenerateStep] Classes with lessons:', classesToGenerate.map(c => ({ id: c.id, name: c.name })));

      const lessonsByClass = new Map<string, typeof lessons>();
      for (const lesson of lessons) {
        const arr = lessonsByClass.get(lesson.classId) || [];
        arr.push(lesson);
        lessonsByClass.set(lesson.classId, arr);
      }

      for (const [classId, classLessons] of lessonsByClass.entries()) {
        const className = classList.find(c => c.id === classId)?.name || classId;
        const totalPeriods = classLessons.reduce((sum, l) => sum + (l.lessonsPerWeek || 0), 0);
        console.log(`[GenerateStep] Class "${className}": ${classLessons.length} lesson entries, ${totalPeriods} periods/week`);
      }

      for (let i = 0; i < classesToGenerate.length; i++) {
        const cls = classesToGenerate[i];
        try {
          await timetableApi.deleteLessonRequirementsByClass(cls.id);
        } catch (e) {
          console.error(`Failed to clear old requirements for ${cls.name}:`, e);
        }
      }

      let savedCount = 0;
      const totalLessons = lessons.length;
      let failedCount = 0;
      for (const lesson of lessons) {
        savedCount++;
        setGenerateProgress(5 + Math.floor((savedCount / totalLessons) * 20));
        try {
          const payload = {
            classId: lesson.classId,
            subjectId: lesson.subjectId,
            teacherId: lesson.teacherId,
            lessonsPerWeek: lesson.lessonsPerWeek,
            lessonType: lesson.lessonType || 'single',
          };
          console.log('[GenerateStep] Saving requirement:', payload);
          const res = await timetableApi.createLessonRequirement(payload);
          console.log('[GenerateStep] Created:', res.data?.data || res.data);
        } catch (e: any) {
          failedCount++;
          const msg = e.response?.data?.message || e.message || "Unknown";
          console.error(`[GenerateStep] Failed to save lesson requirement:`, msg, lesson);
          toast.error(`Failed to save requirement: ${msg}`, { id: toastId, duration: 5000 });
          setIsGenerating(false);
          setGenerateProgress(0);
          return;
        }
      }

      if (failedCount > 0) {
        toast.error(`${failedCount} of ${totalLessons} requirements failed to save`, { id: toastId });
        setIsGenerating(false);
        setGenerateProgress(0);
        return;
      }

      toast.info(`Saved ${totalLessons} requirements, generating...`, { id: toastId });

      toast.loading("Generating timetable...", { id: toastId });
      setGenerateProgress(30);

      for (let i = 0; i < classesToGenerate.length; i++) {
        const cls = classesToGenerate[i];
        setGenerateProgress(30 + Math.floor((i / classesToGenerate.length) * 60));
        try {
          await timetableApi.generateTimetable(cls.id, currentTermId, teacherConstraints);
        } catch (e: any) {
          const msg = e.response?.data?.message || e.message || "Unknown error";
          toast.error(`Failed for ${cls.name}: ${msg}`, { id: toastId });
          console.error(`Failed to generate for class ${cls.name}:`, e);
          setIsGenerating(false);
          setGenerateProgress(0);
          return;
        }
      }

      setGenerateProgress(100);
      toast.success("Timetable generated successfully!", { id: toastId });

      const firstClassId = classesToGenerate[0]?.id;
      router.push(`/view-timetable`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || "Generation failed", { id: toastId });
    } finally {
      setIsGenerating(false);
      setGenerateProgress(0);
    }
  };

  return (
    <Card className="p-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-full flex items-center justify-center">
          <i className="fa fa-calendar-alt text-3xl text-indigo-600"></i>
        </div>
        <h2 className="text-2xl font-semibold mb-2">Timetable Setup</h2>
        <p className="text-muted-foreground mb-8">Your timetable is ready to generate.</p>
        {mounted && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <Card className="p-4 bg-gray-50">
                <div className="text-2xl font-bold text-indigo-600">
                  {settings.periodsPerDay}
                </div>
                <div className="text-sm text-muted-foreground">Periods/Day</div>
              </Card>
              <Card className="p-4 bg-gray-50">
                <div className="text-2xl font-bold text-indigo-600">
                  {classes?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Classes</div>
              </Card>
              <Card className="p-4 bg-gray-50">
                <div className="text-2xl font-bold text-indigo-600">
                  {selectedTeachers.length}
                </div>
                <div className="text-sm text-muted-foreground">Teachers</div>
              </Card>
              <Card className="p-4 bg-gray-50">
                <div className="text-2xl font-bold text-indigo-600">
                  {lessons.length}
                </div>
                <div className="text-sm text-muted-foreground">Lessons</div>
              </Card>
            </div>

            <div className="flex justify-center gap-3">
              <Button onClick={handleSave} variant="outline" size="lg" className="gap-2">
                <Save className="w-4 h-4" />
                Save Progress
              </Button>
              {isGenerating ? (
                <Button disabled size="lg" className="gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </Button>
              ) : (
                <Button onClick={handleGenerate} size="lg" className="gap-2">
                  <i className="fa fa-bolt"></i>
                  Generate Timetable
                </Button>
              )}
            </div>

            {isGenerating && (
              <div className="mt-4 space-y-3">
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-green-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${generateProgress}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Generating... {generateProgress}%
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <StepNavigation prevStep="lessons" nextStep="lessons" />
    </Card>
  );
}
