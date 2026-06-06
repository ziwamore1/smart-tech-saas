"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { timetableApi, schoolApi, classApi, teacherApi } from "@/lib/api";
import { abbreviateSubject, abbreviateTeacher } from "@/lib/abbreviations";
import TooltipWrap from "./TooltipWrap";

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface TimeSettings {
  periodsPerDay: number;
  breakAfterPeriod: number;
  periodDuration: number;
  startTime: string;
  breaks?: Array<{ afterPeriod: number; duration: number; name?: string }>;
  periodDurations?: number[];
}

function computePeriodTimes(ts: TimeSettings) {
  if (!ts?.startTime) return null;
  const [startH, startM] = ts.startTime.split(":").map(Number);
  const times: Record<number, { start: string; end: string }> = {};
  let mins = startH * 60 + startM;
  const breakMap = new Map<number, number>();
  (ts.breaks || []).forEach((b) => breakMap.set(b.afterPeriod, b.duration));

  for (let i = 1; i <= ts.periodsPerDay; i++) {
    const dur = ts.periodDurations?.[i - 1] ?? ts.periodDuration;
    times[i] = {
      start: `${Math.floor(mins / 60).toString().padStart(2, "0")}:${(mins % 60).toString().padStart(2, "0")}`,
      end: `${Math.floor((mins + dur) / 60).toString().padStart(2, "0")}:${((mins + dur) % 60).toString().padStart(2, "0")}`,
    };
    mins += dur;

    const breakDur = breakMap.get(i);
    if (breakDur) {
      mins += breakDur;
    }
  }
  return times;
}

const SUBJECT_COLORS: Record<string, string> = {
  "Mathematics": "#4CAF50",
  "English": "#2196F3",
  "Science": "#9C27B0",
  "History": "#FF9800",
  "Geography": "#009688",
  "Physics": "#00BCD4",
  "Chemistry": "#8BC34A",
  "Biology": "#4CAF50",
  "Computer": "#607D8B",
  "ICT": "#607D8B",
  "Art": "#E91E63",
  "Music": "#9C27B0",
  "Physical Education": "#FF5722",
  "PE": "#FF5722",
  "Religious Education": "#795548",
  "RE": "#795548",
  "French": "#3F51B5",
  "Chinese": "#F44336",
  "Commerce": "#009688",
  "Business": "#009688",
  "Home Economics": "#FF9800",
  "Technical": "#795548",
};

interface Slot {
  id: string;
  day: number;
  period: number;
  subject: {
    id: string;
    name: string;
    color?: string;
  };
  teacher: {
    id: string;
    user: {
      firstName: string;
      lastName: string;
      username?: string;
    };
  };
  classroom?: {
    id: string;
    name: string;
  };
  room?: {
    id: string;
    name: string;
  };
  classGroup?: {
    id: string;
    name: string;
  };
}

interface TimetableData {
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
  };
  class?: {
    id: string;
    name: string;
  };
  teacher?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  slots: Slot[];
}

