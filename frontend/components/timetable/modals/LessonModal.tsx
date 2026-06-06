"use client";

import { useState } from "react";
import { useWizardStore } from "@/hooks/useWizardStore";
import { useTeachers } from "@/hooks/useTeachers";
import { useSubjects, useClasses, useClassrooms } from "@/hooks/useSubjects";
import type { Lesson, Subject, Classroom, Class } from "@/types/timetable";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Calendar, Settings } from "lucide-react";

const LESSON_TYPES = [
  { label: "Single", value: "single", periods: 1 },
  { label: "Double", value: "double", periods: 2 },
  { label: "Triple", value: "triple", periods: 3 },
  { label: "4x", value: "quadruple", periods: 4 },
  { label: "5x", value: "quintuple", periods: 5 },
  { label: "6x", value: "sextuple", periods: 6 },
  { label: "7x", value: "septuple", periods: 7 },
  { label: "8x", value: "octuple", periods: 8 },
];

export default function LessonModal() {
  const {
    modalOpen,
    modalType,
    newItem,
    editItem,
    closeModal,
    setNewItem,
    addLesson,
    updateLesson,
    setSelectedTeacher,
    setTeacherModalType,
    timeOffSchedule,
    teacherConstraints,
  } = useWizardStore();

  const { selectedTeachers } = useWizardStore();
  const { subjects } = useSubjects();
  const { classes } = useClasses();
  const { classrooms } = useClassrooms();

  const [classroomMode, setClassroomMode] = useState<string>("home");
  const [otherClassroomId, setOtherClassroomId] = useState("");

  const isOpen = modalOpen && modalType === "lesson";
  const isEditing = !!editItem;
  const currentData = editItem || newItem;

  const selectedTeacher = selectedTeachers.find((t) => t.id === currentData.teacherId);
  const hasTimeOff = selectedTeacher && timeOffSchedule[selectedTeacher.id];
  const hasConstraints = selectedTeacher && teacherConstraints[selectedTeacher.id];

  const lessonCount = currentData.lessonCount || 1;
  const lessonType = currentData.lessonType || "single";
  const periodsPerType = LESSON_TYPES.find((t) => t.value === lessonType)?.periods || 1;
  const totalPeriods = lessonCount * periodsPerType;

  const openTeacherTimeOff = (teacher: any) => {
    setSelectedTeacher(teacher);
    setTeacherModalType("timeoff");
  };

  const openTeacherConstraints = (teacher: any) => {
    setSelectedTeacher(teacher);
    setTeacherModalType("constraints");
  };

  const getSubjectName = (id: string) => {
    const s = subjects.find((s: Subject) => s.id === id);
    return s?.name || "";
  };

  const getClassName = (id: string) => {
    const c = (classes as Class[]).find((c) => c.id === id);
    return c?.name || "";
  };

  const getClassroomName = (id: string) => {
    const c = classrooms.find((c) => c.id === id);
    return c?.name || "";
  };

  const handleAdd = () => {
    if (!currentData.teacherId) return toast.error("Select a teacher");
    if (!currentData.subjectId) return toast.error("Select a subject");
    if (!currentData.classId) return toast.error("Select a class");
    if (!lessonCount || lessonCount < 1) return toast.error("Enter number of lessons");

    const classroomId = classroomMode === "other" ? otherClassroomId : undefined;

    const lesson: Lesson = {
      id: currentData.id || crypto.randomUUID(),
      teacherId: currentData.teacherId,
      subjectId: currentData.subjectId,
      classId: currentData.classId,
      lessonsPerWeek: totalPeriods,
      lessonCount,
      lessonType,
      teacherName: selectedTeacher ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}` : "",
      subjectName: getSubjectName(currentData.subjectId),
      className: getClassName(currentData.classId),
      classroomId,
      classroomName: classroomId ? getClassroomName(classroomId) : "",
    };

    if (isEditing && editItem?.id) {
      updateLesson(editItem.id, lesson);
      toast.success("Lesson updated");
    } else {
      addLesson(lesson);
      toast.success(`Added ${lessonCount}× ${LESSON_TYPES.find((t) => t.value === lessonType)?.label} lesson(s) (${totalPeriods} periods)`);
    }

    setNewItem({});
    setOtherClassroomId("");
    setClassroomMode("home");
    closeModal();
  };

  const handleLessonCountChange = (value: string) => {
    const count = parseInt(value);
    setNewItem({ ...newItem, lessonCount: isNaN(count) ? 1 : Math.max(1, Math.min(8, count)) });
  };

  const handleLessonTypeChange = (value: string) => {
    setNewItem({ ...newItem, lessonType: value });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit" : "Add"} Lesson
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Teacher</label>
            <div className="flex gap-2">
              <Select
                value={currentData.teacherId || ""}
                onValueChange={(v) => setNewItem({ ...newItem, teacherId: v })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select teacher..." />
                </SelectTrigger>
                <SelectContent>
                  {selectedTeachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                      {t.abbreviation ? ` (${t.abbreviation})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTeacher && (
                <div className="flex gap-1">
                  <button
                    onClick={() => openTeacherTimeOff(selectedTeacher)}
                    className={`p-2 rounded border transition-colors ${
                      hasTimeOff
                        ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                        : "border-border hover:bg-muted text-muted-foreground"
                    }`}
                    title="Set Time Off"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openTeacherConstraints(selectedTeacher)}
                    className={`p-2 rounded border transition-colors ${
                      hasConstraints
                        ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        : "border-border hover:bg-muted text-muted-foreground"
                    }`}
                    title="Set Constraints"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Subject</label>
            <Select
              value={currentData.subjectId || ""}
              onValueChange={(v) => setNewItem({ ...newItem, subjectId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select subject..." />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s: Subject) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.code ? ` (${s.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Class</label>
            <Select
              value={currentData.classId || ""}
              onValueChange={(v) => setNewItem({ ...newItem, classId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select class..." />
              </SelectTrigger>
              <SelectContent>
                {(classes as Class[]).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Lessons/Week</label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Count</label>
                <Input
                  type="number"
                  min={1}
                  max={8}
                  value={lessonCount}
                  onChange={(e) => handleLessonCountChange(e.target.value)}
                  className="text-center font-semibold"
                />
              </div>
              <div className="flex items-end pb-2 text-muted-foreground text-lg">×</div>
              <div className="flex-[2]">
                <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                <Select
                  value={lessonType}
                  onValueChange={handleLessonTypeChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {LESSON_TYPES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label} ({opt.periods} period{opt.periods > 1 ? "s" : ""})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <div className="text-center px-3 py-2 bg-muted rounded text-sm font-medium">
                  = {totalPeriods}
                  <div className="text-[10px] text-muted-foreground">periods</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Classroom</label>
            <div className="flex gap-2 mb-3 flex-wrap">
              {[
                { key: "home", label: "Home classroom" },
                { key: "teacher", label: "Teacher's classrooms" },
                { key: "subject", label: "Subject's classrooms" },
                { key: "other", label: "More classrooms" },
              ].map((mode) => (
                <button
                  key={mode.key}
                  onClick={() => setClassroomMode(mode.key)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    classroomMode === mode.key
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "hover:bg-muted border-border"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {classroomMode === "other" && (
              <Select
                value={otherClassroomId}
                onValueChange={(v) => {
                  setOtherClassroomId(v);
                  setNewItem({ ...newItem, classroomId: v });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select classroom..." />
                </SelectTrigger>
                <SelectContent>
                  {classrooms.map((c: Classroom) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeModal}>Cancel</Button>
          <Button onClick={handleAdd}>
            {isEditing ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
