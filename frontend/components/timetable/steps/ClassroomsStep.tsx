"use client";

import { useWizardStore } from "@/hooks/useWizardStore";
import { useClassrooms } from "@/hooks/useSubjects";
import { classroomApi } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Classroom } from "@/types/timetable";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Skeleton from "@/components/ui/Skeleton";
import StepNavigation from "@/components/timetable/StepNavigation";

export default function ClassroomsStep() {
  const { openModal } = useWizardStore();
  const { classrooms, isLoading } = useClassrooms();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => classroomApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      toast.success("Classroom deleted");
    },
    onError: () => toast.error("Failed to delete classroom"),
  });

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Classrooms</h2>
        <Button onClick={() => openModal("classroom")}>+ New Classroom</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : classrooms.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <p className="mb-4">No classrooms yet.</p>
          <Button onClick={() => openModal("classroom")} variant="outline">
            Add your first classroom
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(classrooms as Classroom[]).map((classroom) => (
            <Card
              key={classroom.id}
              className="bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-100 p-4 hover:shadow-md transition-shadow cursor-pointer group"
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-indigo-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 group-hover:bg-indigo-200 transition-colors">
                  🏫
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">
                    {classroom.name}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
                      {classroom.code || "N/A"}
                    </span>
                    {classroom.capacity && (
                      <span className="inline-flex items-center text-xs text-gray-500">
                        👥 {classroom.capacity}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate(classroom.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 p-2 transition-opacity"
                >
                  <i className="fa fa-trash text-sm"></i>
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <StepNavigation prevStep="classes" nextStep="teachers" />
    </Card>
  );
}
