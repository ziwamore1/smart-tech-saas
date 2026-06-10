"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { calendarSyncApi, classApi } from "@/lib/api";

interface SyncStatus {
  googleConnected: boolean;
  googleEmail?: string;
  lastSync?: string;
  syncedClasses: string[];
}

export function CalendarSyncSettings() {
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [syncMessage, setSyncMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const { data: googleStatus, isLoading: loadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["calendar-google-status"],
    queryFn: async () => {
      const res = await calendarSyncApi.getGoogleStatus();
      return res.data;
    },
  });

  const { data: syncStatus } = useQuery({
    queryKey: ["calendar-sync-status"],
    queryFn: async () => {
      const res = await calendarSyncApi.getSyncStatus();
      return res.data;
    },
  });

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => { const res = await classApi.getAll(); return res.data; },
  });

  const connectGoogle = useMutation({
    mutationFn: async () => {
      const res = await calendarSyncApi.getGoogleAuthUrl();
      return res.data;
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.open(data.authUrl, "_blank", "width=600,height=700");
        setSyncMessage({ type: "info", text: "Please complete the Google authorization in the popup window." });
      }
    },
    onError: () => {
      setSyncMessage({ type: "error", text: "Failed to connect to Google Calendar" });
    },
  });

  const disconnectGoogle = useMutation({
    mutationFn: async () => {
      await calendarSyncApi.disconnectGoogle();
    },
    onSuccess: () => {
      refetchStatus();
      setSyncMessage({ type: "success", text: "Google Calendar disconnected successfully" });
    },
    onError: () => {
      setSyncMessage({ type: "error", text: "Failed to disconnect Google Calendar" });
    },
  });

  const syncToGoogle = useMutation({
    mutationFn: async () => {
      for (const classId of selectedClasses) {
        await calendarSyncApi.syncToGoogle({ classId });
      }
    },
    onSuccess: () => {
      refetchStatus();
      setSyncMessage({ type: "success", text: `Timetable synced to Google Calendar for ${selectedClasses.length} class(es)` });
      setSelectedClasses([]);
    },
    onError: () => {
      setSyncMessage({ type: "error", text: "Failed to sync timetable" });
    },
  });

  const exportICal = useMutation({
    mutationFn: async (classId?: string) => {
      const res = await calendarSyncApi.exportToIcal(classId ? { classId } : {});
      const blob = new Blob([res.data], { type: "text/calendar" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timetable${classId ? `-${classId}` : ""}.ics`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      setSyncMessage({ type: "success", text: "iCal file downloaded" });
    },
    onError: () => {
      setSyncMessage({ type: "error", text: "Failed to export iCal" });
    },
  });

  const toggleClass = (classId: string) => {
    setSelectedClasses(prev =>
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold">Calendar Sync</h2>
            <p className="text-sm text-white/80">Connect your timetable to external calendars</p>
          </div>
        </div>
      </div>

      {syncMessage && (
        <div className={`px-4 py-3 ${
          syncMessage.type === "success" ? "bg-green-50 text-green-800" :
          syncMessage.type === "error" ? "bg-red-50 text-red-800" :
          "bg-blue-50 text-blue-800"
        }`}>
          <div className="flex items-center justify-between">
            <span>{syncMessage.text}</span>
            <button onClick={() => setSyncMessage(null)} className="p-1 hover:bg-black/10 rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="p-6 space-y-6">
        <div className="border-b pb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M19.5 4H5c-1.22 0-2.18.69-2.71 1.71L7 12v7c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-7l4.71-6.29C21.18 4.69 20.22 4 19.5 4zM12 17c-.55 0-1-.45-1-1v-3H8v-2c0-.55-.45-1-1-1s-1 .45-1 1v2c0 .55.45 1 1 1h1v1c0 .55.45 1 1 1s1-.45 1-1v-1h2v1c0 .55.45 1 1 1s1-.45 1-1v-1h1c.55 0 1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1v2c0 .55-.45 1-1 1v3c0 .55-.45 1-1 1z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Google Calendar</h3>
                <p className="text-sm text-gray-500">
                  {googleStatus?.googleConnected
                    ? `Connected as ${googleStatus.googleEmail}`
                    : "Sync your timetable with Google Calendar"
                  }
                </p>
              </div>
            </div>
            <div>
              {googleStatus?.googleConnected ? (
                <button
                  onClick={() => disconnectGoogle.mutate()}
                  disabled={disconnectGoogle.isPending}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => connectGoogle.mutate()}
                  disabled={connectGoogle.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {connectGoogle.isPending ? "Connecting..." : "Connect Google"}
                </button>
              )}
            </div>
          </div>

          {googleStatus?.googleConnected && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">Last synced: {googleStatus.lastSync ? new Date(googleStatus.lastSync).toLocaleString() : "Never"}</span>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select classes to sync</label>
                <div className="flex flex-wrap gap-2">
                  {classes?.map((cls: any) => (
                    <button
                      key={cls.id}
                      onClick={() => toggleClass(cls.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        selectedClasses.includes(cls.id)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {cls.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => syncToGoogle.mutate()}
                  disabled={selectedClasses.length === 0 || syncToGoogle.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {syncToGoogle.isPending ? "Syncing..." : `Sync ${selectedClasses.length} Class(es)`}
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">iCal / Outlook</h3>
              <p className="text-sm text-gray-500">Export timetable as .ics file for any calendar app</p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => exportICal.mutate(undefined)}
              disabled={exportICal.isPending}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Full Timetable (.ics)
            </button>

            <div className="flex gap-2">
              <select
                id="ical-class"
                className="flex-1 border rounded-lg px-3 py-2"
                defaultValue=""
              >
                <option value="">Select a class</option>
                {classes?.map((cls: any) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  const select = document.getElementById("ical-class") as HTMLSelectElement;
                  if (select.value) exportICal.mutate(select.value);
                }}
                disabled={exportICal.isPending}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                Export Class
              </button>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">How to import iCal file</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li><strong>Google Calendar:</strong> Settings → Add calendar → From URL</li>
            <li><strong>Outlook:</strong> Calendar → Add calendar → Subscribe from web</li>
            <li><strong>Apple Calendar:</strong> File → New calendar subscription</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function TimetableCalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week">("month");

  const { data: calendarData } = useQuery({
    queryKey: ["attendance-calendar"],
    queryFn: async () => {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const res = await calendarSyncApi.getSyncStatus();
      return res.data;
    },
  });

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const blanks = Array.from({ length: firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1 }, (_, i) => i);

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-3 flex items-center justify-between">
        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))} className="p-2 hover:bg-white/20 rounded-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold">{currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h3>
          <div className="flex bg-white/20 rounded-lg overflow-hidden">
            <button onClick={() => setView("month")} className={`px-3 py-1 text-sm ${view === "month" ? "bg-white text-blue-600" : "text-white hover:bg-white/20"}`}>Month</button>
            <button onClick={() => setView("week")} className={`px-3 py-1 text-sm ${view === "week" ? "bg-white text-blue-600" : "text-white hover:bg-white/20"}`}>Week</button>
          </div>
        </div>
        <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))} className="p-2 hover:bg-white/20 rounded-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 bg-gray-50 border-b">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
          <div key={day} className="py-2 text-center text-xs font-semibold text-gray-500">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {blanks.map(i => <div key={`blank-${i}`} className="p-2 border-b border-r bg-gray-50 min-h-[100px]" />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const isToday = new Date().getDate() === day && new Date().getMonth() === currentDate.getMonth();
          return (
            <div key={day} className={`p-2 border-b border-r min-h-[100px] ${isToday ? "bg-blue-50" : ""}`}>
              <div className={`text-sm font-medium mb-1 ${isToday ? "text-blue-600" : ""}`}>{day}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
