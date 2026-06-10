"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { timetableApi, schoolApi, classApi, teacherApi, termApi, api } from "@/lib/api";
import { validateSlotConstraints } from "@/lib/validateConstraints";
import type { ConstraintViolation } from "@/lib/validateConstraints";
import { abbreviateSubject, abbreviateClassName, abbreviateTeacher } from "@/lib/abbreviations";

function TooltipWrap({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top });
    setShow(true);
  };

  return (
    <span
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShow(false)}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {children}
      {show && text && (
        <div
          style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y - 4,
            transform: 'translateX(-50%) translateY(-100%)',
            background: '#1f2937',
            color: '#fff',
            fontSize: '10px',
            padding: '3px 8px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            zIndex: 99999,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Slot {
  id: string;
  day: number;
  period: number;
  subject: {
    id: string;
    name: string;
  };
  teacher: {
    id: string;
    user: {
      firstName: string;
      lastName: string;
    };
  };
  classroom?: { id: string; name: string };
  room?: { id: string; name: string };
  classGroup?: { id: string; name: string };
  class?: { id: string; name: string };
}

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
  Mathematics: "#4CAF50",
  English: "#2196F3",
  Science: "#9C27B0",
  History: "#FF9800",
  Geography: "#009688",
  Physics: "#00BCD4",
  Chemistry: "#8BC34A",
  Biology: "#4CAF50",
  Computer: "#607D8B",
  ICT: "#607D8B",
  Art: "#E91E63",
  Music: "#9C27B0",
  "Physical Education": "#FF5722",
  PE: "#FF5722",
  "Religious Education": "#795548",
  RE: "#795548",
  French: "#3F51B5",
  Chinese: "#F44336",
  Commerce: "#009688",
  Business: "#009688",
  "Home Economics": "#FF9800",
  Technical: "#795548",
};

