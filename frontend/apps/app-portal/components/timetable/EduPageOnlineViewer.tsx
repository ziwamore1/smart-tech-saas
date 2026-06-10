"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { timetableApi, schoolApi, classApi, teacherApi } from "@/lib/api";
import { abbreviateSubject, abbreviateTeacher } from "@/lib/abbreviations";
import TooltipWrap from "./TooltipWrap";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
  const hue = hash % 360;
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

interface EduPageOnlineViewerProps {
  termId?: string;
  slots?: Slot[];
  studentData?: TimetableData["student"];
  classData?: TimetableData["class"];
  viewType?: ViewType;
  entityName?: string;
}

export default function EduPageOnlineViewer({
  termId,
  slots,
  studentData,
  classData,
  viewType = "class",
  entityName,
}: EduPageOnlineViewerProps) {
  const [selectedEntity, setSelectedEntity] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewType>(viewType);
  const [currentWeek, setCurrentWeek] = useState(0);
  const mountedRef = useRef(false);
  const prevViewModeRef = useRef(viewMode);

  const { data: termData } = useQuery({
    queryKey: ["current-term"],
    queryFn: async () => {
      const res = await timetableApi.getCurrentTerm();
      return res.data?.data || res.data;
    },
    retry: false,
  });

  const { data: timeSettings, isLoading: tsLoading } = useQuery<TimeSettings>({
    queryKey: ["edu-online-timesettings"],
    queryFn: async () => {
      const res = await schoolApi.getTimeSettings();
      const d = res.data?.data || res.data;
      return {
        periodsPerDay: d.periodsPerDay || 8,
        breakAfterPeriod: d.breakAfterPeriod ?? 4,
        periodDuration: d.periodDuration || 40,
        startTime: d.startTime || "07:00",
        breaks: (d.breaks && d.breaks.length > 0)
          ? d.breaks
          : (d.breakAfterPeriod && d.breakAfterPeriod > 0
              ? [{ afterPeriod: d.breakAfterPeriod, duration: d.breakDuration || 20, name: 'Break' }]
              : []),
        periodDurations: d.periodDurations || [],
      };
    },
    retry: false,
  });

  const { data: classesData } = useQuery({
    queryKey: ["edu-online-classes"],
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
    queryKey: ["edu-online-teachers"],
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

  const effectiveTerm = termId || termData?.id;

  const { data: fetchedData, isLoading: ttLoading, error } = useQuery<TimetableData>({
    queryKey: ["eduPageTimetable", effectiveTerm, selectedEntity, viewMode],
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

  useEffect(() => {
    if (termData?.id && !effectiveTerm) {
      if (mountedRef.current) setCurrentWeek(0);
    }
  }, [termData, effectiveTerm]);

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

  const weekDays = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1) + (currentWeek * 7));

    return Array.from({ length: 6 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return {
        dayName: DAYS[i],
        date: date.getDate(),
        month: date.toLocaleString("default", { month: "short" }),
        fullDate: date.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" }),
        isToday: date.toDateString() === today.toDateString(),
      };
    });
  }, [currentWeek]);

  const entityDisplayName = entityName ||
    (viewMode === "class" && data?.class?.name) ||
    (viewMode === "teacher" && data?.teacher)
      ? `${data?.teacher?.firstName} ${data?.teacher?.lastName}`
      : (data?.student && `${data.student.firstName} ${data.student.lastName}`) ||
    "";

  const periods = ts
    ? Array.from({ length: ts.periodsPerDay }, (_, i) => i + 1)
    : [];

  const breakAfterSet = useMemo(() => {
    if (!ts) return new Set<number>();
    return new Set((ts.breaks || []).map((b) => b.afterPeriod));
  }, [ts?.breaks]);

  const classOptions = (classesData || []).map((c: any) => ({ id: c.id, name: c.name }));
  const teacherOptions = (teachersData || []).map((t: any) => ({ id: t.id, name: `${t.firstName || t.user?.firstName || ''} ${t.lastName || t.user?.lastName || ''}`.trim() }));

  if (isLoading || !ts || !periodTimes) {
    return (
      <div className="edu-online-viewer">
        <style jsx global>{EDU_ONLINE_STYLES}</style>
        <div className="edu-loading">
          <div className="edu-spinner"></div>
          <span>Loading timetable...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="edu-online-viewer">
        <style jsx global>{EDU_ONLINE_STYLES}</style>
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
    <div className="edu-online-viewer">
      <style jsx global>{EDU_ONLINE_STYLES}</style>

      <div className="edu-online-header">
        <h2 className="edu-online-title">
          Timetable
          {entityDisplayName && <span>{entityDisplayName}</span>}
        </h2>

        <div className="edu-online-controls">
          <div className="edu-view-toggle">
            <button
              className={`edu-view-btn ${viewMode === "class" ? "active" : ""}`}
              onClick={() => { setViewMode("class"); setSelectedEntity(""); }}
            >
              Classes
            </button>
            <button
              className={`edu-view-btn ${viewMode === "teacher" ? "active" : ""}`}
              onClick={() => { setViewMode("teacher"); setSelectedEntity(""); }}
            >
              Teachers
            </button>
            <button
              className={`edu-view-btn ${viewMode === "student" ? "active" : ""}`}
              onClick={() => { setViewMode("student"); setSelectedEntity(""); }}
            >
              My Timetable
            </button>
          </div>

          {(viewMode === "class" || viewMode === "teacher") && (
            <select
              className="edu-select"
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
            >
              <option value="">Select {viewMode === "teacher" ? "teacher" : "class"}</option>
              {(viewMode === "teacher" ? teacherOptions : classOptions).map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          )}

          {effectiveTerm && (
            <select className="edu-select" value={effectiveTerm} disabled>
              <option value={effectiveTerm}>{termData?.name || "Current term"}</option>
            </select>
          )}
        </div>
      </div>

      {!hasSlots ? (
        <div className="edu-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <h3>No Timetable Available</h3>
          <p>There is no timetable data available for the selected view.</p>
        </div>
      ) : (
        <>
          <div className="edu-week-nav">
            <button
              className="edu-week-btn"
              onClick={() => setCurrentWeek((w) => Math.max(0, w - 1))}
              disabled={currentWeek === 0}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <span className="edu-week-label">
              Week {currentWeek + 1}: {weekDays[0]?.dayName} {weekDays[0]?.date} {weekDays[0]?.month} - {weekDays[4]?.dayName} {weekDays[4]?.date} {weekDays[4]?.month}
            </span>
            <button
              className="edu-week-btn"
              onClick={() => setCurrentWeek((w) => w + 1)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <button
              className="edu-today-btn"
              onClick={() => setCurrentWeek(0)}
            >
              Today
            </button>
          </div>

          <div className="edu-timetable-wrapper">
            <table className="edu-asc-timetable">
              <thead>
                <tr>
                  <th className="edu-period-header">
                    <span className="edu-period-header-title">Period</span>
                    <span className="edu-period-header-time">Time</span>
                  </th>
                  {DAYS.map((day, idx) => (
                    <th key={idx} className={weekDays[idx]?.isToday ? "edu-today-col" : ""}>
                      <div className="edu-day-header-name">{day}</div>
                      <div className="edu-day-header-date">{weekDays[idx]?.date} {weekDays[idx]?.month}</div>
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
                        <td className="edu-period-cell">
                          <span className="edu-period-number">{period}</span>
                          <span className="edu-period-time">
                            {periodTimes[period]?.start}<br />
                            {periodTimes[period]?.end}
                          </span>
                        </td>
                        {DAYS.map((_, dayIdx) => {
                          const slot = getSlot(dayIdx + 1, period);
                          const cardStyle = slot ? getSubjectCardStyle(slot.subject.name) : {};
                          return (
                            <td key={`${dayIdx}-${period}`} className="edu-lesson-cell">
                              {slot ? (
                                <div className="edu-lesson" style={cardStyle}>
                                  <div className="edu-lesson-subject"><TooltipWrap text={slot.subject.name}><span>{abbreviateSubject(slot.subject.name)}</span></TooltipWrap></div>
                                  <div className="edu-lesson-details">
                                    <div className="edu-lesson-teacher"><TooltipWrap text={`${slot.teacher?.user?.firstName} ${slot.teacher?.user?.lastName}`}><span>{abbreviateTeacher(slot.teacher)}</span></TooltipWrap></div>
                                    {(slot.classroom || slot.room) && (
                                      <div className="edu-lesson-room">
                                        {slot.classroom?.name || slot.room?.name}
                                      </div>
                                    )}
                                    {slot.classGroup && (
                                      <div className="edu-lesson-group">
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
                        <tr key={`break-${period}`} className="edu-break-row">
                          <td className="edu-break-period">
                            <span className="edu-break-period-label">{brk?.name || "Break"}</span>
                          </td>
                          <td colSpan={6} className="edu-break-cell">
                            <span className="edu-break-text">BREAK</span>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="edu-timetable-footer">
            <div className="edu-footer-info">
              <span>{entityDisplayName}</span>
              <span>Term: {termData?.name || "Active"}</span>
              <span>Periods: {ts.periodsPerDay} | Break: after P{ts.breakAfterPeriod}</span>
            </div>
            <button className="edu-print-btn" style={{ opacity: 0.5, cursor: 'not-allowed' }} disabled title="PDF export via report service">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              PDF Export
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const EDU_ONLINE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap');

  .edu-online-viewer {
    font-family: 'Open Sans', Arial, sans-serif;
    background: #fff;
    border-radius: 4px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.12);
    overflow: hidden;
  }

  .edu-online-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f5f5f5;
    border-bottom: 1px solid #ddd;
    flex-wrap: wrap;
    gap: 10px;
  }

  .edu-online-title {
    font-size: 18px;
    font-weight: 700;
    color: #333;
    margin: 0;
  }

  .edu-online-title span {
    font-weight: 400;
    color: #666;
    font-size: 14px;
    margin-left: 6px;
  }

  .edu-online-controls {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }

  .edu-view-toggle {
    display: flex;
    gap: 2px;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 3px;
    padding: 1px;
  }

  .edu-view-btn {
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

  .edu-view-btn:hover {
    background: #f0f0f0;
  }

  .edu-view-btn.active {
    background: #4a90d9;
    color: #fff;
  }

  .edu-select {
    padding: 5px 8px;
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: 12px;
    background: #fff;
    cursor: pointer;
    min-width: 160px;
    font-family: inherit;
  }

  .edu-select:focus {
    outline: none;
    border-color: #4a90d9;
  }

  .edu-week-nav {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    background: #fafafa;
    border-bottom: 1px solid #e8e8e8;
  }

  .edu-week-btn {
    padding: 5px 8px;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 3px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .edu-week-btn:hover:not(:disabled) {
    background: #f0f0f0;
  }

  .edu-week-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .edu-week-label {
    font-size: 12px;
    color: #333;
    font-weight: 500;
    min-width: 180px;
    text-align: center;
  }

  .edu-today-btn {
    padding: 5px 10px;
    background: #4a90d9;
    color: #fff;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    transition: all 0.15s;
    margin-left: auto;
    font-family: inherit;
  }

  .edu-today-btn:hover {
    background: #3a7bc8;
  }

  .edu-timetable-wrapper {
    padding: 16px;
    overflow-x: auto;
  }

  .edu-asc-timetable {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    min-width: 750px;
    table-layout: fixed;
  }

  .edu-asc-timetable .edu-period-header {
    width: 80px;
    min-width: 80px;
  }

  .edu-asc-timetable thead th {
    background: #4a90d9;
    color: #fff;
    font-weight: 600;
    text-align: center;
    padding: 8px 4px;
    font-size: 12px;
    border: 1px solid #3a7bc8;
    position: relative;
  }

  .edu-period-header {
    background: #3a7bc8 !important;
  }

  .edu-period-header-title {
    display: block;
    font-size: 12px;
    font-weight: 600;
  }

  .edu-period-header-time {
    display: block;
    font-size: 9px;
    font-weight: 400;
    opacity: 0.85;
    margin-top: 2px;
  }

  .edu-today-col {
    box-shadow: inset 0 0 0 2px #4CAF50;
    z-index: 1;
  }

  .edu-day-header-name {
    font-weight: 700;
    font-size: 12px;
  }

  .edu-day-header-date {
    font-size: 10px;
    font-weight: 400;
    opacity: 0.85;
    margin-top: 2px;
  }

  .edu-period-cell {
    background: #f0f4f8 !important;
    text-align: center;
    padding: 6px 4px;
    vertical-align: middle;
    border: 1px solid #d0d8e0;
  }

  .edu-period-number {
    font-size: 16px;
    font-weight: 700;
    color: #333;
    display: block;
    line-height: 1;
  }

  .edu-period-time {
    font-size: 9px;
    color: #666;
    margin-top: 3px;
    display: block;
    line-height: 1.3;
  }

  .edu-lesson-cell {
    padding: 2px;
    min-height: 56px;
    vertical-align: top;
    border: 1px solid #d0d8e0;
  }

  .edu-lesson-cell:not(:last-child) {
    border-right-width: 2px;
    border-right-color: #b0b8c0;
  }

  .edu-lesson {
    border-radius: 3px;
    padding: 5px 6px;
    border-left: 3px solid #4a90d9;
    min-height: 50px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    font-size: 11px;
    transition: box-shadow 0.15s;
    cursor: default;
  }

  .edu-lesson:hover {
    box-shadow: 0 1px 4px rgba(0,0,0,0.12);
  }

  .edu-lesson-subject {
    font-weight: 700;
    font-size: 11px;
    color: #111;
    line-height: 1.2;
    margin-bottom: 2px;
  .edu-lesson-details {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .edu-lesson-teacher {
    font-size: 10px;
    color: #555;
  .edu-lesson-room {
    font-size: 9px;
    color: #777;
  }

  .edu-lesson-group {
    font-size: 9px;
    color: #888;
    font-weight: 500;
  }

  .edu-break-row {
    background: #fafafa;
  }

  .edu-break-period {
    background: #eee !important;
    text-align: center;
    padding: 6px 4px;
    border: 1px solid #d0d8e0;
  }

  .edu-break-period-label {
    font-size: 10px;
    font-weight: 600;
    color: #999;
    letter-spacing: 0.5px;
  }

  .edu-break-cell {
    padding: 8px !important;
    background: repeating-linear-gradient(45deg, #f8f8f8, #f8f8f8 5px, #f0f0f0 5px, #f0f0f0 10px);
    text-align: center;
    vertical-align: middle !important;
    border: 1px solid #d0d8e0;
  }

  .edu-break-text {
    font-size: 11px;
    font-weight: 600;
    color: #aaa;
    letter-spacing: 2px;
  }

  .edu-timetable-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    background: #f5f5f5;
    border-top: 1px solid #ddd;
    flex-wrap: wrap;
    gap: 8px;
  }

  .edu-footer-info {
    display: flex;
    gap: 14px;
    font-size: 11px;
    color: #666;
  }

  .edu-footer-info span {
    font-weight: 500;
  }

  .edu-print-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 3px;
    cursor: pointer;
    font-size: 11px;
    color: #333;
    transition: all 0.15s;
    font-family: inherit;
  }

  .edu-print-btn:hover {
    background: #f0f0f0;
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
    .edu-online-header,
    .edu-week-nav,
    .edu-timetable-footer {
      display: none !important;
    }

    .edu-online-viewer {
      box-shadow: none;
      border-radius: 0;
    }

    .edu-timetable-wrapper {
      padding: 0;
    }

    .edu-asc-timetable {
      min-width: unset;
      font-size: 9px;
    }

    .edu-asc-timetable thead th {
      background: #4a90d9 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .edu-period-header {
      background: #3a7bc8 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .edu-period-cell {
      background: #f0f4f8 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .edu-lesson {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .edu-break-cell {
      background: #f0f0f0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .edu-lesson-cell:not(:last-child) {
      border-right-width: 2px;
      border-right-color: #999;
    }
  }

  @media (max-width: 768px) {
    .edu-online-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .edu-online-controls {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
    }

    .edu-select {
      min-width: unset;
      width: 100%;
    }

    .edu-week-nav {
      flex-wrap: wrap;
    }

    .edu-week-label {
      min-width: unset;
      width: 100%;
      text-align: left;
    }

    .edu-today-btn {
      margin-left: 0;
    }

    .edu-timetable-wrapper {
      padding: 10px;
    }
  }
`;
