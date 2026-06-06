"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import MasterTimetableMatrix from "@/components/timetable/MasterTimetableMatrix";
import { schoolApi, termApi } from "@/lib/api";
import Link from "next/link";

function getSchoolId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const user = JSON.parse(userStr);
      return user?.schoolId || null;
    }
  } catch {}
  return null;
}

export default function MasterTimetablePage() {
  const [schoolId, setSchoolId] = useState<string>("");

  useEffect(() => {
    const sid = getSchoolId();
    if (sid) setSchoolId(sid);
  }, []);

  const { data: terms } = useQuery({
    queryKey: ["master-page-terms"],
    queryFn: async () => {
      const res = await termApi.getAll();
      return res.data?.data || res.data || [];
    },
    enabled: !!schoolId,
  });

  const currentTerm = Array.isArray(terms)
    ? terms.find((t: any) => t.isCurrent) || terms[0]
    : null;
  const [selectedTermId, setSelectedTermId] = useState<string>("");

  useEffect(() => {
    if (currentTerm?.id && !selectedTermId) {
      setSelectedTermId(currentTerm.id);
    }
  }, [currentTerm?.id]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/dashboard" className="hover:text-blue-600">
            Dashboard
          </Link>
          <span>/</span>
          <span>Master Timetable</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Master Timetable
            </h1>
            <p className="text-gray-600 mt-1">
              Drag and drop to rearrange lessons across all classes
            </p>
          </div>
          {Array.isArray(terms) && terms.length > 0 && (
            <select
              value={selectedTermId}
              onChange={(e) => setSelectedTermId(e.target.value)}
              className="px-4 py-2 border rounded-lg text-sm bg-white shadow-sm"
            >
              {terms.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isCurrent ? " (Current)" : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {schoolId && selectedTermId ? (
        <MasterTimetableMatrix schoolId={schoolId} termId={selectedTermId} />
      ) : (
        <div className="bg-white rounded-2xl shadow-xl border p-12 text-center text-gray-500">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          Loading timetable...
        </div>
      )}
    </div>
  );
}