function getSubjectColor(name: string): string {
  const n = name?.trim() || "";
  if (SUBJECT_COLORS[n]) return SUBJECT_COLORS[n];
  for (const [k, c] of Object.entries(SUBJECT_COLORS)) {
    if (n.toUpperCase().includes(k.toUpperCase()) || k.toUpperCase().includes(n.toUpperCase())) return c;
  }
  let h = 0;
  for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h % 360)}, 50%, 55%)`;
}

function getSubjectBg(name: string): string {
  const c = getSubjectColor(name);
  if (c.startsWith("hsl")) return c.replace("55%)", "88%)").replace("50%", "30%");
  return c + "22";
}

type EntityType = "class" | "teacher" | "room" | "master";

interface Props {
  termId?: string;
  entityType?: EntityType;
  entityId?: string;
}

export default function EduPageMasterTimetable({ termId, entityType = "master", entityId }: Props) {
  const [selEntity, setSelEntity] = useState(entityId || "");
  const [selType, setSelType] = useState<EntityType>(entityType);
  const [selTerm, setSelTerm] = useState(termId || "");
  const [schoolName, setSchoolName] = useState("");
  const mountedRef = useRef(false);

  const { data: schoolData } = useQuery({
    queryKey: ["mt-school"],
    queryFn: async () => {
      const res = await schoolApi.getAll();
      const outer = res.data?.data || res.data;
      const schools = outer?.data || outer;
      return Array.isArray(schools) ? schools[0] : null;
    },
    retry: false,
  });

  const { data: termData } = useQuery({
    queryKey: ["mt-term"],
    queryFn: async () => {
      const res = await timetableApi.getCurrentTerm();
      return res.data?.data || res.data;
    },
    retry: false,
  });

  const { data: allTerms } = useQuery({
    queryKey: ["mt-allterms"],
    queryFn: async () => {
      const res = await termApi.getAll();
      return res.data?.data || res.data;
    },
    retry: false,
  });

  const { data: timeSettings, isLoading: tsLoading } = useQuery<TimeSettings>({
    queryKey: ["mt-timesettings"],
    queryFn: async () => {
      const res = await schoolApi.getTimeSettings();
      const d = res.data?.data || res.data;
      return {
        periodsPerDay: d?.periodsPerDay || 8,
        breakAfterPeriod: d?.breakAfterPeriod || 4,
        periodDuration: d?.periodDuration || 40,
        startTime: d?.startTime || "07:00",
        breaks: (d?.breaks && d.breaks.length > 0)
          ? d.breaks
          : (d?.breakAfterPeriod && d.breakAfterPeriod > 0
              ? [{ afterPeriod: d.breakAfterPeriod, duration: d?.breakDuration || 20, name: 'Break' }]
              : []),
        periodDurations: d?.periodDurations || [],
      };
    },
    retry: false,
  });

  const { data: classesData } = useQuery({
    queryKey: ["mt-classes"],
    queryFn: async () => {
      try {
        const res = await classApi.getAll();
        return res.data?.data || res.data;
      } catch {
        return [];
      }
    },
    retry: false,
  });

  const { data: teachersData } = useQuery({
    queryKey: ["mt-teachers"],
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

  const { data: roomsData } = useQuery({
    queryKey: ["mt-rooms"],
    queryFn: async () => {
      try {
        const res = await timetableApi.getRooms();
        return res.data?.data || res.data;
      } catch {
        return [];
      }
    },
    retry: false,
  });

  // For master view: fetch ALL class timetables with error tracking
  const classes = Array.isArray(classesData) ? classesData : [];
  const [fetchErrors, setFetchErrors] = useState<string[]>([]);
  const { data: allClassTimetables, isLoading: masterLoading } = useQuery({
    queryKey: ["mt-all-timetables", selTerm],
    queryFn: async () => {
      const results: Slot[][] = [];
      const errors: string[] = [];
      for (const cls of classes) {
        try {
          const res = await timetableApi.getClassTimetable(cls.id, selTerm || "");
          const d = res.data?.data || res.data;
          if (d?.slots) {
            results.push(
              d.slots.map((s: Slot) => ({ ...s, class: { id: cls.id, name: cls.name } }))
            );
          }
        } catch (err: any) {
          errors.push(cls.name);
        }
      }
      setFetchErrors(errors);
      return results;
    },
    enabled: selType === "master" && classes.length > 0 && !!selTerm,
  });

  // For single entity view
  const { data: singleData, isLoading: singleLoading } = useQuery({
    queryKey: ["mt-single-timetable", selType, selEntity, selTerm],
    queryFn: async () => {
      if (!selEntity || !selTerm) return null;
      let res;
      switch (selType) {
        case "class":
          res = await timetableApi.getClassTimetable(selEntity, selTerm);
          break;
        case "teacher":
          res = await timetableApi.getTeacherTimetable(selEntity, selTerm);
          break;
        case "room":
          res = await timetableApi.getRoomTimetable(selEntity, selTerm);
          break;
        default:
          return null;
      }
      const d = res.data?.data || res.data;
      return d;
    },
    enabled: selType !== "master" && !!selEntity && !!selTerm,
  });

  const { data: schoolConstraintData } = useQuery({
    queryKey: ["mt-constraints", schoolData?.id],
    queryFn: async () => {
      try {
        const schoolId = schoolData?.id;
        if (!schoolId) return null;
        const res = await api.get(`/constraints/${schoolId}`);
        return res.data?.data || res.data || null;
      } catch { return null; }
    },
    retry: false,
    enabled: !!schoolData?.id,
  });

  const constraintDefaults = useMemo(() => {
    const sc = schoolConstraintData;
    if (!sc) return null;
    return {
      maxSubjectPerDay: sc.maxSubjectPerDay ?? 5,
      maxLessonsPerTeacherPerDay: sc.maxLessonsPerTeacherPerDay ?? 6,
      maxConsecutivePeriods: sc.maxConsecutivePeriods ?? 4,
    };
  }, [schoolConstraintData]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (schoolData?.name) {
      if (mountedRef.current) setSchoolName(schoolData.name);
    }
  }, [schoolData]);

  useEffect(() => {
    if (termData?.id && !selTerm) {
      if (mountedRef.current) setSelTerm(termData.id);
    }
  }, [termData, selTerm]);

  useEffect(() => {
    if (entityId && selType === entityType && !selEntity) {
      if (mountedRef.current) setSelEntity(entityId);
    }
  }, [entityId, entityType, selType, selEntity]);

  const ts = timeSettings;
  const periodTimes = useMemo(() => ts ? computePeriodTimes(ts) : null, [ts]);

  const breakAfterSet = useMemo(() => {
    if (!ts) return new Set<number>();
    return new Set((ts.breaks || []).map((b) => b.afterPeriod));
  }, [ts?.breaks]);

  const loading = tsLoading || (selType === "master" ? masterLoading : singleLoading);

  // Build slot groups (for period-row view)
  const slotGroups = useMemo(() => {
    if (!ts) return {};
    const map: Record<string, Slot[]> = {};
    const addSlot = (s: Slot) => {
      const key = `${s.day}-${s.period}`;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    };

    if (selType === "master" && allClassTimetables) {
      for (const slots of allClassTimetables) {
        for (const s of slots) addSlot(s);
      }
    } else if (singleData?.slots) {
      for (const s of singleData.slots) addSlot(s);
    }

    return map;
  }, [selType, allClassTimetables, singleData, ts?.breaks]);

  // Build class matrix (for master grid: class → day → period → slot)
  const classMatrix = useMemo(() => {
    if (!allClassTimetables) return {};
    const matrix: Record<string, Record<number, Record<number, Slot>>> = {};
    for (const slots of allClassTimetables) {
      for (const slot of slots) {
        const cid = slot.class?.id;
        if (!cid) continue;
        if (!matrix[cid]) matrix[cid] = {};
        if (!matrix[cid][slot.day]) matrix[cid][slot.day] = {};
        matrix[cid][slot.day][slot.period] = slot;
      }
    }
    return matrix;
  }, [allClassTimetables]);

  // Visual columns: periods + breaks inserted
  const visualColumns = useMemo(() => {
    if (!ts) return [];
    const cols: Array<{ type: 'period'; period: number } | { type: 'break' }> = [];
    for (let p = 1; p <= ts.periodsPerDay; p++) {
      cols.push({ type: 'period', period: p });
      if (breakAfterSet.has(p)) cols.push({ type: 'break' });
    }
    return cols;
  }, [ts, breakAfterSet]);

  // Build a per-teacher constraints map from school-level defaults
  const teacherConstraintsMap = useMemo(() => {
    if (!constraintDefaults) return {};
    const map: Record<string, any> = {};
    const allSlots = Object.values(slotGroups).flat();
    const seenTeachers = new Set<string>();
    for (const slot of allSlots) {
      const tId = slot.teacher?.id;
      if (tId && !seenTeachers.has(tId)) {
        seenTeachers.add(tId);
        map[tId] = { ...constraintDefaults };
      }
    }
    return map;
  }, [slotGroups, constraintDefaults]);

  const constraintViolations = useMemo(() => {
    if (Object.keys(teacherConstraintsMap).length === 0) return [];
    const allSlots = Object.values(slotGroups).flat();
    return validateSlotConstraints(allSlots, teacherConstraintsMap);
  }, [slotGroups, teacherConstraintsMap]);

  const today = new Date();
  const todayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;

  const entityName = (() => {
    if (selType === "master") return "Master Timetable";
    if (selType === "class" && singleData?.class) return singleData.class.name;
    if (selType === "teacher" && singleData?.teacher) return `${singleData.teacher.firstName} ${singleData.teacher.lastName}`;
    const entities = (() => {
      if (selType === "teacher") return (teachersData || []).map((t: any) => ({ id: t.id, name: `${t.firstName || t.user?.firstName || ''} ${t.lastName || t.user?.lastName || ''}`.trim() }));
      if (selType === "room") return (roomsData || []).map((r: any) => ({ id: r.id, name: r.name }));
      return classes.map((c: any) => ({ id: c.id, name: c.name }));
    })();
    return entities.find((e: { id: string; name: string }) => e.id === selEntity)?.name || "";
  })();

  if (tsLoading || loading) {
    return (
      <div className="edu-tt">
        <style jsx global>{STYLES}</style>
        <div className="edu-loading"><div className="edu-spinner" /><span>Loading timetable...</span></div>
      </div>
    );
  }

  if (!ts || !periodTimes) return null;

  const tSettings = ts!;
  const pTimes = periodTimes!;

  const slots = Object.values(slotGroups).flat();
  const hasSlots = slots.length > 0;

  return (
    <div className="edu-tt">
      <style jsx global>{STYLES}</style>

      <div className="edu-tt-header">
        <div>
          <h2 className="edu-tt-title">{entityName}</h2>
          <p className="edu-tt-school">{schoolName}</p>
        </div>
        <div className="edu-tt-controls">
          <div className="edu-tt-tabs">
            <button className={`edu-tt-tab ${selType === "master" ? "active" : ""}`} onClick={() => { setSelType("master"); setSelEntity(""); }}>Master</button>
            <button className={`edu-tt-tab ${selType === "class" ? "active" : ""}`} onClick={() => { setSelType("class"); setSelEntity(""); }}>Classes</button>
            <button className={`edu-tt-tab ${selType === "teacher" ? "active" : ""}`} onClick={() => { setSelType("teacher"); setSelEntity(""); }}>Teachers</button>
            <button className={`edu-tt-tab ${selType === "room" ? "active" : ""}`} onClick={() => { setSelType("room"); setSelEntity(""); }}>Rooms</button>
          </div>
          {selType !== "master" && (
            <select className="edu-tt-select" value={selEntity} onChange={(e) => setSelEntity(e.target.value)}>
              <option value="">Select {selType}</option>
              {(selType === "teacher"
                ? (teachersData || []).map((t: any) => ({ id: t.id, name: `${t.firstName || t.user?.firstName || ''} ${t.lastName || t.user?.lastName || ''}`.trim() }))
                : selType === "room"
                  ? (roomsData || []).map((r: any) => ({ id: r.id, name: r.name }))
                  : classes.map((c: any) => ({ id: c.id, name: c.name }))
              ).map((e: { id: string; name: string }) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          )}
          <select className="edu-tt-select" value={selTerm} onChange={(e) => setSelTerm(e.target.value)}>
            <option value="">Select Term</option>
            {allTerms && Array.isArray(allTerms)
              ? allTerms.map((t: any) => <option key={t.id} value={t.id}>{t.name}{t.isCurrent ? " (Current)" : ""}</option>)
              : termData ? <option value={termData.id}>{termData.name}</option> : null}
          </select>
        </div>
      </div>

      {fetchErrors.length > 0 && (
        <div className="edu-tt-warning">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>Failed to load timetables for: {fetchErrors.join(", ")}</span>
        </div>
      )}

      {constraintViolations.length > 0 && (
        <div className="edu-tt-violations">
          <div className="edu-tt-violations-header">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>Constraint Violations ({constraintViolations.length})</span>
          </div>
          <div className="edu-tt-violations-list">
            {constraintViolations.map((v, i) => (
              <div key={i} className={`edu-tt-violation edu-tt-violation--${v.type}`}>
                <span className="edu-tt-violation-code">{v.code}</span>
                <span className="edu-tt-violation-msg">{v.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasSlots && !loading ? (
        <div className="edu-tt-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <h3>No Timetable Data</h3>
          <p>No timetable has been generated yet for the selected view.</p>
        </div>
      ) : (
        <div className="edu-tt-wrap">
          {selType === "master" ? (
            /* MASTER MODE: classes as rows, days×periods as columns */
            <table className="edu-tt-table edu-tt-master">
              <thead>
                <tr>
                  <th className="edu-tt-period-head">Class</th>
                  {DAY_NAMES.slice(0, 5).map((d, di) => (
                    <th key={di} colSpan={visualColumns.length} className={di === todayIndex ? "edu-today" : ""}>
                      {d}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="edu-tt-period-head">Period →</th>
                  {DAY_NAMES.slice(0, 5).map((d) =>
                    visualColumns.map((col, idx) =>
                      col.type === "break" ? (
                        <th key={`${d}-b${idx}`} className="edu-tt-break-head">Break</th>
                      ) : (
                        <th key={`${d}-p${col.period}`} className="edu-tt-period-subhead">
                          P{col.period!}
                          <span className="edu-ptime-sub">{pTimes[col.period!]?.start}</span>
                        </th>
                      )
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {classes.map((cls: any) => (
                  <tr key={cls.id}>
                    <td className="edu-tt-pcell"><span className="edu-class-name" title={cls.name}>{abbreviateClassName(cls.name)}</span></td>
                    {DAY_NAMES.slice(0, 5).map((_, di) => {
                      const dayNum = di + 1;
                      return visualColumns.map((col, idx) => {
                        if (col.type === "break") {
                          return (
                            <td key={`b-${cls.id}-${dayNum}-${idx}`} className="edu-break-cell">
                              <span className="edu-break-text">Break</span>
                            </td>
                          );
                        }
                        const slot = classMatrix[cls.id]?.[dayNum]?.[col.period!];
                        return (
                          <td key={`${cls.id}-${dayNum}-${col.period}`} className="edu-tt-cell">
                            {slot ? (
                              <div className="edu-tt-lesson" style={{
                                borderLeftColor: getSubjectColor(slot.subject?.name || ""),
                                backgroundColor: getSubjectBg(slot.subject?.name || ""),
                              }}>
                                <div className="edu-tt-subj">
                                  <TooltipWrap text={slot.subject?.name || ''}>
                                    <span>{abbreviateSubject(slot.subject?.name) || ""}</span>
                                  </TooltipWrap>
                                </div>
                                <div className="edu-tt-meta">
                                  {slot.teacher && (
                                    <div className="edu-tt-teacher">
                                      <TooltipWrap text={`${slot.teacher?.user?.firstName || ''} ${slot.teacher?.user?.lastName || ''}`.trim()}>
                                        <span>{abbreviateTeacher(slot.teacher)}</span>
                                      </TooltipWrap>
                                    </div>
                                  )}
                                  {(slot.classroom || slot.room) && (
                                    <div className="edu-tt-room">{slot.classroom?.name || slot.room?.name}</div>
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </td>
                        );
                      });
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* CLASS / TEACHER / ROOM MODE: periods as rows, days as columns */
            <table className="edu-tt-table">
              <thead>
                <tr>
                  <th className="edu-tt-period-head">Period</th>
                  {DAY_NAMES.map((d, i) => (
                    <th key={i} className={i === todayIndex ? "edu-today" : ""}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: tSettings.periodsPerDay }, (_, i) => i + 1).map((p) => {
                  const hasBreak = breakAfterSet.has(p);
                  const brk = hasBreak ? (tSettings.breaks || []).find((b) => b.afterPeriod === p) : null;

                  return (
                    <React.Fragment key={p}>
                      <tr>
                        <td className="edu-tt-pcell">
                          <span className="edu-pnum">{p}.</span>
                          <span className="edu-ptime">{pTimes[p]?.start} - {pTimes[p]?.end}</span>
                        </td>
                        {DAY_NAMES.map((_, di) => {
                          const key = `${di + 1}-${p}`;
                          const cellSlots = slotGroups[key] || [];

                          return (
                            <td key={`${di}-${p}`} className="edu-tt-cell">
                              {cellSlots.map((slot, si) => (
                                <div
                                  key={si}
                                  className="edu-tt-lesson"
                                  style={{
                                    borderLeftColor: getSubjectColor(slot.subject?.name || ""),
                                    backgroundColor: getSubjectBg(slot.subject?.name || ""),
                                  }}
                                >
                                  <div className="edu-tt-subj">
                                    <TooltipWrap text={slot.subject?.name || ''}>
                                      <span>{abbreviateSubject(slot.subject?.name) || ""}</span>
                                    </TooltipWrap>
                                  </div>
                                  <div className="edu-tt-meta">
                                    {slot.teacher && (
                                      <div className="edu-tt-teacher">
                                        <TooltipWrap text={`${slot.teacher?.user?.firstName || ''} ${slot.teacher?.user?.lastName || ''}`.trim()}>
                                          <span>{abbreviateTeacher(slot.teacher)}</span>
                                        </TooltipWrap>
                                      </div>
                                    )}
                                    {(slot.classroom || slot.room) && (
                                      <div className="edu-tt-room">{slot.classroom?.name || slot.room?.name}</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </td>
                          );
                        })}
                      </tr>
                      {hasBreak && (
                        <tr key={`b${p}`} className="edu-break-row">
                          <td className="edu-break-col"><span className="edu-break-label">{brk?.name || "BREAK"}</span></td>
                          <td colSpan={6} className="edu-break-cell"><span className="edu-break-text">Break</span></td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="edu-tt-footer">
        <div className="edu-tt-foot-info">
          <span>{entityName}</span>
          {termData && <span>Term: {termData.name}</span>}
          <span>Periods: {tSettings.periodsPerDay} | Break: after P{tSettings.breakAfterPeriod}</span>
        </div>
        <button className="edu-tt-print" style={{ opacity: 0.5, cursor: 'not-allowed' }} disabled title="PDF export via report service">
          <i className="fa fa-file-pdf" /> PDF Export
        </button>
      </div>
    </div>
  );
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap');

  .edu-tt {
    font-family: 'Open Sans', Arial, sans-serif;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    overflow: hidden;
  }

  .edu-tt-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 16px 20px;
    background: #f8f8f8;
    border-bottom: 1px solid #e0e0e0;
    flex-wrap: wrap;
    gap: 12px;
  }

  .edu-tt-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: #fff3cd;
    border-bottom: 1px solid #ffc107;
    color: #856404;
    font-size: 12px;
    font-weight: 500;
  }

  .edu-tt-warning svg {
    flex-shrink: 0;
    color: #ffc107;
  }

  .edu-tt-violations {
    background: #fff8e1;
    border-bottom: 1px solid #ffc107;
    padding: 10px 20px;
  }

  .edu-tt-violations-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #e65100;
    margin-bottom: 8px;
  }

  .edu-tt-violations-header svg {
    flex-shrink: 0;
    color: #ff9800;
  }

  .edu-tt-violations-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .edu-tt-violation {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .edu-tt-violation--warning {
    background: #fff3e0;
    color: #bf360c;
  }

  .edu-tt-violation--error {
    background: #ffebee;
    color: #c62828;
  }

  .edu-tt-violation-code {
    font-weight: 700;
    font-size: 10px;
    text-transform: uppercase;
    background: rgba(0,0,0,0.08);
    padding: 2px 6px;
    border-radius: 3px;
  }

  .edu-tt-violation-msg {
    flex: 1;
  }

  .edu-tt-title {
    font-size: 20px;
    font-weight: 700;
    color: #111;
    margin: 0 0 2px;
  }

  .edu-tt-school {
    font-size: 13px;
    color: #888;
    margin: 0;
  }

  .edu-tt-controls {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .edu-tt-tabs {
    display: flex;
    gap: 4px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 2px;
  }

  .edu-tt-tab {
    padding: 6px 12px;
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
    color: #555;
    font-weight: 500;
    transition: all 0.15s;
  }

  .edu-tt-tab:hover { background: #f0f0f0; }
  .edu-tt-tab.active { background: #ea6645; color: #fff; }

  .edu-tt-select {
    padding: 6px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 13px;
    background: #fff;
    cursor: pointer;
    min-width: 140px;
    font-family: inherit;
  }

  .edu-tt-select:focus { outline: none; border-color: #ea6645; }

  .edu-tt-wrap { overflow-x: auto; }

  .edu-tt-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    min-width: 850px;
  }

  .edu-tt-table th,
  .edu-tt-table td {
    border: 1px solid #ddd;
    vertical-align: top;
  }

  .edu-tt-table thead th {
    background: #ea6645;
    color: #fff;
    font-weight: 600;
    text-align: center;
    padding: 8px 6px;
    font-size: 13px;
    border-color: #d55a3d;
  }

  .edu-tt-period-head {
    background: #d55a3d !important;
    width: 90px;
    min-width: 90px;
  }

  .edu-today { box-shadow: inset 0 0 0 2px #4CAF50; }

  .edu-tt-pcell {
    background: #f5f5f5;
    text-align: center;
    padding: 6px 4px;
  }

  .edu-pnum {
    font-size: 16px;
    font-weight: 700;
    display: block;
    line-height: 1;
    color: #333;
  }

  .edu-ptime {
    font-size: 9px;
    color: #777;
    margin-top: 3px;
    display: block;
    white-space: nowrap;
  }

  .edu-tt-cell {
    padding: 2px;
    min-height: 50px;
    vertical-align: top;
  }

  .edu-tt-lesson {
    border-radius: 3px;
    padding: 4px 6px;
    border-left: 3px solid #ea6645;
    margin-bottom: 2px;
    min-height: 42px;
    font-size: 11px;
  }

  .edu-tt-subj {
    font-weight: 700;
    font-size: 11px;
    color: #111;
    line-height: 1.2;
    margin-bottom: 2px;
  }

  .edu-tt-meta {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .edu-tt-group,
  .edu-tt-teacher,
  .edu-tt-room {
    font-size: 10px;
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .edu-tt-group-name { font-weight: 500; }

  .edu-tt-group { color: #888; }
  .edu-tt-teacher { color: #555; }
  .edu-tt-room { color: #777; }

  .edu-tt-ico { width: 9px; height: 9px; flex-shrink: 0; }

  .edu-break-row { background: #fafafa; }

  .edu-break-col {
    background: #eee;
    text-align: center;
    padding: 6px 4px;
  }

  .edu-break-label {
    font-size: 11px;
    font-weight: 700;
    color: #999;
    letter-spacing: 1px;
  }

  .edu-break-cell {
    padding: 10px !important;
    background: repeating-linear-gradient(45deg,#f9f9f9,#f9f9f9 6px,#f0f0f0 6px,#f0f0f0 12px);
    text-align: center;
    vertical-align: middle !important;
  }

  .edu-break-text {
    font-size: 12px;
    font-weight: 600;
    color: #aaa;
    letter-spacing: 2px;
  }

  /* Master grid (classes as rows) */
  .edu-tt-master { min-width: 1200px; }

  .edu-tt-break-head {
    background: #f5f5f5 !important;
    color: #bbb !important;
    font-size: 9px !important;
    font-weight: 600;
    text-align: center;
    padding: 4px 2px !important;
    min-width: 30px;
    max-width: 30px;
    border-color: #e8e8e8 !important;
    letter-spacing: 0.5px;
  }

  .edu-tt-period-subhead {
    background: #ea6645;
    color: #fff;
    font-weight: 600;
    text-align: center;
    padding: 4px 3px;
    font-size: 10px;
    min-width: 48px;
    border-color: #d55a3d;
    line-height: 1.2;
  }

  .edu-ptime-sub {
    display: block;
    font-size: 8px;
    font-weight: 400;
    opacity: 0.8;
    margin-top: 1px;
  }

  .edu-class-name {
    font-weight: 700;
    font-size: 12px;
    color: #333;
    white-space: nowrap;
  }

  .edu-tt-subj, .edu-tt-teacher { cursor: default; }

  .edu-tt-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 20px;
    background: #f8f8f8;
    border-top: 1px solid #e0e0e0;
    flex-wrap: wrap;
    gap: 8px;
  }

  .edu-tt-foot-info {
    display: flex;
    gap: 14px;
    font-size: 11px;
    color: #666;
  }

  .edu-tt-foot-info span { font-weight: 500; }

  .edu-tt-print {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.15s;
  }

  .edu-tt-print:hover { background: #f0f0f0; border-color: #ea6645; color: #ea6645; }

  .edu-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px;
    color: #666;
    gap: 10px;
  }

  .edu-spinner {
    width: 20px; height: 20px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #ea6645;
    border-radius: 50%;
    animation: espin 1s linear infinite;
  }

  @keyframes espin { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }

  .edu-tt-empty {
    text-align: center;
    padding: 50px 20px;
    color: #888;
  }

  .edu-tt-empty h3 { margin: 12px 0 4px; color: #555; font-size: 16px; }
  .edu-tt-empty p { font-size: 13px; margin: 0; }

  @media print {
    .edu-tt-header, .edu-tt-footer { display: none !important; }
    .edu-tt { box-shadow: none; }
    .edu-tt-table thead th { background: #ea6645 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .edu-tt-lesson { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .edu-break-cell { background: #f0f0f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }

  @media (max-width: 768px) {
    .edu-tt-header { flex-direction: column; }
    .edu-tt-controls { width: 100%; flex-direction: column; }
    .edu-tt-select { width: 100%; }
  }
`;
