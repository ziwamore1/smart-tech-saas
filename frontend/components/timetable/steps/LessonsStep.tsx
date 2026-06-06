"use client";

import { useWizardStore } from "@/hooks/useWizardStore";
import { useTeachers } from "@/hooks/useTeachers";
import { useSubjects, useClasses, useClassrooms } from "@/hooks/useSubjects";
import type { Lesson, Subject, Class, Teacher } from "@/types/timetable";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import StepNavigation from "@/components/timetable/StepNavigation";
import { Plus, Trash2, Calendar, Settings } from "lucide-react";

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

const getLessonLabel = (lesson: Lesson) => {
  if (lesson.lessonCount && lesson.lessonType) {
    const count = lesson.lessonCount;
    const type = LESSON_TYPES.find((t) => t.value === lesson.lessonType);
    return `${count}× ${type?.label || lesson.lessonType}`;
  }
  const opt = LESSON_TYPES.find((t) => t.periods === lesson.lessonsPerWeek);
  return opt?.label || `${lesson.lessonsPerWeek}x`;
};

export default function LessonsStep() {
  const {
    lessons,
    removeLesson,
    selectedTeachers,
    openModal,
    setNewItem,
    setEditItem,
    setSelectedTeacher,
    setTeacherModalType,
    timeOffSchedule,
    teacherConstraints,
  } = useWizardStore();

  const { subjects } = useSubjects();
  const { classes } = useClasses();
  const { classrooms } = useClassrooms();

  const getTeacherName = (id: string) => {
    const t = selectedTeachers.find((t) => t.id === id);
    return t ? `${t.firstName} ${t.lastName}` : id;
  };

  const getTeacherById = (id: string): Teacher | undefined => {
    return selectedTeachers.find((t) => t.id === id);
  };

  const getSubjectName = (id: string) => {
    const s = subjects.find((s: Subject) => s.id === id);
    return s?.name || id;
  };

  const getClassName = (id: string) => {
    const c = (classes as Class[]).find((c) => c.id === id);
    return c?.name || id;
  };

  const handleAdd = () => {
    setEditItem(null);
    setNewItem({});
    openModal("lesson");
  };

  const handleRemove = (id: string) => {
    removeLesson(id);
    toast.info("Lesson removed");
  };

  const openTimeOff = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setTeacherModalType("timeoff");
  };

  const openConstraints = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setTeacherModalType("constraints");
  };

  const totalPeriods = lessons.reduce((sum, l) => sum + (l.lessonsPerWeek || 0), 0);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Lessons</h2>
          <p className="text-sm text-muted-foreground">
            {lessons.length} lessons, {totalPeriods} periods/week total
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-1" />
          Add Lesson
        </Button>
      </div>

      {lessons.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <p className="mb-4">No lessons configured yet.</p>
          <Button onClick={handleAdd} variant="outline">
            <Plus className="w-4 h-4 mr-1" />
            Add your first lesson
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {lessons.map((lesson) => {
            const teacher = getTeacherById(lesson.teacherId);
            return (
              <Card key={lesson.id} className="p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 flex-wrap">
                    <div
                      className="flex items-center gap-1 cursor-pointer hover:bg-muted rounded px-2 py-1 transition-colors group"
                      title="Click to configure teacher"
                    >
                      <Badge variant="default" className="text-xs">
                        {getTeacherName(lesson.teacherId)}
                      </Badge>
                      {teacher && (
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openTimeOff(teacher)}
                            className="p-0.5 hover:text-green-600"
                            title="Set Time Off"
                          >
                            <Calendar className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => openConstraints(teacher)}
                            className="p-0.5 hover:text-blue-600"
                            title="Set Constraints"
                          >
                            <Settings className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="text-muted-foreground text-xs">→</span>
                    <Badge variant="secondary" className="text-xs">
                      {getSubjectName(lesson.subjectId)}
                    </Badge>
                    <span className="text-muted-foreground text-xs">→</span>
                    <Badge variant="outline" className="text-xs">
                      {getClassName(lesson.classId)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <Badge className="text-xs shrink-0">
                      {getLessonLabel(lesson)}
                    </Badge>
                    {lesson.classroomName && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {lesson.classroomName}
                      </span>
                    )}
                    <button
                      onClick={() => handleRemove(lesson.id!)}
                      className="p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <StepNavigation prevStep="teachers" nextStep="end" />
    </Card>
  );
}
