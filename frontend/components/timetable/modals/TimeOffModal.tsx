"use client";

import { useState, useEffect } from "react";
import { useWizardStore } from "@/hooks/useWizardStore";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type TimeOffStatus = "available" | "conditional" | "unavailable";

export default function TimeOffModal() {
  const {
    selectedTeacher,
    teacherModalType,
    setTeacherModalType,
    settings,
    timeOffSchedule,
    setTimeOffSchedule,
  } = useWizardStore();

  const isOpen = teacherModalType === "timeoff" && !!selectedTeacher;

  const [localSchedule, setLocalSchedule] = useState<
    Record<string, Record<string, TimeOffStatus>>
  >({});

  useEffect(() => {
    if (selectedTeacher?.id) {
      const existing = timeOffSchedule[selectedTeacher.id];
      setLocalSchedule(existing ? JSON.parse(JSON.stringify(existing)) : {});
    } else {
      setLocalSchedule({});
    }
  }, [selectedTeacher, timeOffSchedule]);

  const days = settings.days.slice(0, settings.daysPerWeek);
  const periods = Array.from({ length: settings.periodsPerDay }, (_, i) => i + 1);

  const toggleSlot = (day: string, period: number) => {
    const daySchedule = localSchedule[day] || {};
    const current = daySchedule[period] || "available";
    const next: TimeOffStatus =
      current === "available"
        ? "unavailable"
        : current === "unavailable"
        ? "conditional"
        : "available";
    setLocalSchedule({
      ...localSchedule,
      [day]: { ...daySchedule, [period]: next },
    });
  };

  const getSymbol = (status: TimeOffStatus) =>
    status === "available" ? "✓" : status === "conditional" ? "?" : "✗";

  const getColor = (status: TimeOffStatus) =>
    status === "available"
      ? "bg-green-100 text-green-700"
      : status === "conditional"
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";

  const handleSave = () => {
    if (!selectedTeacher) return;
    setTimeOffSchedule(selectedTeacher.id, localSchedule);
    setTeacherModalType("");
    toast.success(`Schedule saved for ${selectedTeacher.firstName} ${selectedTeacher.lastName}`);
  };

  const handleCancel = () => {
    if (!selectedTeacher) return;
    const existing = timeOffSchedule[selectedTeacher.id];
    setLocalSchedule(existing ? JSON.parse(JSON.stringify(existing)) : {});
    setTeacherModalType("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && setTeacherModalType("")}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Time Off - {selectedTeacher?.title}{" "}
            {selectedTeacher?.firstName} {selectedTeacher?.lastName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Click: ✓ Available | ? Conditional | ✗ Not Available
          </p>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border p-2 bg-gray-50 text-sm">Period</th>
                {days.map((d) => (
                  <th key={d.name} className="border p-2 bg-gray-50 text-sm">
                    {d.shortName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period}>
                  <td className="border p-2 bg-gray-50 text-center font-medium">
                    P{period}
                  </td>
                  {days.map((d) => {
                    const status = (localSchedule[d.name]?.[period] as TimeOffStatus) || "available";
                    return (
                      <td
                        key={d.name}
                        className={`border p-1 text-center cursor-pointer ${getColor(status)}`}
                        onClick={() => toggleSlot(d.name, period)}
                      >
                        {getSymbol(status)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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