function getSubjectColor(subjectName: string): string {
  const normalized = subjectName?.trim();
  if (SUBJECT_COLORS[normalized]) {
    return SUBJECT_COLORS[normalized];
  }
  for (const [key, color] of Object.entries(SUBJECT_COLORS)) {
    if (normalized.toUpperCase().includes(key.toUpperCase()) || key.toUpperCase().includes(normalized.toUpperCase())) {
      return color;
    }
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 50%)`;
}

function getSubjectCardStyle(subjectName: string): { background: string; color: string; borderLeft: string } {
  const color = getSubjectColor(subjectName);
  const bgColor = color.startsWith("hsl")
    ? color.replace("50%)", "90%)").replace("55%", "40%")
    : color + "18";
  return {
    background: bgColor,
    color: "#111",
    borderLeft: `3px solid ${color}`,
  };
}

type ViewType = "class" | "teacher" | "student" | "room";

interface EduPageViewProps {
  termId?: string;
  slots?: Slot[];
  studentData?: TimetableData["student"];
  classData?: TimetableData["class"];
  viewType?: ViewType;
  entityName?: string;
}

export default function EduPageView({
  termId,
  slots,
  studentData,
  classData,
  viewType = "class",
  entityName,
}: EduPageViewProps) {
  const [selectedEntity, setSelectedEntity] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewType>(viewType);
  const mountedRef = useRef(false);
  const prevViewModeRef = useRef(viewMode);

  const { data: classesData } = useQuery({
    queryKey: ["edu-view-classes"],
    queryFn: async () => {
      try {
        const res = await classApi.getAll();
        const d = res.data?.data || res.data;
        return Array.isArray(d) ? d : [];
      } catch {
        return [];
      }
    },
    retry: false,
  });

  const { data: teachersData } = useQuery({
    queryKey: ["edu-view-teachers"],
    queryFn: async () => {
      try {
        const res = await teacherApi.getAll();
        let d = res.data;
        if (d?.data?.data && Array.isArray(d.data.data)) d = d.data.data;
        else if (d?.data && Array.isArray(d.data)) d = d.data;
        else if (d?.teachers && Array.isArray(d.teachers)) d = d.teachers;
        else if (d?.result && Array.isArray(d.result)) d = d.result;
        else if (d?.items && Array.isArray(d.items)) d = d.items;
        return Array.isArray(d) ? d : (Array.isArray(res.data) ? res.data : []);
      } catch {
        return [];
      }
    },
    retry: false,
  });

  const effectiveTerm = termId;

  const { data: fetchedData, isLoading: ttLoading, error } = useQuery<TimetableData>({
    queryKey: ["eduPageView", effectiveTerm, selectedEntity, viewMode],
    queryFn: async () => {
      let res;
      switch (viewMode) {
        case "class":
          if (!selectedEntity) return { slots: [] } as any;
          res = await timetableApi.getClassTimetable(selectedEntity, effectiveTerm || "");
          break;
        case "teacher":
          if (!selectedEntity) return { slots: [] } as any;
          res = await timetableApi.getTeacherTimetable(selectedEntity, effectiveTerm || "");
          break;
        case "room":
          if (!selectedEntity) return { slots: [] } as any;
          res = await timetableApi.getRoomTimetable(selectedEntity, effectiveTerm || "");
          break;
        default:
          res = await timetableApi.getStudentTimetable(effectiveTerm);
      }
      const data = res.data?.data || res.data;
      return data;
    },
    enabled: !!effectiveTerm && (viewMode !== "student" ? !!selectedEntity : !slots),
  });

  const data = (slots && viewMode === "student")
    ? { student: studentData, class: classData, slots }
    : fetchedData;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (selectedEntity && viewMode !== prevViewModeRef.current) {
      setSelectedEntity("");
    }
    prevViewModeRef.current = viewMode;
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === "class" && classesData && classesData.length > 0 && !selectedEntity) {
      if (classData?.id) {
        if (mountedRef.current) setSelectedEntity(classData.id);
      } else {
        if (mountedRef.current) setSelectedEntity(classesData[0].id);
      }
    }
    if (viewMode === "teacher" && teachersData && teachersData.length > 0 && !selectedEntity) {
      if (mountedRef.current) setSelectedEntity(teachersData[0].id);
    }
  }, [viewMode, classesData, teachersData, classData, selectedEntity]);

  const { data: timeSettings, isLoading: tsLoading } = useQuery({
    queryKey: ["time-settings"],
    queryFn: async () => {
      const res = await schoolApi.getTimeSettings();
      return res.data?.data || res.data;
    },
  });
  const { data: termData } = useQuery({
    queryKey: ["current-term"],
    queryFn: async () => {
      const res = await timetableApi.getCurrentTerm();
      return res.data?.data || res.data;
    },
  });
  const isLoading = tsLoading || ttLoading;
  const ts = timeSettings;
  const periodTimes = useMemo(() => ts ? computePeriodTimes(ts) : null, [ts]);

  const slotMap = useMemo(() => {
    if (!ts || !data?.slots) return {};
    const map: Record<string, Slot> = {};
    data.slots.forEach((slot) => {
      map[`${slot.day}-${slot.period}`] = slot;
    });
    return map;
  }, [data?.slots, ts?.breaks]);

  const getSlot = (day: number, period: number): Slot | undefined => {
    return slotMap[`${day}-${period}`];
  };

  const entityDisplayName = entityName ||
    (viewMode === "class" && data?.class?.name) ||
    (viewMode === "teacher" && data?.teacher)
      ? `${data?.teacher?.firstName} ${data?.teacher?.lastName}`
      : (data?.student && `${data.student.firstName} ${data.student.lastName}`) ||
    "";

  const today = new Date();
  const currentDayIndex = today.getDay();
  const todayIndex = currentDayIndex === 0 ? 6 : currentDayIndex - 1;

  const periods = ts
    ? Array.from({ length: ts.periodsPerDay }, (_, i) => i + 1)
    : [];

  const breakAfterSet = useMemo(() => {
    if (!ts) return new Set<number>();
    return new Set((ts.breaks || []).map((b: { afterPeriod: number }) => b.afterPeriod));
  }, [ts?.breaks]);

  const classOptions = (classesData || []).map((c: any) => ({ id: c.id, name: c.name }));
  const teacherOptions = (teachersData || []).map((t: any) => ({ id: t.id, name: `${t.firstName || t.user?.firstName || ''} ${t.lastName || t.user?.lastName || ''}`.trim() }));

  if (isLoading || !ts || !periodTimes) {
    return (
      <div className="edu-view">
        <style jsx global>{EDU_VIEW_STYLES}</style>
        <div className="edu-loading">
          <div className="edu-spinner"></div>
          <span>Loading timetable...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="edu-view">
        <style jsx global>{EDU_VIEW_STYLES}</style>
        <div className="edu-error">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>Failed to load timetable. Please try again.</span>
        </div>
      </div>
    );
  }

  const hasSlots = data?.slots && data.slots.length > 0;

  return (
    <div className="edu-view">
      <style jsx global>{EDU_VIEW_STYLES}</style>

      <div className="edu-view-header">
        <h2 className="edu-view-title">Timetable</h2>
        <div className="edu-view-controls">
          <div className="edu-view-type-toggle">
            <button
              className={`edu-type-btn ${viewMode === "class" ? "active" : ""}`}
              onClick={() => { setViewMode("class"); setSelectedEntity(""); }}
            >
              Classes
            </button>
            <button
              className={`edu-type-btn ${viewMode === "teacher" ? "active" : ""}`}
              onClick={() => { setViewMode("teacher"); setSelectedEntity(""); }}
            >
              Teachers
            </button>
            <button
              className={`edu-type-btn ${viewMode === "student" ? "active" : ""}`}
              onClick={() => { setViewMode("student"); setSelectedEntity(""); }}
            >
              My Timetable
            </button>
          </div>

          {(viewMode === "class" || viewMode === "teacher") && (
            <select
              className="edu-view-select"
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
            >
              <option value="">Select {viewMode === "teacher" ? "teacher" : "class"}</option>
              {(viewMode === "teacher" ? teacherOptions : classOptions).map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {entityDisplayName && (
        <div className="edu-view-entity-info">
          <div className="edu-info-item">
            <span className="edu-info-label">{viewMode === "class" ? "Class" : viewMode === "teacher" ? "Teacher" : "Student"}</span>
            <span className="edu-info-value">{entityDisplayName}</span>
          </div>
          {data?.student && (
            <>
              <div className="edu-info-item">
                <span className="edu-info-label">Admission No.</span>
                <span className="edu-info-value">{data.student.admissionNumber || "-"}</span>
              </div>
            </>
          )}
          <div className="edu-info-item">
            <span className="edu-info-label">Term</span>
            <span className="edu-info-value">{termData?.name || "Active"}</span>
          </div>
        </div>
      )}

      {!hasSlots ? (
        <div className="edu-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <h3>No Timetable Available</h3>
          <p>There is no timetable data available.</p>
        </div>
      ) : (
        <div className="edu-view-timetable-wrapper">
          <table className="edu-view-timetable">
            <thead>
              <tr>
                <th className="edu-view-period-col">
                  <span className="edu-view-period-col-title">Period</span>
                  <span className="edu-view-period-col-time">Time</span>
                </th>
                {DAYS_SHORT.map((day, idx) => (
                  <th key={idx} className={idx === todayIndex ? "edu-view-today" : ""}>
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => {
                const hasBreak = breakAfterSet.has(period);
                const brk = hasBreak ? (ts.breaks || []).find((b) => b.afterPeriod === period) : null;
                return (
                  <React.Fragment key={period}>
                    <tr>
                      <td className="edu-view-period">
                        <span className="edu-view-period-num">{period}</span>
                        <span className="edu-view-period-time">
                          {periodTimes[period]?.start}<br />
                          {periodTimes[period]?.end}
                        </span>
                      </td>
                      {DAYS_SHORT.map((_, dayIdx) => {
                        const slot = getSlot(dayIdx + 1, period);
                        const cardStyle = slot ? getSubjectCardStyle(slot.subject.name) : {};
                        return (
                          <td key={`${dayIdx}-${period}`} className="edu-view-cell">
                            {slot ? (
                              <div className="edu-view-lesson" style={cardStyle}>
                                 <div className="edu-view-lesson-subject"><TooltipWrap text={slot.subject.name}><span>{abbreviateSubject(slot.subject.name)}</span></TooltipWrap></div>
                                <div className="edu-view-lesson-details">
                                  <div className="edu-view-lesson-teacher"><TooltipWrap text={`${slot.teacher?.user?.firstName} ${slot.teacher?.user?.lastName}`}><span>{abbreviateTeacher(slot.teacher)}</span></TooltipWrap></div>
                                {(slot.classroom || slot.room) && (
                                  <div className="edu-view-lesson-room">
                                    {slot.classroom?.name || slot.room?.name}
                                  </div>
                                )}
                                {slot.classGroup && (
                                  <div className="edu-view-lesson-group">
                                    {slot.classGroup.name}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                  {hasBreak && (
                    <tr key={`break-${period}`} className="edu-view-break-row">
                      <td className="edu-view-break-period">
                        <span className="edu-view-break-period-label">{brk?.name || "Break"}</span>
                      </td>
                      <td colSpan={6} className="edu-view-break-cell">
                        <span className="edu-view-break-text">BREAK</span>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          </table>

          <div className="edu-view-actions">
            <button className="edu-view-print-btn" style={{ opacity: 0.5, cursor: 'not-allowed' }} disabled title="PDF export via report service">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              PDF Export
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const EDU_VIEW_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap');

  .edu-view {
    font-family: 'Open Sans', Arial, sans-serif;
    background: #fff;
    border-radius: 4px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.12);
    overflow: hidden;
  }

  .edu-view-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
    flex-wrap: wrap;
    gap: 10px;
  }

  .edu-view-title {
    font-size: 18px;
    font-weight: 700;
    color: #333;
    margin: 0;
  }

  .edu-view-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .edu-view-type-toggle {
    display: flex;
    gap: 2px;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 3px;
    padding: 1px;
  }

  .edu-type-btn {
    padding: 5px 10px;
    background: transparent;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    font-size: 11px;
    color: #555;
    transition: all 0.15s;
    font-weight: 500;
    font-family: inherit;
  }

  .edu-type-btn:hover {
    background: #f0f0f0;
  }

  .edu-type-btn.active {
    background: #4a90d9;
    color: #fff;
  }

  .edu-view-select {
    padding: 5px 8px;
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: 12px;
    background: #fff;
    cursor: pointer;
    min-width: 160px;
    font-family: inherit;
  }

  .edu-view-select:focus {
    outline: none;
    border-color: #4a90d9;
  }

  .edu-view-entity-info {
    display: flex;
    gap: 16px;
    padding: 10px 16px;
    background: #fafafa;
    border-bottom: 1px solid #e8e8e8;
    flex-wrap: wrap;
  }

  .edu-info-item {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .edu-info-label {
    font-size: 10px;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .edu-info-value {
    font-size: 13px;
    font-weight: 600;
    color: #333;
  }

  .edu-view-timetable-wrapper {
    padding: 16px;
    overflow-x: auto;
  }

  .edu-view-timetable {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    min-width: 750px;
    table-layout: fixed;
  }

  .edu-view-timetable .edu-view-period-col {
    width: 80px;
    min-width: 80px;
  }

  .edu-view-timetable thead th {
    background: #4a90d9;
    color: #fff;
    font-weight: 600;
    text-align: center;
    padding: 8px 4px;
    font-size: 12px;
    border: 1px solid #3a7bc8;
    position: relative;
  }

  .edu-view-period-col {
    background: #3a7bc8 !important;
  }

  .edu-view-period-col-title {
    display: block;
    font-size: 12px;
    font-weight: 600;
  }

  .edu-view-period-col-time {
    display: block;
    font-size: 9px;
    font-weight: 400;
    opacity: 0.85;
    margin-top: 2px;
  }

  .edu-view-today {
    box-shadow: inset 0 0 0 2px #4CAF50;
    z-index: 1;
  }

  .edu-view-period {
    background: #f0f4f8 !important;
    text-align: center;
    padding: 6px 4px;
    vertical-align: middle;
    border: 1px solid #d0d8e0;
  }

  .edu-view-period-num {
    font-size: 16px;
    font-weight: 700;
    color: #333;
    display: block;
    line-height: 1;
  }

  .edu-view-period-time {
    font-size: 9px;
    color: #666;
    margin-top: 3px;
    display: block;
    line-height: 1.3;
  }

  .edu-view-cell {
    padding: 2px;
    min-height: 56px;
    vertical-align: top;
    border: 1px solid #d0d8e0;
  }

  .edu-view-cell:not(:last-child) {
    border-right-width: 2px;
    border-right-color: #b0b8c0;
  }

  .edu-view-lesson {
    border-radius: 3px;
    padding: 5px 6px;
    border-left: 3px solid #4a90d9;
    min-height: 50px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    font-size: 11px;
  }

  .edu-view-lesson-subject {
    font-weight: 700;
    font-size: 11px;
    color: #111;
    line-height: 1.2;
    margin-bottom: 2px;
  .edu-view-lesson-details {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .edu-view-lesson-teacher {
    font-size: 10px;
    color: #555;
  .edu-view-lesson-room {
    font-size: 9px;
    color: #777;
  }

  .edu-view-lesson-group {
    font-size: 9px;
    color: #888;
    font-weight: 500;
  }

  .edu-view-break-row {
    background: #fafafa;
  }

  .edu-view-break-period {
    background: #eee !important;
    text-align: center;
    padding: 6px 4px;
    border: 1px solid #d0d8e0;
  }

  .edu-view-break-period-label {
    font-size: 10px;
    font-weight: 600;
    color: #999;
    letter-spacing: 0.5px;
  }

  .edu-view-break-cell {
    padding: 8px !important;
    background: repeating-linear-gradient(45deg, #f8f8f8, #f8f8f8 5px, #f0f0f0 5px, #f0f0f0 10px);
    text-align: center;
    vertical-align: middle !important;
    border: 1px solid #d0d8e0;
  }

  .edu-view-break-text {
    font-size: 11px;
    font-weight: 600;
    color: #aaa;
    letter-spacing: 2px;
  }

  .edu-view-actions {
    display: flex;
    justify-content: flex-end;
    padding-top: 12px;
  }

  .edu-view-print-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    color: #333;
    transition: all 0.15s;
    font-weight: 500;
    font-family: inherit;
  }

  .edu-view-print-btn:hover {
    background: #f5f5f5;
    border-color: #4a90d9;
    color: #4a90d9;
  }

  .edu-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 50px 20px;
    color: #666;
    gap: 10px;
  }

  .edu-spinner {
    width: 22px;
    height: 22px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #4a90d9;
    border-radius: 50%;
    animation: edu-spin 1s linear infinite;
  }

  @keyframes edu-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .edu-error {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    color: #d32f2f;
    gap: 8px;
  }

  .edu-empty {
    text-align: center;
    padding: 50px 20px;
    color: #666;
  }

  .edu-empty svg {
    color: #ccc;
    margin-bottom: 14px;
  }

  .edu-empty h3 {
    margin: 0 0 6px;
    color: #333;
    font-size: 15px;
  }

  .edu-empty p {
    margin: 0;
    font-size: 13px;
  }

  @media print {
    .edu-view-header,
    .edu-view-entity-info,
    .edu-view-actions {
      display: none !important;
    }

    .edu-view {
      box-shadow: none;
      border-radius: 0;
    }

    .edu-view-timetable-wrapper {
      padding: 0;
    }

    .edu-view-timetable {
      min-width: unset;
      font-size: 9px;
    }

    .edu-view-timetable thead th {
      background: #4a90d9 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .edu-view-period-col {
      background: #3a7bc8 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .edu-view-period {
      background: #f0f4f8 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .edu-view-lesson {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .edu-view-break-cell {
      background: #f0f0f0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .edu-view-cell:not(:last-child) {
      border-right-width: 2px;
      border-right-color: #999;
    }
  }

  @media (max-width: 768px) {
    .edu-view-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .edu-view-controls {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
    }

    .edu-view-select {
      min-width: unset;
      width: 100%;
    }

    .edu-view-entity-info {
      gap: 10px;
    }

    .edu-view-timetable-wrapper {
      padding: 10px;
    }
  }
`;
