"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { timetableApi, termApi, schoolApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import EduPageLayout from "@/components/timetable/EduPageLayout";
import EduPageOnlineViewer from "@/components/timetable/EduPageOnlineViewer";
import EduPageView from "@/components/timetable/EduPageView";

type ViewMode = "online" | "print";

export default function ViewTimetablePage() {
  const { user } = useAuth();
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("online");
  const [schoolName, setSchoolName] = useState("");

  const { data: schoolData } = useQuery({
    queryKey: ["school-name", user?.schoolId],
    queryFn: async () => {
      if (!user?.schoolId) return null;
      const res = await schoolApi.getAll();
      const outerData = res.data?.data || res.data;
      const schools = outerData?.data || outerData;
      const school = Array.isArray(schools)
        ? schools.find((s: any) => s.id === user.schoolId)
        : null;
      return school;
    },
    retry: false,
    enabled: !!user?.schoolId,
  });

  const { data: allTerms } = useQuery({
    queryKey: ["all-terms"],
    queryFn: async () => {
      const res = await termApi.getAll();
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    retry: false,
  });

  const { data: currentTerm } = useQuery({
    queryKey: ["current-term-detail"],
    queryFn: async () => {
      const res = await termApi.getCurrent();
      const data = res.data?.data || res.data;
      return data;
    },
    retry: false,
  });

  const { data: timetableData } = useQuery({
    queryKey: ["my-timetable", selectedTerm],
    queryFn: async () => {
      const res = await timetableApi.getMyTimetable(selectedTerm || undefined);
      const data = res.data?.data || res.data;
      console.log('[ViewTimetable] API response:', res.data);
      console.log('[ViewTimetable] Unwrapped data:', data);
      return data;
    },
    enabled: !!selectedTerm,
  });

  useEffect(() => {
    if (schoolData?.name) {
      setSchoolName(schoolData.name);
    }
  }, [schoolData]);

  useEffect(() => {
    if (currentTerm?.id && !selectedTerm) {
      setSelectedTerm(currentTerm.id);
    }
  }, [currentTerm, selectedTerm]);

  const terms = Array.isArray(allTerms) ? allTerms : [];

  return (
    <EduPageLayout
      schoolName={schoolName || "Smart Tech SaaS"}
      title="Timetable"
      activeNav="/view-timetable"
    >
      <style jsx global>{`
        .view-timetable-page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .view-timetable-page-title {
          font-size: 24px;
          font-weight: 700;
          color: #111;
          margin: 0;
        }

        .view-timetable-page-controls {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .view-mode-toggle {
          display: flex;
          gap: 4px;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 2px;
        }

        .view-mode-btn {
          padding: 8px 16px;
          background: transparent;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 13px;
          color: #555;
          transition: all 0.2s;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'Open Sans', 'Roboto', Arial, sans-serif;
        }

        .view-mode-btn:hover {
          background: #f0f0f0;
        }

        .view-mode-btn.active {
          background: #ea6645;
          color: #fff;
        }

        .view-mode-btn svg {
          width: 16px;
          height: 16px;
        }

        .edupage-page-select {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 13px;
          background: #fff;
          cursor: pointer;
          min-width: 150px;
          font-family: 'Open Sans', 'Roboto', Arial, sans-serif;
        }

        .edupage-page-select:focus {
          outline: none;
          border-color: #ea6645;
        }

        .edupage-page-student-info {
          display: flex;
          gap: 20px;
          padding: 16px 20px;
          background: #f8f8f8;
          border-bottom: 1px solid #e0e0e0;
          border-radius: 8px 8px 0 0;
          flex-wrap: wrap;
          margin-bottom: -1px;
          position: relative;
          z-index: 1;
        }

        .edupage-page-info-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .edupage-page-info-label {
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .edupage-page-info-value {
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        @media (max-width: 768px) {
          .view-timetable-page-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .view-timetable-page-controls {
            width: 100%;
            flex-direction: column;
            align-items: stretch;
          }

          .edupage-page-select {
            min-width: unset;
            width: 100%;
          }

          .edupage-page-student-info {
            gap: 12px;
          }
        }
      `}</style>

      <div className="view-timetable-page-header">
        <h1 className="view-timetable-page-title">My Timetable</h1>
        <div className="view-timetable-page-controls">
          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn ${viewMode === "online" ? "active" : ""}`}
              onClick={() => setViewMode("online")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              Online View
            </button>
            <button
              className={`view-mode-btn ${viewMode === "print" ? "active" : ""}`}
              onClick={() => setViewMode("print")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print View
            </button>
          </div>

          <select
            className="edupage-page-select"
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
          >
            <option value="">Select Term</option>
            {terms.map((term: any) => (
              <option key={term.id} value={term.id}>
                {term.name}
                {term.isCurrent ? " (Current)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {timetableData && (
        <div className="edupage-page-student-info">
          <div className="edupage-page-info-item">
            <span className="edupage-page-info-label">Student</span>
            <span className="edupage-page-info-value">
              {timetableData.student?.firstName} {timetableData.student?.lastName}
            </span>
          </div>
          <div className="edupage-page-info-item">
            <span className="edupage-page-info-label">Class</span>
            <span className="edupage-page-info-value">
              {timetableData.class?.name || "Not assigned"}
            </span>
          </div>
          <div className="edupage-page-info-item">
            <span className="edupage-page-info-label">Admission No.</span>
            <span className="edupage-page-info-value">
              {timetableData.student?.admissionNumber || "-"}
            </span>
          </div>
          <div className="edupage-page-info-item">
            <span className="edupage-page-info-label">Term</span>
            <span className="edupage-page-info-value">
              {currentTerm?.name || "Active"}
            </span>
          </div>
        </div>
      )}

      {viewMode === "online" ? (
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
    </EduPageLayout>
  );
}
