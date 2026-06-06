"use client";

import { useQuery } from "@tanstack/react-query";
import { useWizardStore } from "@/hooks/useWizardStore";
import { schoolApi, termApi } from "@/lib/api";
import { useEffect } from "react";
import Stepper from "./Stepper";
import ProgressBar from "../wizard/ProgressBar";
import { Card } from "@/components/ui/card";

import IntroStep from "./steps/IntroStep";
import SchoolStep from "./steps/SchoolStep";
import SubjectsStep from "./steps/SubjectsStep";
import ClassesStep from "./steps/ClassesStep";
import ClassroomsStep from "./steps/ClassroomsStep";
import TeachersStep from "./steps/TeachersStep";
import LessonsStep from "./steps/LessonsStep";
import GenerateStep from "./steps/GenerateStep";

import TeacherModal from "./modals/TeacherModal";
import TimeOffModal from "./modals/TimeOffModal";
import ConstraintsModal from "./modals/ConstraintsModal";
import GenericModal from "./modals/GenericModal";
import LessonModal from "./modals/LessonModal";

const STEP_ORDER = [
  "intro",
  "school",
  "subjects",
  "classes",
  "classrooms",
  "teachers",
  "lessons",
  "end",
] as const;

export default function WizardLayout() {
  const { step, _hydrated, hydrate, selectedTeachers, lessons, saveWizard } = useWizardStore();
  const currentStepIndex = STEP_ORDER.indexOf(step as (typeof STEP_ORDER)[number]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (selectedTeachers.length > 0 || lessons.length > 0) {
        saveWizard();
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [step, selectedTeachers, lessons, saveWizard]);

  const { data: schoolData } = useQuery({
    queryKey: ["school", "wizard"],
    queryFn: async () => {
      let schoolId = "";
      try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          schoolId = user?.schoolId || "";
        }
      } catch {}
      if (!schoolId) return null;
      try {
        const res = await schoolApi.getById(schoolId);
        const data = res.data?.data?.data || res.data?.data || res.data;
        return data || null;
      } catch (e) {
        return null;
      }
    },
    retry: 1,
    staleTime: 60 * 1000,
  });

  const { data: currentTerm } = useQuery({
    queryKey: ["current-term"],
    queryFn: async () => {
      try {
        const res = await termApi.getCurrent();
        let data = res.data?.data || res.data;
        if (Array.isArray(data)) return data[0];
        return data || null;
      } catch (e) {
        return null;
      }
    },
    retry: 1,
    staleTime: 60 * 1000,
  });

  const steps = [
    { key: "intro", label: "Introduction", icon: "👋" },
    { key: "school", label: "School", icon: "🏫" },
    { key: "subjects", label: "Subjects", icon: "📚" },
    { key: "classes", label: "Classes", icon: "👥" },
    { key: "classrooms", label: "Classrooms", icon: "🚪" },
    { key: "teachers", label: "Teachers", icon: "👨‍🏫" },
    { key: "lessons", label: "Lessons", icon: "📖" },
    { key: "end", label: "Generate", icon: "⚡" },
  ];

  if (!_hydrated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Card className="p-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">Timetable Setup</h1>
            <p className="text-sm text-muted-foreground">
              {schoolData?.name || "School"}
            </p>
          </div>
          <div className="text-right">
            <div className="font-medium">
              {currentTerm?.name || "No Term"}
            </div>
            <div className="text-xs text-muted-foreground">
              Academic Term
            </div>
          </div>
        </Card>

        <div className="sticky top-0 z-40 bg-gray-50 pt-2 pb-4">
          <ProgressBar current={currentStepIndex} total={steps.length} />
          <Stepper />
        </div>

        <div>
          {step === "intro" && <IntroStep />}
          {step === "school" && <SchoolStep />}
          {step === "subjects" && <SubjectsStep />}
          {step === "classes" && <ClassesStep />}
          {step === "classrooms" && <ClassroomsStep />}
          {step === "teachers" && <TeachersStep />}
          {step === "lessons" && <LessonsStep />}
          {step === "end" && <GenerateStep />}
        </div>
      </div>

      <TeacherModal />
      <TimeOffModal />
      <ConstraintsModal />
      <GenericModal />
      <LessonModal />
    </div>
  );
}
