"use client";

import { useWizardStore } from "@/hooks/useWizardStore";
import { subjectApi, classApi, api, teacherApi } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { COLORS, TITLES, GENDERS } from "@/types/timetable";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function GenericModal() {
  const {
    modalOpen,
    modalType,
    newItem,
    editItem,
    closeModal,
    setNewItem,
    setEditItem,
  } = useWizardStore();
  const queryClient = useQueryClient();

  const [schoolData, setSchoolData] = useState<any>(null);

  useEffect(() => {
    const fetchSchool = async () => {
      try {
        const userStr = localStorage.getItem("user");
        if (!userStr) return;
        const user = JSON.parse(userStr);
        const schoolId = user?.schoolId || "";
        if (!schoolId) return;

        const res = await api.get("/school/");
        const outerData = res.data?.data || res.data;
        const schoolsData = outerData?.data || outerData;
        const school = Array.isArray(schoolsData)
          ? schoolsData.find((s: any) => s.id === schoolId)
          : null;
        setSchoolData(school);
      } catch {}
    };
    fetchSchool();
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      switch (modalType) {
        case "subject":
          return subjectApi.create(data);
        case "class":
          return classApi.create(data);
        case "classroom":
          return api.post("/classrooms", { ...data, schoolId: schoolData?.id });
        case "teacher": {
          const email = `${data.firstName?.toLowerCase()}.${data.lastName?.toLowerCase()}@${schoolData?.name?.toLowerCase().replace(/\s+/g, "") || "school"}.edu`;
          const password = `Teacher@${Date.now().toString().slice(-4)}`;
          return teacherApi.create({ ...data, email, password });
        }
        default:
          throw new Error("Unknown modal type");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      closeModal();
      toast.success(`${modalType.charAt(0).toUpperCase() + modalType.slice(1)} created`);
    },
    onError: () => toast.error(`Failed to create ${modalType}`),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      switch (modalType) {
        case "subject":
          return subjectApi.update(data.id, data);
        case "class":
          return classApi.update(data.id, data);
        case "classroom":
          return api.patch(`/classrooms/${data.id}`, {
            ...data,
            schoolId: schoolData?.id,
          });
        case "teacher":
          return teacherApi.update(data.id, data);
        default:
          throw new Error("Unknown modal type");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["classrooms"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      setEditItem(null);
      closeModal();
      toast.success(`${modalType.charAt(0).toUpperCase() + modalType.slice(1)} updated`);
    },
    onError: () => toast.error(`Failed to update ${modalType}`),
  });

  const handleSave = () => {
    const data = editItem || { ...newItem };
    if (modalType !== "classroom" && modalType !== "teacher") {
      data.schoolId = schoolData?.id;
    }
    if (editItem) {
      updateMutation.mutate(data);
    } else {
      saveMutation.mutate(data);
    }
  };

  const updateField = (field: string, value: any) => {
    const target = editItem || newItem;
    const updated = { ...target, [field]: value };
    if (editItem) {
      setEditItem(updated);
    } else {
      setNewItem(updated);
    }
  };

  const currentData = editItem || newItem;

  return (
    <Dialog open={modalOpen} onOpenChange={(open) => !open && (closeModal(), setEditItem(null))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editItem ? "Edit" : "Add"} {modalType.charAt(0).toUpperCase() + modalType.slice(1)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {modalType === "teacher" ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1">Title</label>
                  <select
                    value={currentData.title || ""}
                    onChange={(e) => updateField("title", e.target.value)}
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
                    value={currentData.gender || ""}
                    onChange={(e) => updateField("gender", e.target.value)}
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
                    value={currentData.firstName || ""}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    className="w-full border p-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Last Name</label>
                  <input
                    type="text"
                    value={currentData.lastName || ""}
                    onChange={(e) => updateField("lastName", e.target.value)}
                    className="w-full border p-2 rounded"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => updateField("color", c)}
                      className={`w-8 h-8 rounded-lg ${
                        currentData.color === c
                          ? "ring-2 ring-offset-2 ring-indigo-600"
                          : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : modalType === "classroom" ? (
            <>
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input
                  type="text"
                  value={currentData.name || ""}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Code</label>
                <input
                  type="text"
                  value={currentData.code || ""}
                  onChange={(e) => updateField("code", e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Capacity</label>
                <input
                  type="number"
                  value={currentData.capacity || ""}
                  onChange={(e) => updateField("capacity", +e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm mb-1">Name</label>
                <input
                  type="text"
                  value={currentData.name || ""}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Code</label>
                <input
                  type="text"
                  value={currentData.code || ""}
                  onChange={(e) => updateField("code", e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { closeModal(); setEditItem(null); }}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending || updateMutation.isPending}>
            {editItem ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
