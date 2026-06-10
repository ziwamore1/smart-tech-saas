"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { timetableApi, termApi, schoolApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import EduPageOnlineViewer from "@/components/timetable/EduPageOnlineViewer";
import EduPageView from "@/components/timetable/EduPageView";

type ViewMode = "online" | "print";

export default function TeacherTimetablePage() {
  const { user } = useAuth();
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("online");
  const [schoolName, setSchoolName] = useState("");

  const { data: schoolData } = useQuery({
    queryKey: ["teacher-school-name", user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return null;
      const res = await schoolApi.getAll();
      const outerData = res.data?.data || res.data;
      const schools = outerData?.data || outerData;
      return Array.isArray(schools)
        ? schools.find((s: any) => s.id === user.schoolId)
        : null;
    },
    retry: false,
    enabled: !!user?.schoolId,
  });

  const { data: allTerms } = useQuery({
    queryKey: ["teacher-all-terms"],
    queryFn: async () => {
      const res = await termApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    retry: false,
  });

  const { data: currentTerm } = useQuery({
    queryKey: ["teacher-current-term"],
    queryFn: async () => {
      const res = await termApi.getCurrent();
      const data = res.data?.data || res.data;
      return data;
    },
    retry: false,
  });

  const { data: timetableData } = useQuery({
    queryKey: ["teacher-timetable", selectedTerm],
    queryFn: async () => {
      const res = await timetableApi.getMyTimetable(selectedTerm || undefined);
      return res.data?.data || res.data;
    },
    enabled: !!selectedTerm,
  });

  useEffect(() => {
    if (schoolData?.name) setSchoolName(schoolData.name);
  }, [schoolData]);

  useEffect(() => {
    if (currentTerm?.id && !selectedTerm) setSelectedTerm(currentTerm.id);
  }, [currentTerm, selectedTerm]);

  const terms = Array.isArray(allTerms) ? allTerms : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/teacher" className="hover:text-blue-600">Dashboard</Link>
          <span>/</span>
          <span>Timetable</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{schoolName ? `${schoolName} - ` : ""}My Timetable</h1>
        <p className="text-gray-600 mt-1">View your teaching schedule and class assignments</p>
      </div>

      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex gap-4 bg-white border border-gray-200 rounded-lg p-2">
          <button
            className={`px-3 py-1.5 rounded text-sm font-medium transition ${viewMode === "online" ? "bg-[#ea6645] text-white" : "text-gray-600 hover:bg-gray-50"}`}
            onClick={() => setViewMode("online")}
          >
            <i className="fa fa-eye mr-1.5"></i>Online View
          </button>
          <button
            className={`px-3 py-1.5 rounded text-sm font-medium transition ${viewMode === "print" ? "bg-[#ea6645] text-white" : "text-gray-600 hover:bg-gray-50"}`}
            onClick={() => setViewMode("print")}
          >
            <i className="fa fa-print mr-1.5"></i>Print View
          </button>
        </div>

        <select
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
          value={selectedTerm}
          onChange={(e) => setSelectedTerm(e.target.value)}
        >
          <option value="">Select Term</option>
          {terms.map((term: any) => (
            <option key={term.id} value={term.id}>
              {term.name}{term.isCurrent ? " (Current)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex gap-6 text-sm bg-white border border-gray-200 rounded-lg px-4 py-3 flex-wrap">
        <div>
          <span className="text-xs text-gray-500 uppercase">Teacher</span>
          <p className="font-semibold">{user?.firstName} {user?.lastName}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase">Term</span>
          <p className="font-semibold">{currentTerm?.name || "Active"}</p>
        </div>
      </div>

      {viewMode === "online" ? (
        <EduPageOnlineViewer
          termId={selectedTerm}
          slots={timetableData?.slots}
        />
      ) : (
        <EduPageView
          termId={selectedTerm}
          slots={timetableData?.slots}
        />
      )}
    </div>
  );
}
