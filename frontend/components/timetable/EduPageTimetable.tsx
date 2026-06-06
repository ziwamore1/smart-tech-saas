"use client";

import { useQuery } from "@tanstack/react-query";
import { timetableApi, schoolApi } from "@/lib/api";
import { useState, useEffect, useMemo, Fragment } from "react";
import Link from "next/link";
import { abbreviateSubject, abbreviateTeacher } from "@/lib/abbreviations";
import TooltipWrap from "./TooltipWrap";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  slots: Slot[];
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
  "Art": "#E91E63",
  "Music": "#9C27B0",
  "Physical Education": "#FF5722",
  "Religious Education": "#795548",
};

function getSubjectColor(subjectName: string): string {
  if (SUBJECT_COLORS[subjectName]) {
    return SUBJECT_COLORS[subjectName];
  }
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = `hsl(${hash % 360}, 60%, 50%)`;
  return color;
}

export default function EduPageTimetable({ 
  termId, 
  studentData,
  classData,
  slots,
  showBreaks = true,
  compact = false,
}: { 
  termId?: string;
  studentData?: TimetableData['student'];
  classData?: TimetableData['class'];
  slots?: Slot[];
  showBreaks?: boolean;
  compact?: boolean;
}) {
  const [currentWeek, setCurrentWeek] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<Slot | null>(null);

  const { data: fetchedData, isLoading, error } = useQuery<TimetableData>({
    queryKey: ["eduPageTimetable", termId],
    queryFn: async () => {
      const res = await timetableApi.getStudentTimetable(termId || undefined);
      return res.data;
    },
    enabled: !slots,
  });

  const data = slots 
    ? { student: studentData, class: classData, slots } 
    : fetchedData;

  const slotMap = useMemo(() => {
    const map: Record<string, Slot> = {};
    data?.slots.forEach((slot) => {
      map[`${slot.day}-${slot.period}`] = slot;
    });
    return map;
  }, [data?.slots]);

  const getSlot = (day: number, period: number): Slot | undefined => {
    return slotMap[`${day}-${period}`];
  };

  const weekDays = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1) + (currentWeek * 7));
    
    return Array.from({ length: 5 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return {
        dayName: DAYS[i],
        date: date.getDate(),
        month: date.toLocaleString('default', { month: 'short' }),
        fullDate: date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }),
        isToday: date.toDateString() === today.toDateString(),
      };
    });
  }, [currentWeek]);

  const showBreakAfter = showBreaks;

  const { data: timeSettings } = useQuery({
    queryKey: ["edu-timetable-ts"],
    queryFn: async () => {
      const res = await schoolApi.getTimeSettings();
      const d = res.data?.data || res.data;
      return {
        periodsPerDay: d.periodsPerDay || 9,
        startTime: d.startTime || "07:30",
        periodDuration: d.periodDuration || 50,
        breakAfterPeriod: d.breakAfterPeriod ?? 4,
        breakDuration: d.breakDuration || 20,
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

  const breakAfterSet = useMemo(() => {
    if (!timeSettings) return new Set<number>();
    return new Set((timeSettings.breaks || []).map((b: any) => b.afterPeriod));
  }, [timeSettings]);

  const periodCount = timeSettings?.periodsPerDay || 9;
  const PERIODS = Array.from({ length: periodCount }, (_, i) => i + 1);

  const periodTimesMap = useMemo(() => {
    if (!timeSettings?.startTime) return {} as Record<number, string>;
    const [h, m] = timeSettings.startTime.split(":").map(Number);
    let mins = h * 60 + m;
    const breakMap = new Map<number, number>();
    (timeSettings.breaks || []).forEach((b: any) => breakMap.set(b.afterPeriod, b.duration));
    const map: Record<number, string> = {};
    for (let i = 1; i <= periodCount; i++) {
      const dur = timeSettings.periodDurations?.[i - 1] ?? timeSettings.periodDuration ?? 50;
      const start = `${Math.floor(mins / 60).toString().padStart(2, "0")}:${(mins % 60).toString().padStart(2, "0")}`;
      const end = `${Math.floor((mins + dur) / 60).toString().padStart(2, "0")}:${((mins + dur) % 60).toString().padStart(2, "0")}`;
      map[i] = `${start} - ${end}`;
      mins += dur;
      const brk = breakMap.get(i);
      if (brk) mins += brk;
    }
    return map;
  }, [timeSettings, periodCount]);

  if (isLoading) {
    return (
      <div className="edu-timetable-container">
        <div className="edu-loading">
          <div className="edu-spinner"></div>
          <span>Loading timetable...</span>
        </div>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap');
          .edu-timetable-container {
            font-family: 'Open Sans', 'Roboto', Arial, sans-serif;
            background: #fff;
          }
          .edu-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 60px 20px;
            color: #666;
            gap: 12px;
          }
          .edu-spinner {
            width: 24px;
            height: 24px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #ea6645;
            border-radius: 50%;
            animation: edu-spin 1s linear infinite;
          }
          @keyframes edu-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="edu-timetable-container">
        <div className="edu-error">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>Failed to load timetable. Please try again.</span>
        </div>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap');
          .edu-timetable-container {
            font-family: 'Open Sans', 'Roboto', Arial, sans-serif;
            background: #fff;
          }
          .edu-error {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
            color: #d32f2f;
            gap: 8px;
          }
        `}</style>
      </div>
    );
  }

  if (!data?.slots || data.slots.length === 0) {
    return (
      <div className="edu-timetable-container">
        <div className="edu-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <h3>No Timetable Available</h3>
          <p>There is no timetable data available for this term.</p>
          <p>Please contact your school administrator.</p>
        </div>
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap');
          .edu-timetable-container {
            font-family: 'Open Sans', 'Roboto', Arial, sans-serif;
            background: #fff;
          }
          .edu-empty {
            text-align: center;
            padding: 60px 20px;
            color: #666;
          }
          .edu-empty svg {
            color: #ccc;
            margin-bottom: 16px;
          }
          .edu-empty h3 {
            margin: 0 0 8px;
            color: #333;
          }
          .edu-empty p {
            margin: 4px 0;
            font-size: 14px;
          }
        `}</style>
      </div>
    );
  }

  const filteredPeriods = compact && selectedDay !== null
    ? PERIODS.filter(p => getSlot(selectedDay, p))
    : PERIODS;

  return (
    <div className="edu-timetable-container">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap');

        .edu-timetable-container {
          font-family: 'Open Sans', 'Roboto', Arial, sans-serif;
          max-width: 100%;
          margin: 0;
          background: #fff;
        }

        .edu-timetable-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: #f8f8f8;
          border-bottom: 1px solid #e0e0e0;
          flex-wrap: wrap;
          gap: 12px;
        }

        .edu-timetable-title {
          font-size: 18px;
          font-weight: 600;
          color: #111;
          margin: 0;
        }

        .edu-timetable-title span {
          font-weight: 400;
          color: #666;
          font-size: 14px;
          margin-left: 8px;
        }

        .edu-timetable-nav {
          display: flex;
          gap: 8px;
        }

        .edu-nav-btn {
          padding: 6px 12px;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          color: #333;
          transition: all 0.2s;
        }

        .edu-nav-btn:hover {
          background: #f0f0f0;
        }

        .edu-nav-btn.active {
          background: #ea6645;
          color: #fff;
          border-color: #ea6645;
        }

        .edu-week-nav {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .edu-week-nav button {
          padding: 6px 10px;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .edu-week-nav button:hover {
          background: #f0f0f0;
        }

        .edu-week-nav button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .edu-week-label {
          font-size: 13px;
          color: #333;
          font-weight: 500;
        }

        .edu-timetable-wrapper {
          overflow-x: auto;
          padding: 0;
        }

        .edu-timetable {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          min-width: 800px;
        }

        .edu-timetable th,
        .edu-timetable td {
          border: 1px solid #e0e0e0;
          padding: 0;
          vertical-align: top;
        }

        .edu-timetable thead th {
          background: #ea6645;
          color: #111;
          font-weight: 600;
          text-align: center;
          padding: 12px 8px;
          font-size: 14px;
          border: 1px solid #d55a3d;
        }

        .edu-timetable thead th:first-child {
          background: #e55a3d;
          width: 120px;
          min-width: 120px;
        }

        .edu-timetable tbody tr:nth-child(even) {
          background: #ffefeb;
        }

        .edu-timetable tbody tr:nth-child(odd) {
          background: #ffdfd7;
        }

        .edu-period-cell {
          background: #f5f5f5 !important;
          font-weight: 600;
          text-align: center;
          color: #333;
          width: 120px;
          min-width: 120px;
        }

        .edu-period-number {
          font-size: 16px;
          font-weight: 700;
          display: block;
        }

        .edu-period-time {
          font-size: 11px;
          color: #666;
          font-weight: 400;
          margin-top: 2px;
        }

        .edu-lesson-cell {
          padding: 6px;
          min-height: 70px;
        }

        .edu-lesson {
          background: #fff;
          border-radius: 4px;
          padding: 8px 10px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border-left: 4px solid #ea6645;
          transition: all 0.2s;
          cursor: pointer;
        }

        .edu-lesson:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          transform: translateY(-1px);
        }

        .edu-lesson-subject {
          font-weight: 700;
          font-size: 13px;
          color: #111;
          margin-bottom: 4px;
          line-height: 1.3;
        }

        .edu-lesson-teacher {
          font-size: 12px;
          color: #555;
          margin-bottom: 2px;
          display: flex;
          align-items: center;
          gap: 4px;
        .edu-lesson-room {
          font-size: 11px;
          color: #777;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .edu-lesson-icon {
          width: 12px;
          height: 12px;
          opacity: 0.7;
        }

        .edu-empty-cell {
          min-height: 70px;
        }

        .edu-break-cell {
          background: repeating-linear-gradient(
            45deg,
            #f5f5f5,
            #f5f5f5 10px,
            #f0f0f0 10px,
            #f0f0f0 20px
          ) !important;
          text-align: center;
          padding: 20px !important;
        }

        .edu-break-text {
          font-size: 14px;
          font-weight: 600;
          color: #888;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .edu-day-selector {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          padding: 12px 20px;
          background: #fafafa;
          border-bottom: 1px solid #e0e0e0;
        }

        .edu-day-btn {
          padding: 8px 16px;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 20px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 60px;
        }

        .edu-day-btn:hover {
          border-color: #ea6645;
          background: #fff5f3;
        }

        .edu-day-btn.active {
          background: #ea6645;
          color: #fff;
          border-color: #ea6645;
        }

        .edu-day-btn.today {
          border-color: #4CAF50;
          border-width: 2px;
        }

        .edu-day-name {
          font-weight: 600;
        }

        .edu-day-date {
          font-size: 11px;
          opacity: 0.8;
        }

        .edu-timetable-footer {
          padding: 12px 20px;
          background: #f8f8f8;
          border-top: 1px solid #e0e0e0;
          font-size: 12px;
          color: #666;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .edu-week-info {
          font-weight: 500;
        }

        .edu-powered {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .edu-print-btn {
          padding: 6px 12px;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          color: #333;
          transition: all 0.2s;
        }

        .edu-print-btn:hover {
          background: #f0f0f0;
        }

        .edu-legend {
          display: flex;
          gap: 16px;
          padding: 12px 20px;
          background: #fafafa;
          border-top: 1px solid #e0e0e0;
          flex-wrap: wrap;
        }

        .edu-legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #666;
        }

        .edu-legend-color {
          width: 16px;
          height: 16px;
          border-radius: 3px;
        }

        .edu-timetable-view-toggle {
          display: flex;
          gap: 4px;
          margin-left: auto;
        }

        .edu-view-btn {
          padding: 6px 12px;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }

        .edu-view-btn.active {
          background: #ea6645;
          color: #fff;
          border-color: #ea6645;
        }

        @media print {
          .edu-timetable-header,
          .edu-timetable-nav,
          .edu-day-selector,
          .edu-timetable-footer,
          .edu-legend {
            display: none;
          }
          
          .edu-timetable-container {
            box-shadow: none;
          }

          .edu-timetable {
            min-width: unset;
          }
        }

        @media (max-width: 768px) {
          .edu-timetable-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .edu-day-selector {
            overflow-x: auto;
            flex-wrap: nowrap;
            -webkit-overflow-scrolling: touch;
          }

          .edu-day-btn {
            min-width: 50px;
            padding: 6px 12px;
          }
        }
      `}</style>

      <div className="edu-timetable-header">
        <div>
          <h2 className="edu-timetable-title">
            {data?.student ? (
              <>
                {data.student.firstName} {data.student.lastName}
                {data.class && <span>- {data.class.name}</span>}
              </>
            ) : (
              "Weekly Timetable"
            )}
          </h2>
        </div>
        <div className="edu-week-nav">
          <button 
            onClick={() => setCurrentWeek(w => Math.max(0, w - 1))}
            disabled={currentWeek === 0}
          >
            &lt;
          </button>
          <span className="edu-week-label">
            {weekDays[0]?.fullDate} - {weekDays[4]?.fullDate}
          </span>
          <button onClick={() => setCurrentWeek(w => w + 1)}>
            &gt;
          </button>
          <div className="edu-timetable-view-toggle">
            <button 
              className={`edu-view-btn ${!compact ? 'active' : ''}`}
              onClick={() => setSelectedDay(null)}
            >
              Week
            </button>
            <button 
              className={`edu-view-btn ${compact ? 'active' : ''}`}
              onClick={() => setSelectedDay(new Date().getDay() - 1 || 0)}
            >
              Day
            </button>
          </div>
        </div>
      </div>

      <div className="edu-day-selector">
        {weekDays.map((day, idx) => (
          <button
            key={idx}
            className={`edu-day-btn ${selectedDay === idx ? 'active' : ''} ${day.isToday ? 'today' : ''}`}
            onClick={() => setSelectedDay(selectedDay === idx ? null : idx)}
          >
            <span className="edu-day-name">{day.dayName}</span>
            <span className="edu-day-date">{day.date} {day.month}</span>
          </button>
        ))}
      </div>

      <div className="edu-timetable-wrapper">
        <table className="edu-timetable">
          <thead>
            <tr>
              <th>Period</th>
              {selectedDay !== null 
                ? (
                  <th>{weekDays[selectedDay]?.dayName}</th>
                )
                : DAYS.slice(0, 5).map((day, idx) => (
                  <th key={idx}>{day}</th>
                ))
              }
            </tr>
          </thead>
          <tbody>
            {(selectedDay !== null ? PERIODS : filteredPeriods).flatMap((period) => {
              const rows = [
                <tr key={period}>
                  <td className="edu-period-cell">
                    <span className="edu-period-number">{period}</span>
                    <span className="edu-period-time">{periodTimesMap[period]}</span>
                  </td>
                  {selectedDay !== null ? (
                    <td className={getSlot(selectedDay + 1, period) ? "edu-lesson-cell" : "edu-empty-cell"}>
                      {(() => {
                        const slot = getSlot(selectedDay + 1, period);
                        return slot ? (
                          <div 
                            className="edu-lesson"
                            style={{ borderLeftColor: getSubjectColor(slot.subject.name) }}
                            onMouseEnter={() => setHoveredSlot(slot)}
                            onMouseLeave={() => setHoveredSlot(null)}
                          >
                            <div className="edu-lesson-subject"><TooltipWrap text={slot.subject.name}><span>{abbreviateSubject(slot.subject.name)}</span></TooltipWrap></div>
                            <div className="edu-lesson-teacher">
                              <svg className="edu-lesson-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                              </svg>
                              <TooltipWrap text={`${slot.teacher.user.firstName} ${slot.teacher.user.lastName}`}><span>{abbreviateTeacher(slot.teacher)}</span></TooltipWrap>
                            </div>
                            {(slot.classroom || slot.room) && (
                              <div className="edu-lesson-room">
                                <svg className="edu-lesson-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                  <circle cx="12" cy="10" r="3"/>
                                </svg>
                                {slot.classroom?.name || slot.room?.name}
                              </div>
                            )}
                          </div>
                        ) : null;
                      })()}
                    </td>
                  ) : (
                    DAYS.slice(0, 5).map((_, dayIdx) => {
                      const slot = getSlot(dayIdx + 1, period);
                      return (
                        <td key={`${dayIdx}-${period}`} className={slot ? "edu-lesson-cell" : "edu-empty-cell"}>
                          {slot ? (
                            <div 
                              className="edu-lesson"
                              style={{ borderLeftColor: getSubjectColor(slot.subject.name) }}
                              onMouseEnter={() => setHoveredSlot(slot)}
                              onMouseLeave={() => setHoveredSlot(null)}
                            >
                            <div className="edu-lesson-subject"><TooltipWrap text={slot.subject.name}><span>{abbreviateSubject(slot.subject.name)}</span></TooltipWrap></div>
                            <div className="edu-lesson-teacher">
                              <svg className="edu-lesson-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                              </svg>
                              <TooltipWrap text={`${slot.teacher.user.firstName} ${slot.teacher.user.lastName}`}><span>{abbreviateTeacher(slot.teacher)}</span></TooltipWrap>
                            </div>
                              {(slot.classroom || slot.room) && (
                                <div className="edu-lesson-room">
                                  <svg className="edu-lesson-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                    <circle cx="12" cy="10" r="3"/>
                                  </svg>
                                  {slot.classroom?.name || slot.room?.name}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </td>
                      );
                    })
                  )}
                </tr>
              ]

              if (showBreakAfter && breakAfterSet.has(period)) {
                rows.push(
                  <tr key={`break-after-${period}`}>
                    <td className="edu-period-cell" style={{ background: '#f5f5f5' }}>
                      <span className="edu-period-number" style={{ color: '#888' }}>Break</span>
                      <span className="edu-period-time" style={{ color: '#aaa' }}>Recess</span>
                    </td>
                    <td colSpan={selectedDay !== null ? 1 : 5} className="edu-break-cell">
                      <span className="edu-break-text">Break</span>
                    </td>
                  </tr>
                )
              }

              return rows
            })}
          </tbody>
        </table>
      </div>

      <div className="edu-legend">
        <span style={{ fontWeight: 600, color: '#333' }}>Subjects:</span>
        {Object.entries(SUBJECT_COLORS).slice(0, 6).map(([name, color]) => (
          <div key={name} className="edu-legend-item">
            <span className="edu-legend-color" style={{ backgroundColor: color }}></span>
            <span>{name}</span>
          </div>
        ))}
      </div>

      <div className="edu-timetable-footer">
        <span className="edu-week-info">
          Week {currentWeek + 1} - Term {termId || "Active"}
        </span>
        <div>
          <button className="edu-print-btn" style={{ opacity: 0.5, cursor: 'not-allowed' }} disabled title="PDF export via report service">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4, verticalAlign: 'middle' }}>
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            PDF Export
          </button>
          <span className="edu-powered" style={{ marginLeft: '12px' }}>
            Powered by Smart Tech SaaS
          </span>
        </div>
      </div>
    </div>
  );
}
