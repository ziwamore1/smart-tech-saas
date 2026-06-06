"use client";

import { useState, useEffect } from "react";
import { useWizardStore } from "@/hooks/useWizardStore";
import { TeacherConstraints, DEFAULT_TEACHER_CONSTRAINTS } from "@/types/timetable";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function ConstraintsModal() {
  const {
    selectedTeacher,
    teacherModalType,
    setTeacherModalType,
    teacherConstraints,
    setTeacherConstraints,
  } = useWizardStore();

  const isOpen = teacherModalType === "constraints" && !!selectedTeacher;
  const defaultConstraints = DEFAULT_TEACHER_CONSTRAINTS;

  const [local, setLocal] = useState<TeacherConstraints>(defaultConstraints);

  useEffect(() => {
    if (selectedTeacher?.id) {
      const existing = teacherConstraints[selectedTeacher.id];
      setLocal(existing ? { ...existing } : { ...defaultConstraints });
    } else {
      setLocal({ ...defaultConstraints });
    }
  }, [selectedTeacher, teacherConstraints]);

  const numberOptions = Array.from({ length: 20 }, (_, i) => i);

  const handleSave = () => {
    if (!selectedTeacher) return;
    setTeacherConstraints(selectedTeacher.id, local);
    setTeacherModalType("");
    toast.success(`Constraints saved for ${selectedTeacher.firstName} ${selectedTeacher.lastName}`);
  };

  const handleCancel = () => {
    if (!selectedTeacher) return;
    const existing = teacherConstraints[selectedTeacher.id];
    setLocal(existing ? { ...existing } : { ...defaultConstraints });
    setTeacherModalType("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setTeacherModalType("")}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Constraints - {selectedTeacher?.firstName} {selectedTeacher?.lastName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Max Gaps/Week</label>
              <select
                value={local.maxGapsPerWeek}
                onChange={(e) => setLocal({ ...local, maxGapsPerWeek: +e.target.value })}
                className="w-full border p-2 rounded"
              >
                {numberOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Gaps/Day</label>
              <select
                value={local.maxGapsPerDay}
                onChange={(e) => setLocal({ ...local, maxGapsPerDay: +e.target.value })}
                className="w-full border p-2 rounded"
              >
                {numberOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Max Consecutive</label>
              <select
                value={local.maxConsecutivePeriods}
                onChange={(e) =>
                  setLocal({ ...local, maxConsecutivePeriods: +e.target.value })
                }
                className="w-full border p-2 rounded"
              >
                {numberOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max ? (Conditional)</label>
              <select
                value={local.maxQuestionMarks}
                onChange={(e) =>
                  setLocal({ ...local, maxQuestionMarks: +e.target.value })
                }
                className="w-full border p-2 rounded"
              >
                {numberOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Lessons From</label>
              <select
                value={local.minLessonsPerWeek}
                onChange={(e) =>
                  setLocal({ ...local, minLessonsPerWeek: +e.target.value })
                }
                className="w-full border p-2 rounded"
              >
                {numberOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Lessons Till</label>
              <select
                value={local.maxLessonsPerWeek}
                onChange={(e) =>
                  setLocal({ ...local, maxLessonsPerWeek: +e.target.value })
                }
                className="w-full border p-2 rounded"
              >
                {numberOptions.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max Days/Week</label>
            <select
              value={local.maxDaysPerWeek}
              onChange={(e) =>
                setLocal({ ...local, maxDaysPerWeek: +e.target.value })
              }
              className="w-full border p-2 rounded"
            >
              {numberOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Max Subject Periods/Day</label>
            <select
              value={local.maxSubjectPerDay}
              onChange={(e) =>
                setLocal({ ...local, maxSubjectPerDay: +e.target.value })
              }
              className="w-full border p-2 rounded"
            >
              {numberOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max Total Periods/Day</label>
            <select
              value={local.maxLessonsPerTeacherPerDay}
              onChange={(e) =>
                setLocal({ ...local, maxLessonsPerTeacherPerDay: +e.target.value })
              }
              className="w-full border p-2 rounded"
            >
              {numberOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
