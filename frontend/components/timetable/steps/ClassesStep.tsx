"use client";

import { useState } from "react";
import { useWizardStore } from "@/hooks/useWizardStore";
import { useClasses } from "@/hooks/useSubjects";
import { classApi } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Class } from "@/types/timetable";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Skeleton from "@/components/ui/Skeleton";
import StepNavigation from "@/components/timetable/StepNavigation";
import ErrorState from "@/components/ui/ErrorState";

export default function ClassesStep() {
  const { openModal } = useWizardStore();
  const { classes, isLoading } = useClasses();
  const queryClient = useQueryClient();
  const [classesError, setClassesError] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => classApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class deleted");
    },
    onError: () => {
      toast.error("Failed to delete class");
      setClassesError(true);
    },
  });

  if (classesError) {
    return (
      <Card className="p-6">
        <ErrorState
          message="Failed to load classes"
          onRetry={() => {
            setClassesError(false);
            queryClient.invalidateQueries({ queryKey: ["classes"] });
          }}
        />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Classes</h2>
        <Button onClick={() => openModal("class")}>+ New Class</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <p className="mb-4">No classes yet.</p>
          <Button onClick={() => openModal("class")} variant="outline">
            Add your first class
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {(classes as Class[]).map((cls) => (
            <Card
              key={cls.id}
              className="p-3 flex items-center justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="font-medium text-sm">{cls.name}</div>
                {(cls as any).code && (
                  <div className="text-xs text-muted-foreground">{(cls as any).code}</div>
                )}
              </div>
              <button
                onClick={() => deleteMutation.mutate(cls.id)}
                className="text-red-500 hover:text-red-700 p-1"
              >
                <i className="fa fa-trash text-sm"></i>
              </button>
            </Card>
          ))}
        </div>
      )}

      <StepNavigation prevStep="subjects" nextStep="classrooms" />
    </Card>
  );
}
