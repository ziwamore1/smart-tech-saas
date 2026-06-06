"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { schoolApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import EduPageLayout from "@/components/timetable/EduPageLayout";
import EduPageOnlineViewer from "@/components/timetable/EduPageOnlineViewer";
import EduPageView from "@/components/timetable/EduPageView";

type ViewMode = "online" | "print";

export default function PublicTimetablePage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("online");
  const [schoolName, setSchoolName] = useState("");

  const { data: schoolData } = useQuery({
    queryKey: ["public-school-name", user?.schoolId],
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

  useEffect(() => {
    if (schoolData?.name) {
      setSchoolName(schoolData.name);
    }
  }, [schoolData]);

  return (
    <EduPageLayout
      schoolName={schoolName || "Smart Tech SaaS"}
      title="Public Timetable"
      activeNav="/view-timetable"
    >
      <style jsx global>{`
        .public-timetable-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }

        .public-timetable-title {
          font-size: 24px;
          font-weight: 700;
          color: #111;
          margin: 0;
        }

        .public-timetable-controls {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }

        .public-view-mode-toggle {
          display: flex;
          gap: 4px;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 2px;
        }

        .public-view-mode-btn {
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

        .public-view-mode-btn:hover {
          background: #f0f0f0;
        }

        .public-view-mode-btn.active {
          background: #ea6645;
          color: #fff;
        }

        .public-view-mode-btn svg {
          width: 16px;
          height: 16px;
        }

        @media (max-width: 768px) {
          .public-timetable-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .public-timetable-controls {
            width: 100%;
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>

      <div className="public-timetable-header">
        <h1 className="public-timetable-title">Timetable Viewer</h1>
        <div className="public-timetable-controls">
          <div className="public-view-mode-toggle">
            <button
              className={`public-view-mode-btn ${viewMode === "online" ? "active" : ""}`}
              onClick={() => setViewMode("online")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              Online
            </button>
            <button
              className={`public-view-mode-btn ${viewMode === "print" ? "active" : ""}`}
              onClick={() => setViewMode("print")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print
            </button>
          </div>
        </div>
      </div>

      {viewMode === "online" ? (
        <EduPageOnlineViewer />
      ) : (
        <EduPageView />
      )}
    </EduPageLayout>
  );
}
