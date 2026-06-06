"use client";

import { useWizardStore } from "@/hooks/useWizardStore";
import { COLORS, TITLES, GENDERS, Teacher } from "@/types/timetable";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function TeacherModal() {
  const {
    selectedTeacher,
    teacherModalType,
    setTeacherModalType,
    editItem,
    setEditItem,
    updateSelectedTeacher,
  } = useWizardStore();

  const isOpen = teacherModalType === "edit" && !!selectedTeacher;

  const handleUpdate = () => {
    if (editItem) {
      updateSelectedTeacher(editItem as Teacher);
      setTeacherModalType("");
      setEditItem(null);
      toast.success("Teacher updated");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && (setTeacherModalType(""), setEditItem(null))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Teacher</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

        <DialogFooter>
          <Button variant="outline" onClick={() => { setTeacherModalType(""); setEditItem(null); }}>
            Cancel
          </Button>
          <Button onClick={handleUpdate}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
