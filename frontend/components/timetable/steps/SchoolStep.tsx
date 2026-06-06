"use client";

import { useQuery } from "@tanstack/react-query";
import { useWizardStore } from "@/hooks/useWizardStore";
import { api, schoolApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import StepNavigation from "@/components/timetable/StepNavigation";
import { toast } from "sonner";
import React, { useState, useMemo, useEffect } from "react";
import type { BellBreak } from "@/types/timetable";

function formatTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

interface ComputedPeriod {
  period: number;
  start: string;
  end: string;
  startMin: number;
  endMin: number;
}

interface ComputedBreak {
  afterPeriod: number;
  name: string;
  duration: number;
  start: string;
  end: string;
}

function computeBellTimes(
  startTime: string,
  periodsPerDay: number,
  periodDurations: number[],
  breaks: BellBreak[]
): { periods: ComputedPeriod[]; breaks: ComputedBreak[] } {
  let mins = parseTimeToMinutes(startTime);
  const periods: ComputedPeriod[] = [];
  const computedBreaks: ComputedBreak[] = [];
  const breakMap = new Map<number, BellBreak>();
  breaks.forEach((b) => breakMap.set(b.afterPeriod, b));

  for (let i = 1; i <= periodsPerDay; i++) {
    const dur = periodDurations[i - 1] || 40;
    const startMin = mins;
    const endMin = mins + dur;
    periods.push({
      period: i,
      start: formatTime(startMin),
      end: formatTime(endMin),
      startMin,
      endMin,
    });
    mins = endMin;

    const brk = breakMap.get(i);
    if (brk) {
      computedBreaks.push({
        afterPeriod: i,
        name: brk.name || `Break ${i}`,
        duration: brk.duration,
        start: formatTime(mins),
        end: formatTime(mins + brk.duration),
      });
      mins += brk.duration;
    }
  }

  return { periods, breaks: computedBreaks };
}

export default function SchoolStep() {
  const { settings, setSettings, selectedYear, setSelectedYear } = useWizardStore();
  const [isSaving, setIsSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: schoolData } = useQuery({
    queryKey: ["school", "wizard"],
    queryFn: async () => {
      let schoolId = "";
      try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          schoolId = user?.schoolId || "";
        }
      } catch {}
      if (!schoolId) return null;
      try {
        const res = await api.get("/school/");
        const outerData = res.data?.data || res.data;
        const schoolsData = outerData?.data || outerData;
        return Array.isArray(schoolsData)
          ? schoolsData.find((s: any) => s.id === schoolId)
          : null;
      } catch (e) {
        console.error("Wizard school fetch error:", e);
        return null;
      }
    },
  });

  const { data: academicYearsData } = useQuery({
    queryKey: ["academic-years"],
    queryFn: async () => {
      const res: any = await api.get("/academic-year");
      let data = res.data?.data || res.data || [];
      return Array.isArray(data) ? data : [];
    },
  });

  const periodDurations = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < settings.periodsPerDay; i++) {
      arr.push(settings.periodDurations?.[i] || settings.periodDuration || 40);
    }
    return arr;
  }, [settings.periodsPerDay, settings.periodDuration, settings.periodDurations]);

  const { periods: computedPeriods, breaks: computedBreaks } = useMemo(
    () => computeBellTimes(settings.startTime, settings.periodsPerDay, periodDurations, settings.breaks || []),
    [settings.startTime, settings.periodsPerDay, periodDurations, settings.breaks]
  );

  const handlePeriodDurationChange = (periodIdx: number, value: number) => {
    const newDurations = [...(settings.periodDurations || Array(settings.periodsPerDay).fill(settings.periodDuration))];
    while (newDurations.length < settings.periodsPerDay) {
      newDurations.push(settings.periodDuration);
    }
    newDurations[periodIdx] = value;
    setSettings({ periodDurations: newDurations });
  };

  const handlePeriodsPerDayChange = (value: number) => {
    const oldDurations = settings.periodDurations || [];
    const newDurations: number[] = [];
    for (let i = 0; i < value; i++) {
      newDurations.push(oldDurations[i] || settings.periodDuration || 40);
    }
    setSettings({ periodsPerDay: value, periodDurations: newDurations });
  };

  const handleAddBreak = (afterPeriod: number) => {
    const existingBreaks = settings.breaks || [];
    if (existingBreaks.find((b) => b.afterPeriod === afterPeriod)) return;
    const newBreaks = [...existingBreaks, { afterPeriod, duration: settings.breakDuration || 15, name: "Break" }];
    setSettings({ breaks: newBreaks });
  };

  const handleRemoveBreak = (afterPeriod: number) => {
    const newBreaks = (settings.breaks || []).filter((b) => b.afterPeriod !== afterPeriod);
    setSettings({ breaks: newBreaks });
  };

  const handleBreakChange = (afterPeriod: number, field: keyof BellBreak, value: string | number) => {
    const newBreaks = (settings.breaks || []).map((b) =>
      b.afterPeriod === afterPeriod ? { ...b, [field]: value } : b
    );
    setSettings({ breaks: newBreaks });
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await schoolApi.updateTimeSettings({
        startTime: settings.startTime,
        periodsPerDay: settings.periodsPerDay,
        periodDuration: settings.periodDuration,
        daysPerWeek: settings.daysPerWeek,
        breakAfterPeriod: settings.breakAfterPeriod,
        breakDuration: settings.breakDuration,
        breaks: settings.breaks,
        periodDurations: settings.periodDurations,
      });
      console.log("[SchoolStep] Save response:", res.data);
      toast.success("Time settings saved");
    } catch (e: any) {
      console.error("[SchoolStep] Save failed:", e.response?.data || e.message);
      toast.error(e.response?.data?.message || "Failed to save time settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (!mounted) {
    return (
      <Card className="p-6">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-6">School Configuration</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div>
          <label className="block text-sm font-medium mb-1">School Name</label>
          <input
            type="text"
            value={schoolData?.name || ""}
            disabled
            className="w-full border p-2 rounded bg-muted/30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">School Year</label>
          <select
            value={selectedYear || ""}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full border p-2 rounded"
          >
            <option value="">Select Year...</option>
            {academicYearsData?.map((year: any) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Days per Week</label>
          <input
            type="number"
            min="1"
            max="7"
            value={settings.daysPerWeek}
            onChange={(e) => setSettings({ daysPerWeek: +e.target.value })}
            className="w-full border p-2 rounded"
          />
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Time</label>
            <input
              type="time"
              value={settings.startTime}
              onChange={(e) => setSettings({ startTime: e.target.value })}
              className="border p-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Periods per Day</label>
            <input
              type="number"
              min="1"
              max="12"
              value={settings.periodsPerDay}
              onChange={(e) => handlePeriodsPerDayChange(+e.target.value)}
              className="w-24 border p-2 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Default Period Duration (min)</label>
            <input
              type="number"
              min="20"
              max="90"
              value={settings.periodDuration}
              onChange={(e) => {
                const dur = +e.target.value;
                setSettings({ periodDuration: dur });
              }}
              className="w-24 border p-2 rounded"
            />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Bell Times</h3>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-2 font-medium w-24">Period</th>
                <th className="text-left p-2 font-medium">Start</th>
                <th className="text-left p-2 font-medium">End</th>
                <th className="text-left p-2 font-medium w-28">Duration (min)</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {computedPeriods.map((p, idx) => {
                const hasBreak = (settings.breaks || []).some((b) => b.afterPeriod === p.period);
                const brk = (settings.breaks || []).find((b) => b.afterPeriod === p.period);

                return (
                  <React.Fragment key={p.period}>
                    <tr className="border-t">
                      <td className="p-2 font-semibold">Period {p.period}</td>
                      <td className="p-2 font-mono">{p.start}</td>
                      <td className="p-2 font-mono">{p.end}</td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="10"
                          max="90"
                          value={periodDurations[idx]}
                          onChange={(e) => handlePeriodDurationChange(idx, +e.target.value)}
                          className="w-20 border p-1 rounded text-sm"
                        />
                      </td>
                      <td className="p-2">
                        {!hasBreak && p.period < settings.periodsPerDay && (
                          <button
                            onClick={() => handleAddBreak(p.period)}
                            className="text-xs px-2 py-1 rounded border hover:bg-gray-50 transition-colors"
                            title="Add break after this period"
                          >
                            + Break
                          </button>
                        )}
                        {hasBreak && (
                          <button
                            onClick={() => handleRemoveBreak(p.period)}
                            className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove break"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                    {brk && (() => {
                      const cbrk = computedBreaks.find((cb) => cb.afterPeriod === p.period);
                      return (
                        <tr key={`brk-${p.period}`} className="border-t bg-amber-50">
                          <td colSpan={5} className="p-2">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Break</span>
                              <input
                                type="text"
                                value={brk.name || ""}
                                onChange={(e) => handleBreakChange(p.period, "name", e.target.value)}
                                placeholder="Break name"
                                className="border p-1 rounded text-sm w-32"
                              />
                              <span className="text-xs text-gray-500">Starts:</span>
                              <span className="font-mono text-sm">{cbrk?.start}</span>
                              <span className="text-xs text-gray-500">Ends:</span>
                              <span className="font-mono text-sm">{cbrk?.end}</span>
                              <label className="text-xs text-gray-500 ml-2">Duration:</label>
                              <input
                                type="number"
                                min="5"
                                max="60"
                                value={brk.duration}
                                onChange={(e) => handleBreakChange(p.period, "duration", +e.target.value)}
                                className="border p-1 rounded text-sm w-16"
                              />
                              <span className="text-xs text-gray-500">min</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })()}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <StepNavigation prevStep="intro" nextStep="subjects" onNext={handleSaveSettings} />
    </Card>
  );
}
