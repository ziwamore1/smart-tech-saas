"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { timetableApi, termApi, schoolApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import EduPageOnlineViewer from "@/components/timetable/EduPageOnlineViewer";
import EduPageView from "@/components/timetable/EduPageView";

type ViewMode = "online" | "print";

export default function ParentTimetablePage() {
  const { user } = useAuth();
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("online");
  const [schoolName, setSchoolName] = useState("");

  const { data: schoolData } = useQuery({
    queryKey: ["parent-school-name", user?.schoolId],
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
    queryKey: ["parent-all-terms"],
    queryFn: async () => {
      const res = await termApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    retry: false,
  });

  const { data: currentTerm } = useQuery({
    queryKey: ["parent-current-term"],
    queryFn: async () => {
      const res = await termApi.getCurrent();
      const data = res.data?.data || res.data;
      return data;
    },
    retry: false,
  });

  const { data: childrenData } = useQuery({
    queryKey: ["parent-children-timetables", selectedTerm],
    queryFn: async () => {
      const res = await timetableApi.getChildrenTimetables(selectedTerm || undefined);
      const data = res.data?.data || res.data;
      return data?.children || [];
    },
    enabled: !!selectedTerm,
  });

  const { data: timetableData } = useQuery({
    queryKey: ["child-timetable", selectedChild, selectedTerm],
    queryFn: async () => {
      if (!selectedChild) return null;
      const res = await timetableApi.getChildTimetable(selectedChild, selectedTerm || undefined);
      return res.data?.data || res.data;
    },
    enabled: !!selectedChild,
  });

  useEffect(() => {
    if (schoolData?.name) setSchoolName(schoolData.name);
  }, [schoolData]);

  useEffect(() => {
    if (currentTerm?.id && !selectedTerm) setSelectedTerm(currentTerm.id);
    if (childrenData?.length === 1 && !selectedChild) setSelectedChild(childrenData[0].id);
  }, [currentTerm, selectedTerm, childrenData, selectedChild]);

  const terms = Array.isArray(allTerms) ? allTerms : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {schoolName ? `${schoolName} - ` : ""}My Children&apos;s Timetables
        </h1>
        <p className="text-gray-600 mt-1">
          View your children&apos;s class schedules and lesson times
        </p>
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

        {childrenData && childrenData.length > 0 && (
          <select
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
            value={selectedChild}
            onChange={(e) => setSelectedChild(e.target.value)}
          >
            <option value="">Select Child</option>
            {childrenData.map((child: any) => (
              <option key={child.id} value={child.id}>
                {child.firstName} {child.lastName} ({child.className || "No class"})
              </option>
            ))}
          </select>
        )}

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

      {!selectedChild ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <i className="fa fa-user-plus text-4xl text-gray-300 mb-4"></i>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a Child</h3>
          <p className="text-gray-500">Choose a child from the dropdown above to view their timetable.</p>
        </div>
      ) : viewMode === "online" ? (
        <EduPageOnlineViewer
          termId={selectedTerm}
          slots={timetableData?.slots}
          studentData={timetableData?.student}
          classData={timetableData?.class}
        />
      ) : (
        <EduPageView
          termId={selectedTerm}
          slots={timetableData?.slots}
          studentData={timetableData?.student}
          classData={timetableData?.class}
        />
      )}
    </div>
  );
}
