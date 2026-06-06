"use client";

import { useState } from "react";
import { useWizardStore } from "@/hooks/useWizardStore";
import { useSubjects } from "@/hooks/useSubjects";
import { subjectApi } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Subject } from "@/types/timetable";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Skeleton from "@/components/ui/Skeleton";
import StepNavigation from "@/components/timetable/StepNavigation";
import ErrorState from "@/components/ui/ErrorState";

export default function SubjectsStep() {
  const { setStep, openModal } = useWizardStore();
  const { subjects, isLoading } = useSubjects();
  const queryClient = useQueryClient();
  const [subjectsError, setSubjectsError] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subjectApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Subject deleted");
    },
    onError: () => {
      toast.error("Failed to delete subject");
      setSubjectsError(true);
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Delete this subject?")) {
      deleteMutation.mutate(id);
    }
  };

  if (subjectsError) {
    return (
      <Card className="p-6">
        <ErrorState
          message="Failed to load subjects"
          onRetry={() => {
            setSubjectsError(false);
            queryClient.invalidateQueries({ queryKey: ["subjects"] });
          }}
        />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Subjects</h2>
        <Button onClick={() => openModal("subject")}>+ New Subject</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <p className="mb-4">No subjects yet.</p>
          <Button onClick={() => openModal("subject")} variant="outline">
            Add your first subject
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {(subjects as Subject[]).map((subject) => (
            <Card
              key={subject.id}
              className="p-3 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer"
            >
              <div>
                <div className="font-medium text-sm">{subject.name}</div>
                {(subject as any).code && (
                  <div className="text-xs text-muted-foreground">{(subject as any).code}</div>
                )}
              </div>
              <button
                onClick={() => handleDelete(subject.id)}
                className="text-red-500 hover:text-red-700 p-1"
              >
                <i className="fa fa-trash text-sm"></i>
              </button>
            </Card>
          ))}
        </div>
      )}

      <StepNavigation prevStep="school" nextStep="classes" />
    </Card>
  );
}
