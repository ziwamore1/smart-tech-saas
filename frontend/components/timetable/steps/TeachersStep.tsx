"use client";

import { useState } from "react";
import { DndContext, DragEndEvent, closestCorners } from "@dnd-kit/core";
import { useWizardStore } from "@/hooks/useWizardStore";
import { useTeachers } from "@/hooks/useTeachers";
import { useBulkActions } from "@/hooks/useBulkActions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { teacherApi } from "@/lib/api";
import { Teacher, COLORS, TITLES, GENDERS } from "@/types/timetable";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Skeleton from "@/components/ui/Skeleton";
import TeacherSelector from "@/components/teacher/TeacherSelector";
import StepNavigation from "@/components/timetable/StepNavigation";
import TeacherDragItem from "@/components/dnd/TeacherDragItem";
import VirtualTeacherList from "@/components/virtual/VirtualTeacherList";
import { Trash2, Users, Zap, List } from "lucide-react";

export default function TeachersStep() {
  const {
    setStep,
    openModal,
    selectedTeachers,
    addTeacher,
    removeTeacher,
    updateSelectedTeacher,
    selectedTeacher,
    setSelectedTeacher,
    teacherModalType,
    setTeacherModalType,
    editItem,
    setEditItem,
  } = useWizardStore();

  const { teachers, isLoading } = useTeachers();
  const queryClient = useQueryClient();
  const [showVirtual, setShowVirtual] = useState(false);

  const saveTeacherMutation = useMutation({
    mutationFn: (data: any) => teacherApi.create(data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      if (data?.data) addTeacher(data.data);
      toast.success("Teacher created successfully");
    },
    onError: () => toast.error("Failed to create teacher"),
  });

  const {
    selectedIds,
    toggleSelect,
    selectAllItems,
    clearSelection,
    isSelected,
    executeBulkAction,
    hasSelection,
    selectionCount,
  } = useBulkActions<Teacher>({
    items: selectedTeachers,
    getId: (t) => t.id,
    onBulkAction: (action, ids) => {
      if (action === "remove") {
        ids.forEach((id) => removeTeacher(id));
        toast.success(`${ids.length} teachers removed`);
        clearSelection();
      }
    },
  });

  const handleDelete = (id: string) => {
    removeTeacher(id);
    toast.info("Teacher removed from selection");
  };

  const handleUpdateTeacher = () => {
    if (editItem) {
      updateSelectedTeacher(editItem as Teacher);
      setTeacherModalType("");
      setSelectedTeacher(null);
      setEditItem(null);
      toast.success("Teacher updated");
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const teacherId = active.id.toString().replace("teacher-", "");
    const targetClassId = over.id.toString().replace("class-drop-", "");

    if (teacherId && targetClassId) {
      toast.success(`Teacher ${teacherId} assigned to class ${targetClassId}`);
    }
  };

  return (
    <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">Teachers</h2>
            <Badge variant="secondary">{selectedTeachers.length} selected</Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVirtual(!showVirtual)}
            >
              <List className="w-4 h-4 mr-1" />
              {showVirtual ? "Standard" : "Virtual"}
            </Button>
            {selectedTeachers.length > 10 && (
              <Button variant="outline" size="sm" onClick={() => toast.info("Auto-assign coming soon")}>
                <Zap className="w-4 h-4 mr-1" />
                Auto-Assign
              </Button>
            )}
          </div>
        </div>

        {hasSelection && (
          <Card className="p-3 mb-4 bg-indigo-50 border-indigo-200 flex items-center justify-between">
            <span className="text-sm font-medium">{selectionCount} teachers selected</span>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={() => executeBulkAction("remove")}>
                <Trash2 className="w-4 h-4 mr-1" />
                Remove Selected
              </Button>
              <Button size="sm" variant="outline" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          </Card>
        )}

        <div className="mb-4">
          <h3 className="text-sm font-medium mb-2">Import Teachers</h3>
          {isLoading ? (
            <Skeleton count={3} className="h-14 w-full" />
          ) : (
            <TeacherSelector
              teachers={teachers as Teacher[]}
              selected={selectedTeachers}
              onAdd={(t: Teacher) => {
                if (!selectedTeachers.find((x) => x.id === t.id)) {
                  addTeacher(t);
                  toast.success(`${t.firstName} ${t.lastName} added`);
                }
              }}
            />
          )}
        </div>

        <div className="flex gap-2 mb-6">
          <Button onClick={() => { setEditItem({}); openModal("teacher"); }}>
            + New Teacher
          </Button>
          {selectedTeachers.length > 0 && (
            <Button variant="outline" onClick={selectAllItems}>
              Select All
            </Button>
          )}
        </div>

        {selectedTeachers.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            Select or create teachers above.
          </Card>
        ) : showVirtual ? (
          <VirtualTeacherList
            teachers={selectedTeachers}
            onRemove={handleDelete}
            height={400}
          />
        ) : (
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {selectedTeachers.map((teacher) => (
              <div key={teacher.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isSelected(teacher.id)}
                  onChange={() => toggleSelect(teacher.id)}
                  className="w-4 h-4 mt-1"
                />
                <div className="flex-1">
                  <TeacherDragItem teacher={teacher} />
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setSelectedTeacher(teacher);
                      setTeacherModalType("edit");
                      setEditItem({ ...teacher });
                    }}
                    className="px-2 py-1 text-xs border rounded hover:bg-muted/50"
                    title="Edit"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(teacher.id)}
                    className="px-2 py-1 text-xs border rounded text-red-600 hover:bg-red-50"
                    title="Remove"
                  >
                    Remove
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTeacher(teacher);
                      setTeacherModalType("timeoff");
                    }}
                    className="px-2 py-1 text-xs border rounded hover:bg-muted/50"
                    title="Time Off"
                  >
                    Time Off
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTeacher(teacher);
                      setTeacherModalType("constraints");
                    }}
                    className="px-2 py-1 text-xs border rounded hover:bg-muted/50"
                    title="Constraints"
                  >
                    Constraints
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <StepNavigation prevStep="classrooms" nextStep="lessons" />

        {teacherModalType === "edit" && selectedTeacher && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
              <div className="p-4 border-b flex justify-between items-center">
                <h3 className="font-semibold text-lg">Edit Teacher</h3>
                <button
                  onClick={() => setTeacherModalType("")}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Title</label>
                    <select
                      value={editItem?.title || ""}
                      onChange={(e) => setEditItem({ ...editItem, title: e.target.value })}
                      className="w-full border p-2 rounded"
                    >
                      <option value="">Select...</option>
                      {TITLES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Gender</label>
                    <select
                      value={editItem?.gender || ""}
                      onChange={(e) => setEditItem({ ...editItem, gender: e.target.value })}
                      className="w-full border p-2 rounded"
                    >
                      <option value="">Select...</option>
                      {GENDERS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">First Name</label>
                    <input
                      type="text"
                      value={editItem?.firstName || ""}
                      onChange={(e) =>
                        setEditItem({ ...editItem, firstName: e.target.value })
                      }
                      className="w-full border p-2 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Last Name</label>
                    <input
                      type="text"
                      value={editItem?.lastName || ""}
                      onChange={(e) =>
                        setEditItem({ ...editItem, lastName: e.target.value })
                      }
                      className="w-full border p-2 rounded"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-1">Abbreviation</label>
                  <input
                    type="text"
                    value={editItem?.abbreviation || ""}
                    onChange={(e) =>
                      setEditItem({
                        ...editItem,
                        abbreviation: e.target.value.toUpperCase(),
                      })
                    }
                    maxLength={4}
                    className="w-full border p-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditItem({ ...editItem, color: c })}
                        className={`w-8 h-8 rounded-lg ${
                          editItem?.color === c
                            ? "ring-2 ring-offset-2 ring-indigo-600"
                            : ""
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-2">
                <button
                  onClick={() => setTeacherModalType("")}
                  className="px-4 py-2 border rounded-lg hover:bg-muted/50"
                >
                  Cancel
                </button>
                <Button onClick={handleUpdateTeacher}>
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </DndContext>
  );
}
