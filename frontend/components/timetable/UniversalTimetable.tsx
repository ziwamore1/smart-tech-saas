"use client";

import { useQuery } from "@tanstack/react-query";
import { timetableApi, classApi, teacherApi, authApi, subjectApi, schoolApi } from "@/lib/api";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import dynamic from "next/dynamic";
import { DndContext, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { abbreviateSubject, abbreviateTeacher } from "@/lib/abbreviations";
import TooltipWrap from "./TooltipWrap";

const TimetableEditorModal = dynamic(() => import("./TimetableEditorModal"), { ssr: false });
const GenerationPanel = dynamic(() => import("./GenerationPanel"), { ssr: false });
const LessonRequirementsPanel = dynamic(() => import("./LessonRequirementsPanel"), { ssr: false });

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type ViewType = "class" | "teacher" | "room" | "student";
export type ColorBy = "subject" | "teacher" | "room" | "none";
export type ThemeMode = "light" | "dark";
export type UserRole = "student" | "teacher" | "admin" | "parent" | "guest";
export type WeekType = "A" | "B" | "regular";

const ABBREVIATIONS: Record<string, string> = {
  "Mathematics": "MATH",
  "English": "ENG",
  "Science": "SCI",
  "History": "HIST",
  "Geography": "GEOG",
  "Physics": "PHYS",
  "Chemistry": "CHEM",
  "Biology": "BIO",
  "Computer Science": "CS",
  "Art": "ART",
  "Music": "MUS",
  "Physical Education": "PE",
  "Religious Education": "RE",
  "Monday": "Mon",
  "Tuesday": "Tue",
  "Wednesday": "Wed",
  "Thursday": "Thu",
  "Friday": "Fri",
  "Saturday": "Sat",
  "Sunday": "Sun",
};

interface NotificationItem {
  id: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  link?: string;
}

interface Slot {
  id: string;
  day: number;
  period: number;
  subject: { id: string; name: string };
  teacher: { id: string; user: { firstName: string; lastName: string } };
  classroom?: { id: string; name: string };
  room?: { id: string; name: string };
  classGroup?: { id: string; name: string };
  weekType?: WeekType;
  isCancelled?: boolean;
  isSubstituted?: boolean;
}

interface DisplaySlot extends Slot {
  originalSlot?: Slot;
  substitution?: Substitution;
}

interface Substitution {
  id: string;
  originalSlotId: string;
  date: string;
  newTeacherId?: string;
  newTeacher?: { id: string; user: { firstName: string; lastName: string } };
  newRoomId?: string;
  newRoom?: { id: string; name: string };
  newSubjectId?: string;
  newSubject?: { id: string; name: string };
  reason: string;
  isCancelled: boolean;
  createdAt: string;
  createdBy: string;
}

interface TimetableData {
  student?: { id: string; firstName: string; lastName: string; admissionNumber: string };
  class?: { id: string; name: string; weekRotation?: boolean; weekTypes?: WeekType[] };
  teacher?: { id: string; user: { firstName: string; lastName: string } };
  room?: { id: string; name: string };
  slots: Slot[];
  currentWeekType?: WeekType;
  termId?: string;
  termName?: string;
}

interface User {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  classId?: string;
  teacherId?: string;
}

const SUBJECT_COLORS: Record<string, string> = {
  "Mathematics": "#4CAF50", "English": "#2196F3", "Science": "#9C27B0",
  "History": "#FF9800", "Geography": "#009688", "Physics": "#00BCD4",
  "Chemistry": "#8BC34A", "Biology": "#4CAF50", "Computer Science": "#607D8B",
  "Art": "#E91E63", "Music": "#9C27B0", "Physical Education": "#FF5722",
  "Religious Education": "#795548",
};

function getColorBySubject(name: string): string {
  if (SUBJECT_COLORS[name]) return SUBJECT_COLORS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${hash % 360}, 60%, 50%)`;
}

function getColorByTeacher(name: string): string {
  const colors = ["#E91E63", "#9C27B0", "#673AB7", "#3F51B5", "#2196F3", "#03A9F4", "#00BCD4", "#009688", "#4CAF50", "#8BC34A", "#CDDC39", "#FFC107", "#FF9800", "#FF5722", "#795548"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getColorByRoom(name: string): string {
  const colors = ["#ecf0f1", "#d5dbdb", "#f5b7b1", "#fadbd8", "#d4e6f1", "#d6eaf8", "#d1f2eb", "#d5f5e3", "#fcf3cf", "#fdebd0"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getColor(slot: Slot, colorBy: ColorBy): string {
  switch (colorBy) {
    case "subject": return getColorBySubject(slot.subject.name);
    case "teacher": return getColorByTeacher(`${slot.teacher.user.firstName} ${slot.teacher.user.lastName}`);
    case "room": return getColorByRoom(slot.classroom?.name || slot.room?.name || "");
    default: return "#ea6645";
  }
}

export default function UniversalTimetable({
  viewType = "class",
  schoolName = "School Name",
  showBreaks = true,
  numberOfPeriods: initialPeriods = 9,
  defaultPeriodTimes,
  initialUserRole = "guest",
  initialEntityId = "",
}: {
  viewType?: ViewType;
  schoolName?: string;
  showBreaks?: boolean;
  numberOfPeriods?: number;
  defaultPeriodTimes?: Record<number, string>;
  initialUserRole?: UserRole;
  initialEntityId?: string;
}) {
  const [view, setView] = useState<ViewType>(viewType);
  const [colorBy, setColorBy] = useState<ColorBy>("subject");
  const [selectedEntity, setSelectedEntity] = useState<string>(initialEntityId);
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [currentWeek, setCurrentWeek] = useState(0);
  const [showWeekends, setShowWeekends] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showMobileCards, setShowMobileCards] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  const [filterSubject, setFilterSubject] = useState<string>("");
  const [filterTeacher, setFilterTeacher] = useState<string>("");
  const [showSubstitutions, setShowSubstitutions] = useState(true);
  const [navigationMode, setNavigationMode] = useState<"week" | "day">("week");
  const [selectedWeekType, setSelectedWeekType] = useState<WeekType>("regular");
  const [periodTimes, setPeriodTimes] = useState<Record<number, string>>(
    defaultPeriodTimes || {
      1: "07:30 - 08:20", 2: "08:20 - 09:10", 3: "09:10 - 10:00",
      4: "10:00 - 10:50", 5: "10:50 - 11:40", 6: "11:40 - 12:30",
      7: "12:30 - 13:20", 8: "13:20 - 14:10", 9: "14:10 - 15:00", 10: "15:00 - 15:50",
    }
  );
  const [notification, setNotification] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          if (user?.roles?.includes('Director') || user?.roles?.includes('Admin')) return 'admin';
          if (user?.roles?.includes('Teacher')) return 'teacher';
          if (user?.roles?.includes('Student')) return 'student';
          if (user?.roles?.includes('Parent')) return 'parent';
        } catch (e) {}
      }
      const savedRole = localStorage.getItem('timetable-user-role') as UserRole;
      if (savedRole) return savedRole;
    }
    return initialUserRole;
  });
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const socketRef = useRef<any>(null);
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState<{ slot: Slot; position: { x: number; y: number } } | null>(null);
  const [showLegendModal, setShowLegendModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [stickyHeader, setStickyHeader] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [periodsCount, setPeriodsCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('timetable-periods');
      return saved ? parseInt(saved) : initialPeriods;
    }
    return initialPeriods;
  });
  
  // Break Period Settings
  const [breakBeforePeriod, setBreakBeforePeriod] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('timetable-break-before');
      return saved ? parseInt(saved) : 4; // Default: break before period 4
    }
    return 4;
  });
  
  const [breakDuration, setBreakDuration] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('timetable-break-duration') || '10 min';
    }
    return '10 min';
  });
  
  // Editor Modal State
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editorMode, setEditorMode] = useState<'add' | 'edit'>('add');
  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [editorDay, setEditorDay] = useState(1);
  const [editorPeriod, setEditorPeriod] = useState(1);
  
  // Generation Panel State
  const [showGenerationPanel, setShowGenerationPanel] = useState(false);
  
  // Lesson Requirements Panel State
  const [showRequirementsPanel, setShowRequirementsPanel] = useState(true);

  const PERIODS = Array.from({ length: periodsCount }, (_, i) => i + 1);
  const VISIBLE_DAYS = showWeekends ? DAYS : DAYS.slice(0, 5);

  useEffect(() => {
    const savedTheme = localStorage.getItem("timetable-theme") as ThemeMode;
    if (savedTheme) setTheme(savedTheme);
    
    const savedRole = localStorage.getItem("timetable-user-role") as UserRole;
    if (savedRole) setUserRole(savedRole);
  }, []);

  useEffect(() => {
    localStorage.setItem("timetable-theme", theme);
    localStorage.setItem("timetable-user-role", userRole);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme, userRole]);

  useEffect(() => {
    const handleStorageChange = () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          if (user?.roles?.includes('Director') || user?.roles?.includes('Admin')) setUserRole('admin');
          else if (user?.roles?.includes('Teacher')) setUserRole('teacher');
          else if (user?.roles?.includes('Student')) setUserRole('student');
          else if (user?.roles?.includes('Parent')) setUserRole('parent');
        } catch (e) {}
      } else {
        setUserRole('guest');
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    handleStorageChange();
    
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    setIsAuthenticated(!!token);
  }, []);

  useEffect(() => {
    if (initialEntityId) {
      setSelectedEntity(initialEntityId);
    }
  }, []);

  useEffect(() => {
    if (pushNotifications && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [pushNotifications]);

  const getCurrentPeriod = useCallback((): number | null => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const currentMinutes = hours * 60 + minutes;
    
    const periodBoundaries: Record<number, [number, number]> = {
      1: [7 * 60 + 30, 8 * 60 + 20],
      2: [8 * 60 + 20, 9 * 60 + 10],
      3: [9 * 60 + 10, 10 * 60],
      4: [10 * 60, 10 * 60 + 50],
      5: [10 * 60 + 50, 11 * 60 + 40],
      6: [11 * 60 + 40, 12 * 60 + 30],
      7: [12 * 60 + 30, 13 * 60 + 20],
      8: [13 * 60 + 20, 14 * 60 + 10],
      9: [14 * 60 + 10, 15 * 60],
      10: [15 * 60, 15 * 60 + 50],
    };
    
    for (const [period, [start, end]] of Object.entries(periodBoundaries)) {
      if (currentMinutes >= start && currentMinutes < end) {
        return parseInt(period);
      }
    }
    return null;
  }, [currentTime]);

  const isCurrentPeriod = (period: number): boolean => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    return getCurrentPeriod() === period;
  };

  const addNotification = useCallback((type: NotificationItem["type"], title: string, message: string, link?: string) => {
    const newNotification: NotificationItem = {
      id: Date.now().toString(),
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
      link,
    };
    setNotifications(prev => [newNotification, ...prev].slice(0, 50));
    
    if (pushNotifications && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body: message, icon: "/favicon.ico" });
    }
  }, [pushNotifications]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const generateShareLink = useCallback(async () => {
    const params = new URLSearchParams({
      view: view,
      entity: selectedEntity,
      term: selectedTerm,
      week: currentWeek.toString(),
    });
    const link = `${window.location.origin}/timetable/view?${params.toString()}`;
    setShareLink(link);
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${schoolName} Timetable`,
          text: `View the timetable`,
          url: link,
        });
        return;
      } catch (e) {}
    }
    setShowShareModal(true);
  }, [view, selectedEntity, selectedTerm, currentWeek, schoolName]);

  const handleCopyShareLink = useCallback(() => {
    navigator.clipboard.writeText(shareLink);
    showNotification("Share link copied to clipboard!");
  }, [shareLink]);

  const handlePrintWithPDF = useCallback(() => {
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${schoolName} Timetable</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: center; }
            th { background-color: #ea6645; color: white; }
            .period { font-weight: bold; background: #f5f5f5; }
            .lesson { padding: 5px; }
          </style>
        </head>
        <body>
          <h1>${schoolName} - ${getEntityLabel() || "Timetable"}</h1>
          <p style="text-align:center;color:#666;">Generated on ${new Date().toLocaleDateString()}</p>
          ${document.querySelector(".ut-table-wrapper")?.innerHTML || ""}
        </body>
      </html>
    `;
    
    const blob = new Blob([printContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${schoolName}_Timetable.html`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Timetable downloaded as HTML file');
  }, [schoolName, selectedEntity]);

  const showNotification = (msg: string, type: "success" | "error" | "info" = "success") => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 4000);
  };

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).io) {
      const socket = (window as any).io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001");
      socketRef.current = socket;

      socket.on("timetable-update", (data: { type: string; message: string }) => {
        showNotification(data.message, "info");
        setHasChanges(true);
        setLastUpdated(new Date());
      });

      socket.on("substitution-added", (sub: Substitution) => {
        setSubstitutions(prev => [...prev, sub]);
        showNotification(`New substitution: ${sub.reason}`, "info");
      });

      socket.on("substitution-cancelled", (subId: string) => {
        setSubstitutions(prev => prev.filter(s => s.id !== subId));
        showNotification("Substitution cancelled", "info");
      });

      return () => {
        socket.disconnect();
      };
    }
  }, []);

  const hasRoleAccess = useCallback((requiredRoles: UserRole[]): boolean => {
    if (requiredRoles.includes("guest")) return true;
    return requiredRoles.includes(userRole);
  }, [userRole]);

  const getAvailableViews = useCallback((): ViewType[] => {
    switch (userRole) {
      case "admin": return ["class", "teacher", "room", "student"];
      case "teacher": return ["teacher", "class", "student"];
      case "student": return ["student", "class"];
      case "parent": return ["student"];
      case "guest": return ["class"];
      default: return ["class"];
    }
  }, [userRole]);

  useEffect(() => {
    const availableViews = getAvailableViews();
    if (!availableViews.includes(view)) {
      setView(availableViews[0]);
    }
  }, [userRole, view, getAvailableViews]);

  const { data: schoolData } = useQuery({
    queryKey: ["school"],
    queryFn: async () => { 
      const res = await schoolApi.getProfile(); 
      return res.data?.data || res.data;
    },
    retry: false,
  });

  const { data: termData } = useQuery({
    queryKey: ["current-term"],
    queryFn: async () => { 
      const res = await timetableApi.getCurrentTerm(); 
      return res.data?.data || res.data;
    },
  });

  const { data: classesData } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => { 
      const res = await classApi.getAll(); 
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: teachersData } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => { 
      const res = await teacherApi.getAll(); 
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: roomsData } = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => { 
      const res = await timetableApi.getRooms(); 
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: myTimetable } = useQuery({
    queryKey: ["my-timetable", selectedTerm],
    queryFn: async () => { const res = await timetableApi.getMyTimetable(selectedTerm || undefined); return res.data; },
    enabled: view === "student" && !!selectedTerm,
  });

  const { data: classTimetable } = useQuery({
    queryKey: ["class-timetable", selectedEntity, selectedTerm],
    queryFn: async () => { const res = await timetableApi.getClassTimetable(selectedEntity, selectedTerm); return res.data?.data || res.data; },
    enabled: view === "class" && !!selectedEntity && !!selectedTerm,
  });

  const { data: teacherTimetable } = useQuery({
    queryKey: ["teacher-timetable", selectedEntity, selectedTerm],
    queryFn: async () => { const res = await timetableApi.getTeacherTimetable(selectedEntity, selectedTerm); return res.data?.data || res.data; },
    enabled: view === "teacher" && !!selectedEntity && !!selectedTerm,
  });

  const { data: roomTimetable } = useQuery({
    queryKey: ["room-timetable", selectedEntity, selectedTerm],
    queryFn: async () => { const res = await timetableApi.getRoomTimetable(selectedEntity, selectedTerm); return res.data?.data || res.data; },
    enabled: view === "room" && !!selectedEntity && !!selectedTerm,
  });

  const { data: substitutionsData, refetch: refetchSubstitutions } = useQuery({
    queryKey: ["substitutions", selectedEntity, selectedTerm, view],
    queryFn: async () => {
      const params: any = { termId: selectedTerm };
      if (view === "class") params.classId = selectedEntity;
      if (view === "teacher") params.teacherId = selectedEntity;
      if (view === "room") params.roomId = selectedEntity;
      const res = await timetableApi.getSubstitutions(params);
      return res.data || [];
    },
    enabled: false,
    retry: false,
  });

  useEffect(() => {
    if (substitutionsData) {
      setSubstitutions(substitutionsData);
    }
  }, [substitutionsData]);

  useEffect(() => {
    if (termData?.id && !selectedTerm) setSelectedTerm(termData.id);
  }, [termData, selectedTerm]);

  const timetableData = useMemo(() => {
    switch (view) {
      case "student": return myTimetable;
      case "class": return classTimetable;
      case "teacher": return teacherTimetable;
      case "room": return roomTimetable;
      default: return null;
    }
  }, [view, myTimetable, classTimetable, teacherTimetable, roomTimetable]);

  const getActiveSubstitution = useCallback((slotId: string, date: Date): Substitution | undefined => {
    const dateStr = date.toISOString().split("T")[0];
    return substitutions.find(sub => 
      sub.originalSlotId === slotId && 
      sub.date === dateStr
    );
  }, [substitutions]);

  const applySubstitution = useCallback((slot: Slot, date: Date): Slot => {
    const sub = getActiveSubstitution(slot.id, date);
    if (!sub) return slot;
    
    if (sub.isCancelled) {
      return { ...slot, isCancelled: true };
    }

    return {
      ...slot,
      teacher: sub.newTeacher || slot.teacher,
      room: sub.newRoom || slot.room,
      subject: sub.newSubject || slot.subject,
      classroom: sub.newRoom || slot.classroom,
      isSubstituted: true,
    };
  }, [getActiveSubstitution]);

  const filteredSlots = useMemo(() => {
    let slots: Slot[] = timetableData?.slots || [];
    
    if (filterSubject) slots = slots.filter((s: Slot) => s.subject.id === filterSubject);
    if (filterTeacher) slots = slots.filter((s: Slot) => s.teacher.id === filterTeacher);
    
    if (selectedWeekType !== "regular") {
      slots = slots.filter(s => !s.weekType || s.weekType === selectedWeekType || s.weekType === "regular");
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      slots = slots.filter(s => 
        s.subject.name.toLowerCase().includes(query) ||
        `${s.teacher.user.firstName} ${s.teacher.user.lastName}`.toLowerCase().includes(query) ||
        (s.classroom?.name || s.room?.name || "").toLowerCase().includes(query) ||
        s.classGroup?.name.toLowerCase().includes(query)
      );
    }
    
    return slots;
  }, [timetableData?.slots, filterSubject, filterTeacher, selectedWeekType, searchQuery]);

  const abbreviationExpanded = useCallback((text: string): string => {
    return ABBREVIATIONS[text] || text;
  }, []);

  const getLessonTooltip = useCallback((slot: Slot): string => {
    const sub = getActiveSubstitution(slot.id, new Date());
    let tooltip = `${slot.subject.name}`;
    if (sub && !sub.isCancelled) {
      tooltip += `\n[Substituted] ${sub.reason}`;
    }
    if (sub?.isCancelled) {
      tooltip += `\n[Cancelled]`;
    }
    tooltip += `\nTeacher: ${slot.teacher.user.firstName} ${slot.teacher.user.lastName}`;
    if (slot.classroom?.name || slot.room?.name) {
      tooltip += `\nRoom: ${slot.classroom?.name || slot.room?.name}`;
    }
    if (slot.classGroup?.name) {
      tooltip += `\nClass: ${slot.classGroup.name}`;
    }
    if (slot.weekType && slot.weekType !== "regular") {
      tooltip += `\nWeek: ${slot.weekType}`;
    }
    return tooltip;
  }, [getActiveSubstitution]);

  const slotMap = useMemo(() => {
    const map: Record<string, Slot> = {};
    filteredSlots.forEach((slot: Slot) => { map[`${slot.day}-${slot.period}`] = slot; });
    return map;
  }, [filteredSlots]);

  const getSlot = (day: number, period: number) => slotMap[`${day}-${period}`];

  const weekDays = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1) + (currentWeek * 7));
    return Array.from({ length: showWeekends ? 7 : 5 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      return {
        dayNum: i + 1, dayName: DAYS[i], date: date.getDate(),
        month: date.toLocaleString("default", { month: "short" }),
        fullDate: date.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" }),
        isToday: date.toDateString() === today.toDateString(),
      };
    });
  }, [currentWeek, showWeekends]);

  const isBreak = (period: number) => showBreaks && period === breakBeforePeriod;

  const getEntityLabel = () => {
    switch (view) {
      case "class": return (classesData || [])?.find((c: any) => c.id === selectedEntity)?.name || "";
      case "teacher": { const t = (teachersData || [])?.find((t: any) => t.id === selectedEntity); return t ? `${t.user.firstName} ${t.user.lastName}` : ""; }
      case "room": return (roomsData || [])?.find((r: any) => r.id === selectedEntity)?.name || "";
      case "student": return timetableData?.student ? `${timetableData.student.firstName} ${timetableData.student.lastName}` : "";
      default: return "";
    }
  };

  const uniqueSubjects = useMemo((): {id: string; name: string}[] => {
    const subjects: {id: string; name: string}[] = filteredSlots.map((s: Slot) => ({ id: s.subject.id, name: s.subject.name }));
    return Array.from(new Map(subjects.map((s) => [s.id, s] as [string, {id: string; name: string}])).values());
  }, [filteredSlots]);

  const uniqueTeachers = useMemo((): {id: string; name: string}[] => {
    const teachers: {id: string; name: string}[] = filteredSlots.map((s: Slot) => ({ id: s.teacher.id, name: `${s.teacher.user.firstName} ${s.teacher.user.lastName}` }));
    return Array.from(new Map(teachers.map((t) => [t.id, t] as [string, {id: string; name: string}])).values());
  }, [filteredSlots]);

  const handlePrint = useCallback(() => { handlePrintWithPDF(); }, [handlePrintWithPDF]);

  const handleExportExcel = useCallback(() => {
    const data = filteredSlots.map((s: Slot) => ({
      Day: DAYS[s.day - 1], Period: s.period, Time: periodTimes[s.period] || "",
      Subject: s.subject.name, Teacher: `${s.teacher.user.firstName} ${s.teacher.user.lastName}`,
      Room: s.classroom?.name || s.room?.name || "", Class: timetableData?.class?.name || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Timetable");
    XLSX.writeFile(wb, `timetable_${view}_${getEntityLabel() || "export"}.xlsx`);
    showNotification("Exported to Excel successfully!");
    setShowExportMenu(false);
  }, [filteredSlots, view, getEntityLabel, timetableData, periodTimes]);

  const handleExportCSV = useCallback(() => {
    const data = filteredSlots.map((s: Slot) => ({
      Day: DAYS[s.day - 1], Period: s.period, Time: periodTimes[s.period] || "",
      Subject: s.subject.name, Teacher: `${s.teacher.user.firstName} ${s.teacher.user.lastName}`,
      Room: s.classroom?.name || s.room?.name || "", Class: timetableData?.class?.name || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timetable_${view}_${getEntityLabel() || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification("Exported to CSV successfully!");
    setShowExportMenu(false);
  }, [filteredSlots, view, getEntityLabel, timetableData, periodTimes]);

  const handleExportICal = useCallback(() => {
    const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const getDayDate = (dayNum: number) => {
      const today = new Date();
      const currentDay = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
      const day = new Date(monday);
      day.setDate(monday.getDate() + dayNum - 1);
      return day;
    };

    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Smart Tech SaaS//Timetable//EN\n";
    
    filteredSlots.forEach((slot: Slot) => {
      const [startTime] = (periodTimes[slot.period] || "07:30").split(" - ");
      const [endTime] = (periodTimes[slot.period + 1] || "08:20").split(" - ");
      const dayDate = getDayDate(slot.day);
      const [startHour, startMin] = startTime.split(":").map(Number);
      const [endHour, endMin] = endTime.split(":").map(Number);
      const startDate = new Date(dayDate);
      startDate.setHours(startHour, startMin, 0);
      const endDate = new Date(dayDate);
      endDate.setHours(endHour, endMin, 0);

      ics += "BEGIN:VEVENT\n";
      ics += `DTSTART:${formatDate(startDate)}\n`;
      ics += `DTEND:${formatDate(endDate)}\n`;
      ics += `SUMMARY:${slot.subject.name}\n`;
      ics += `DESCRIPTION:Teacher: ${slot.teacher.user.firstName} ${slot.teacher.user.lastName}`;
      if (slot.classroom?.name || slot.room?.name) ics += `\\nRoom: ${slot.classroom?.name || slot.room?.name}`;
      ics += "\n";
      ics += `LOCATION:${slot.classroom?.name || slot.room?.name || ""}\n`;
      ics += `RRULE:FREQ=WEEKLY;BYDAY=${["MO", "TU", "WE", "TH", "FR", "SA", "SU"][slot.day - 1]}\n`;
      ics += "END:VEVENT\n";
    });

    ics += "END:VCALENDAR";
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timetable_${view}_${getEntityLabel() || "export"}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification("Exported to iCal format successfully!");
    setShowExportMenu(false);
  }, [filteredSlots, view, getEntityLabel, periodTimes]);

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?view=${view}&entity=${selectedEntity}&term=${selectedTerm}`;
    navigator.clipboard.writeText(url);
    showNotification("Link copied to clipboard!");
    setShowShareMenu(false);
  }, [view, selectedEntity, selectedTerm]);

  const handleShareEmail = useCallback(() => {
    const subject = encodeURIComponent(`${schoolName} - Timetable`);
    const body = encodeURIComponent(`View the timetable at: ${window.location.href}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
    setShowShareMenu(false);
  }, [schoolName]);

  const handleSavePeriodTimes = () => {
    localStorage.setItem("timetable-period-times", JSON.stringify(periodTimes));
    localStorage.setItem("timetable-break-before", String(breakBeforePeriod));
    localStorage.setItem("timetable-break-duration", breakDuration);
    showNotification("Settings saved! Break will be inserted after period " + breakBeforePeriod);
    setShowSettingsModal(false);
  };

  const isLoading = view !== "student" && (!selectedEntity || !selectedTerm);

  return (
    <div className={`ut-wrapper ${theme}`}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap');

        :root {
          --ut-primary: #ea6645;
          --ut-primary-dark: #d55a3d;
          --ut-bg: #f5f5f5;
          --ut-bg-card: #fff;
          --ut-bg-header: #fff;
          --ut-text: #111;
          --ut-text-secondary: #666;
          --ut-border: #e0e0e0;
          --ut-row-even: #ffefeb;
          --ut-row-odd: #ffdfd7;
        }

        .ut-wrapper.dark {
          --ut-primary: #ff7f5f;
          --ut-primary-dark: #ff6f4f;
          --ut-bg: #1a1a1a;
          --ut-bg-card: #2d2d2d;
          --ut-bg-header: #252525;
          --ut-text: #f0f0f0;
          --ut-text-secondary: #aaa;
          --ut-border: #444;
          --ut-row-even: #3a3a3a;
          --ut-row-odd: #333;
        }

        .ut-wrapper {
          font-family: 'Open Sans', 'Roboto', Arial, sans-serif;
          background: var(--ut-bg);
          min-height: 100vh;
          color: var(--ut-text);
        }

        .ut-topbar {
          background: var(--ut-primary);
          padding: 8px 20px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 12px;
        }

        .ut-lang-btn {
          background: transparent;
          border: none;
          color: #fff;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .ut-lang-btn:hover { background: rgba(255,255,255,0.2); }

        .ut-font-btns { display: flex; gap: 4px; }

        .ut-font-btn {
          background: rgba(255,255,255,0.2);
          border: none;
          color: #fff;
          width: 28px;
          height: 28px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }

        .ut-font-btn:hover { background: rgba(255,255,255,0.3); }

        .ut-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 20px;
          background: var(--ut-bg-header);
          border-bottom: 1px solid var(--ut-border);
          flex-wrap: wrap;
          gap: 12px;
        }

        .ut-logo-section { display: flex; align-items: center; gap: 12px; }

        .ut-logo {
          width: 48px;
          height: 48px;
          background: var(--ut-primary);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: bold;
          font-size: 20px;
        }

        .ut-school-name { font-size: 18px; font-weight: 700; color: var(--ut-text); }

        .ut-nav-menu {
          display: flex;
          gap: 0;
          border: 1px solid var(--ut-border);
          border-radius: 6px;
          overflow: hidden;
          background: var(--ut-bg-card);
        }

        .ut-nav-item {
          padding: 10px 20px;
          text-decoration: none;
          color: var(--ut-text);
          font-size: 14px;
          font-weight: 500;
          border-right: 1px solid var(--ut-border);
          transition: all 0.2s;
          cursor: pointer;
        }

        .ut-nav-item:last-child { border-right: none; }
        .ut-nav-item:hover { background: var(--ut-bg); }
        .ut-nav-item.active { background: var(--ut-primary); color: #fff; }

        .ut-breadcrumb-bar {
          background: var(--ut-bg-header);
          padding: 10px 20px;
          border-bottom: 1px solid var(--ut-border);
        }

        .ut-breadcrumb { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ut-text-secondary); }
        .ut-breadcrumb a { color: var(--ut-primary); text-decoration: none; }
        .ut-breadcrumb a:hover { text-decoration: underline; }

        .ut-content { padding: 24px; max-width: 1600px; margin: 0 auto; }

        .ut-controls-panel {
          background: var(--ut-bg-card);
          border-radius: 8px;
          padding: 16px 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        .ut-controls-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          align-items: flex-end;
        }

        .ut-control-group { display: flex; flex-direction: column; gap: 4px; }

        .ut-control-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--ut-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .ut-select, .ut-input {
          padding: 8px 12px;
          border: 1px solid var(--ut-border);
          border-radius: 4px;
          font-size: 13px;
          background: var(--ut-bg-card);
          color: var(--ut-text);
          cursor: pointer;
          min-width: 160px;
          font-family: inherit;
        }

        .ut-select:focus, .ut-input:focus { outline: none; border-color: var(--ut-primary); }

        .ut-view-tabs {
          display: flex;
          gap: 0;
          border: 1px solid var(--ut-border);
          border-radius: 6px;
          overflow: hidden;
        }

        .ut-view-tab {
          padding: 8px 16px;
          background: var(--ut-bg-card);
          border: none;
          border-right: 1px solid var(--ut-border);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          color: var(--ut-text);
        }

        .ut-view-tab:last-child { border-right: none; }
        .ut-view-tab:hover { background: var(--ut-bg); }
        .ut-view-tab.active { background: var(--ut-primary); color: #fff; }

        .ut-action-btns {
          display: flex;
          gap: 8px;
          margin-left: auto;
        }

        .ut-action-btn {
          padding: 8px 16px;
          background: var(--ut-bg-card);
          border: 1px solid var(--ut-border);
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--ut-text);
        }

        .ut-action-btn:hover { background: var(--ut-bg); border-color: var(--ut-primary); }
        .ut-action-btn.primary { background: var(--ut-primary); color: #fff; border-color: var(--ut-primary); }
        .ut-action-btn.primary:hover { background: var(--ut-primary-dark); }

        .ut-btn-manage {
          background: var(--ut-primary);
          color: #fff;
          border-color: var(--ut-primary);
        }

        .ut-btn-manage:hover {
          background: var(--ut-primary-dark);
        }

        .ut-week-toggle {
          display: flex;
          gap: 2px;
          background: var(--ut-bg-card);
          border: 1px solid var(--ut-border);
          border-radius: 6px;
          overflow: hidden;
        }

        .ut-week-toggle button {
          padding: 6px 12px;
          background: transparent;
          border: none;
          border-right: 1px solid var(--ut-border);
          cursor: pointer;
          font-size: 12px;
          color: var(--ut-text);
          transition: all 0.2s;
          font-family: inherit;
        }

        .ut-week-toggle button:last-child { border-right: none; }
        .ut-week-toggle button:hover { background: var(--ut-bg); }
        .ut-week-toggle button.active { background: var(--ut-primary); color: #fff; }

        .ut-lesson-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .ut-badge-cancelled {
          background: #ffebee;
          color: #c62828;
        }

        .ut-badge-substituted {
          background: #fff8e1;
          color: #f57f17;
        }

        .ut-lesson-week-badge {
          display: inline-block;
          padding: 2px 6px;
          background: #e3f2fd;
          color: #1565c0;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          margin-top: 4px;
        }

        .ut-lesson-cancelled {
          opacity: 0.6;
          text-decoration: line-through;
        }

        .ut-dropdown {
          position: relative;
        }

        .ut-dropdown-menu {
          position: absolute;
          top: 100%;
          right: 0;
          background: var(--ut-bg-card);
          border: 1px solid var(--ut-border);
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          min-width: 160px;
          z-index: 100;
          margin-top: 4px;
        }

        .ut-dropdown-item {
          padding: 10px 16px;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background 0.2s;
          color: var(--ut-text);
        }

        .ut-dropdown-item:hover { background: var(--ut-bg); }
        .ut-dropdown-item:first-child { border-radius: 6px 6px 0 0; }
        .ut-dropdown-item:last-child { border-radius: 0 0 6px 6px; }

        .ut-info-bar {
          display: flex;
          gap: 24px;
          padding: 12px 20px;
          background: var(--ut-bg);
          border-radius: 8px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .ut-info-item { display: flex; flex-direction: column; gap: 2px; }
        .ut-info-label { font-size: 10px; color: var(--ut-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
        .ut-info-value { font-size: 14px; font-weight: 600; color: var(--ut-text); }

        .ut-timetable-card {
          background: var(--ut-bg-card);
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          overflow: hidden;
        }

        .ut-timetable-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--ut-bg);
          border-bottom: 1px solid var(--ut-border);
          flex-wrap: wrap;
          gap: 8px;
        }

        .ut-timetable-title { font-size: 16px; font-weight: 600; color: var(--ut-text); margin: 0; }

        .ut-navigation-controls {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .ut-week-nav-group {
          display: flex;
          align-items: center;
          gap: 4px;
          background: var(--ut-bg-card);
          border: 1px solid var(--ut-border);
          border-radius: 6px;
          overflow: hidden;
        }

        .ut-nav-btn {
          padding: 8px 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 13px;
          color: var(--ut-text);
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s;
          font-family: inherit;
        }

        .ut-nav-btn:hover {
          background: var(--ut-bg);
        }

        .ut-nav-prev {
          border-right: 1px solid var(--ut-border);
        }

        .ut-nav-next {
          border-left: 1px solid var(--ut-border);
        }

        .ut-nav-today {
          font-weight: 600;
          color: var(--ut-primary);
        }

        .ut-nav-today:hover {
          background: var(--ut-primary);
          color: #fff;
        }

        .ut-week-nav { display: flex; align-items: center; gap: 8px; }

        .ut-week-nav button {
          padding: 6px 10px;
          background: var(--ut-bg-card);
          border: 1px solid var(--ut-border);
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          color: var(--ut-text);
        }

        .ut-week-nav button:hover { background: var(--ut-bg); }
        .ut-week-nav button:disabled { opacity: 0.5; cursor: not-allowed; }

        .ut-week-label { font-size: 13px; color: var(--ut-text); font-weight: 500; min-width: 180px; text-align: center; }

        .ut-view-toggle { 
          display: flex; 
          gap: 4px; 
          background: var(--ut-bg-card);
          border: 1px solid var(--ut-border);
          border-radius: 6px;
          overflow: hidden;
        }

        .ut-view-toggle button {
          padding: 8px 14px;
          background: transparent;
          border: none;
          border-right: 1px solid var(--ut-border);
          cursor: pointer;
          font-size: 12px;
          color: var(--ut-text);
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
          font-family: inherit;
        }

        .ut-view-toggle button:last-child { border-right: none; }
        .ut-view-toggle button:hover { background: var(--ut-bg); }
        .ut-view-toggle button.active { background: var(--ut-primary); color: #fff; }

        .ut-nav-options {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ut-toggle-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--ut-text-secondary);
          cursor: pointer;
        }

        .ut-toggle-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
          accent-color: var(--ut-primary);
        }

        .ut-substitution-toggle span {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 4px;
          background: var(--ut-bg);
          transition: all 0.2s;
        }

        .ut-substitution-toggle span.active {
          background: var(--ut-primary);
          color: #fff;
        }

        .ut-day-selector {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          background: var(--ut-bg);
          border-bottom: 1px solid var(--ut-border);
          overflow-x: auto;
        }

        .ut-day-btn {
          padding: 8px 16px;
          background: var(--ut-bg-card);
          border: 1px solid var(--ut-border);
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 60px;
          white-space: nowrap;
          color: var(--ut-text);
        }

        .ut-day-btn:hover { border-color: var(--ut-primary); background: var(--ut-bg); }
        .ut-day-btn.active { background: var(--ut-primary); color: #fff; border-color: var(--ut-primary); }
        .ut-day-btn.today { border-color: #4CAF50; border-width: 2px; }

        .ut-day-name { font-weight: 600; }
        .ut-day-date { font-size: 11px; opacity: 0.8; }

        .ut-table-wrapper { overflow-x: auto; }

        .ut-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 900px; }

        .ut-table th, .ut-table td { border: 1px solid var(--ut-border); padding: 0; vertical-align: top; }

        .ut-table thead th {
          background: var(--ut-primary);
          color: #111;
          font-weight: 600;
          text-align: center;
          padding: 12px 8px;
          font-size: 14px;
          border: 1px solid var(--ut-primary-dark);
        }

        .ut-table thead th:first-child { background: var(--ut-primary-dark); width: 100px; min-width: 100px; }

        .ut-table tbody tr:nth-child(even) { background: var(--ut-row-even); }
        .ut-table tbody tr:nth-child(odd) { background: var(--ut-row-odd); }

        .ut-period-cell { background: var(--ut-bg) !important; font-weight: 600; text-align: center; color: var(--ut-text); width: 100px; min-width: 100px; }
        .ut-period-number { font-size: 16px; font-weight: 700; display: block; }
        .ut-period-time { font-size: 10px; color: var(--ut-text-secondary); font-weight: 400; margin-top: 2px; }

        .ut-lesson-cell { padding: 6px; min-height: 70px; }

        .ut-lesson {
          background: var(--ut-bg-card);
          border-radius: 4px;
          padding: 8px 10px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border-left: 4px solid var(--ut-primary);
          transition: all 0.2s;
          cursor: pointer;
          height: 100%;
        }

        .ut-lesson:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.15); transform: translateY(-1px); }
        .ut-lesson-subject { font-weight: 700; font-size: 13px; color: var(--ut-text); margin-bottom: 4px; line-height: 1.3; }
        .ut-lesson-info { font-size: 12px; color: var(--ut-text-secondary); margin-bottom: 2px; display: flex; align-items: center; gap: 4px; }
        .ut-lesson-room { font-size: 11px; color: var(--ut-text-secondary); display: flex; align-items: center; gap: 4px; }
        .ut-lesson-icon { width: 12px; height: 12px; opacity: 0.7; }

        .ut-break-cell {
          background: repeating-linear-gradient(45deg, var(--ut-bg), var(--ut-bg) 10px, var(--ut-border) 10px, var(--ut-border) 20px) !important;
          text-align: center;
          padding: 20px !important;
        }

        .ut-break-text { font-size: 14px; font-weight: 600; color: var(--ut-text-secondary); text-transform: uppercase; letter-spacing: 1px; }
        .ut-empty-cell { min-height: 70px; }

        .ut-legend { display: flex; gap: 16px; padding: 12px 16px; background: var(--ut-bg); border-top: 1px solid var(--ut-border); flex-wrap: wrap; align-items: center; }
        .ut-legend-title { font-weight: 600; color: var(--ut-text); font-size: 12px; }
        .ut-legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ut-text-secondary); }
        .ut-legend-color { width: 16px; height: 16px; border-radius: 3px; flex-shrink: 0; }

        .ut-footer { background: var(--ut-bg-header); border-top: 1px solid var(--ut-border); padding: 20px; margin-top: 40px; }
        .ut-footer-content { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }
        .ut-footer-links { display: flex; gap: 20px; font-size: 13px; }
        .ut-footer-links a { color: var(--ut-text-secondary); text-decoration: none; }
        .ut-footer-links a:hover { color: var(--ut-primary); }
        .ut-footer-powered { font-size: 12px; color: var(--ut-text-secondary); }
        .ut-footer-powered a { color: var(--ut-primary); text-decoration: none; }

        .ut-empty-state { text-align: center; padding: 80px 20px; background: var(--ut-bg-card); border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .ut-empty-state svg { color: var(--ut-text-secondary); margin-bottom: 16px; }
        .ut-empty-state h3 { font-size: 18px; font-weight: 600; color: var(--ut-text); margin: 0 0 8px; }
        .ut-empty-state p { font-size: 14px; color: var(--ut-text-secondary); margin: 0; }

        .ut-loading { display: flex; align-items: center; justify-content: center; padding: 60px 20px; color: var(--ut-text-secondary); gap: 12px; }
        .ut-spinner { width: 24px; height: 24px; border: 3px solid var(--ut-border); border-top: 3px solid var(--ut-primary); border-radius: 50%; animation: ut-spin 1s linear infinite; }
        @keyframes ut-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .ut-notification {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: var(--ut-primary);
          color: #fff;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          z-index: 1000;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .ut-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .ut-modal {
          background: var(--ut-bg-card);
          border-radius: 12px;
          padding: 24px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        }

        .ut-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .ut-modal-title { font-size: 18px; font-weight: 600; color: var(--ut-text); margin: 0; }
        .ut-modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: var(--ut-text-secondary); }

        .ut-modal-section { margin-bottom: 16px; }
        .ut-modal-label { font-size: 13px; font-weight: 600; color: var(--ut-text); margin-bottom: 8px; display: block; }

        .ut-period-edit {
          display: grid;
          grid-template-columns: 60px 1fr;
          gap: 8px;
          align-items: center;
          margin-bottom: 8px;
        }

        .ut-period-edit-label { font-weight: 600; color: var(--ut-text); }
        .ut-period-edit-input { padding: 6px 10px; border: 1px solid var(--ut-border); border-radius: 4px; font-size: 13px; background: var(--ut-bg); color: var(--ut-text); }

        .ut-filter-group { margin-bottom: 16px; }
        .ut-filter-label { font-size: 13px; font-weight: 600; color: var(--ut-text); margin-bottom: 8px; display: block; }

        .ut-mobile-cards { display: none; }

        @media (max-width: 1024px) {
          .ut-table-wrapper { display: block; }
          .ut-table { display: none; }
          .ut-mobile-cards { display: block; }
        }

        @media (max-width: 768px) {
          .ut-topbar { justify-content: center; }
          .ut-header { flex-direction: column; gap: 12px; }
          .ut-nav-menu { flex-wrap: wrap; }
          .ut-controls-row { flex-direction: column; align-items: stretch; }
          .ut-select, .ut-input { width: 100%; min-width: unset; }
          .ut-view-tabs { width: 100%; }
          .ut-view-tab { flex: 1; text-align: center; }
          .ut-footer-content { flex-direction: column; text-align: center; }
          .ut-action-btns { margin-left: 0; width: 100%; }
          .ut-action-btn { flex: 1; justify-content: center; }
        }

        @media print {
          .ut-topbar, .ut-header, .ut-controls-panel, .ut-footer, .ut-day-selector, .ut-week-nav, .ut-action-btns { display: none !important; }
          .ut-wrapper { background: #fff; color: #000; }
          .ut-timetable-card { box-shadow: none; }
          .ut-table { min-width: unset; }
          .ut-table thead th { background: #333 !important; color: #fff !important; }
          .ut-table tbody tr:nth-child(even) { background: #f5f5f5 !important; }
          .ut-table tbody tr:nth-child(odd) { background: #fff !important; }
          .ut-period-cell { background: #eee !important; }
        }

        .ut-sticky-header thead th {
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .ut-period-cell {
          position: sticky;
          left: 0;
          z-index: 5;
        }

        .ut-tooltip {
          position: fixed;
          background: var(--ut-bg-card);
          border: 1px solid var(--ut-border);
          border-radius: 8px;
          padding: 12px 16px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          z-index: 1000;
          max-width: 320px;
          font-size: 13px;
          pointer-events: none;
        }

        .ut-tooltip-title {
          font-weight: 700;
          font-size: 14px;
          margin-bottom: 8px;
          color: var(--ut-text);
        }

        .ut-tooltip-row {
          display: flex;
          gap: 8px;
          margin-bottom: 4px;
          color: var(--ut-text-secondary);
        }

        .ut-tooltip-label {
          font-weight: 600;
          min-width: 60px;
          color: var(--ut-text);
        }

        .ut-tooltip-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          margin-top: 8px;
        }

        .ut-tooltip-badge-substituted {
          background: #fff8e1;
          color: #f57f17;
        }

        .ut-tooltip-badge-cancelled {
          background: #ffebee;
          color: #c62828;
        }

        .ut-notification-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #ff4444;
          color: #fff;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          font-size: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        .ut-notifications-panel {
          position: absolute;
          top: 100%;
          right: 0;
          background: var(--ut-bg-card);
          border: 1px solid var(--ut-border);
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          width: 360px;
          max-height: 480px;
          overflow-y: auto;
          z-index: 100;
          margin-top: 8px;
        }

        .ut-notification-item {
          padding: 12px 16px;
          border-bottom: 1px solid var(--ut-border);
          cursor: pointer;
          transition: background 0.2s;
        }

        .ut-notification-item:hover { background: var(--ut-bg); }
        .ut-notification-item.unread { background: var(--ut-row-even); }
        .ut-notification-item:last-child { border-bottom: none; }

        .ut-notification-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .ut-notification-title {
          font-weight: 600;
          font-size: 13px;
          color: var(--ut-text);
        }

        .ut-notification-time {
          font-size: 11px;
          color: var(--ut-text-secondary);
        }

        .ut-notification-message {
          font-size: 12px;
          color: var(--ut-text-secondary);
        }

        .ut-notification-type {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .ut-notification-type.info { background: #2196F3; }
        .ut-notification-type.success { background: #4CAF50; }
        .ut-notification-type.warning { background: #FFC107; }
        .ut-notification-type.error { background: #f44336; }

        .ut-legend-modal-content {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .ut-abbr-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: var(--ut-bg);
          border-radius: 6px;
        }

        .ut-abbr-code {
          font-weight: 700;
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 4px;
          color: #fff;
        }

        .ut-abbr-full {
          font-size: 13px;
          color: var(--ut-text);
        }

        .ut-search-input {
          padding: 8px 12px;
          border: 1px solid var(--ut-border);
          border-radius: 4px;
          font-size: 13px;
          background: var(--ut-bg-card);
          color: var(--ut-text);
          min-width: 200px;
        }

        .ut-search-input:focus { outline: none; border-color: var(--ut-primary); }

        .ut-current-period-highlight {
          box-shadow: inset 0 0 0 2px #4CAF50 !important;
          animation: pulse-border 2s infinite;
        }

        @keyframes pulse-border {
          0%, 100% { box-shadow: inset 0 0 0 2px #4CAF50; }
          50% { box-shadow: inset 0 0 0 3px #4CAF50, 0 0 8px rgba(76, 175, 80, 0.4); }
        }

        .ut-share-modal {
          background: var(--ut-bg-card);
          border-radius: 12px;
          padding: 24px;
          max-width: 480px;
          width: 90%;
        }

        .ut-share-link {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }

        .ut-share-link input {
          flex: 1;
          padding: 10px 12px;
          border: 1px solid var(--ut-border);
          border-radius: 6px;
          font-size: 13px;
          background: var(--ut-bg);
          color: var(--ut-text);
        }

        .ut-share-btn {
          padding: 10px 16px;
          background: var(--ut-primary);
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .ut-share-btn:hover { background: var(--ut-primary-dark); }

        .ut-settings-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid var(--ut-border);
        }

        .ut-settings-row:last-child { border-bottom: none; }

        .ut-settings-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--ut-text);
        }

        .ut-settings-desc {
          font-size: 12px;
          color: var(--ut-text-secondary);
          margin-top: 2px;
        }

        .ut-toggle-switch {
          position: relative;
          width: 44px;
          height: 24px;
          background: var(--ut-border);
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .ut-toggle-switch.active { background: var(--ut-primary); }

        .ut-toggle-switch::after {
          content: "";
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          background: #fff;
          border-radius: 50%;
          transition: transform 0.2s;
        }

        .ut-toggle-switch.active::after {
          transform: translateX(20px);
        }

        .ut-mobile-optimized {
          display: none;
        }

        @media (max-width: 640px) {
          .ut-notifications-panel { width: calc(100vw - 32px); right: -60px; }
          .ut-share-modal { padding: 16px; }
          .ut-legend-modal-content { grid-template-columns: 1fr; }
          .ut-controls-row { gap: 8px; }
          .ut-action-btns { flex-wrap: wrap; }
        }

        .ut-day-card.today {
          border: 2px solid #4CAF50;
        }

        .ut-auth-modal {
          background: var(--ut-bg-card);
          border-radius: 12px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
        }

        .ut-auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .ut-auth-input {
          padding: 10px 12px;
          border: 1px solid var(--ut-border);
          border-radius: 6px;
          font-size: 14px;
          background: var(--ut-bg);
          color: var(--ut-text);
        }

        .ut-auth-input:focus { outline: none; border-color: var(--ut-primary); }
      `}</style>

      <div className="ut-topbar">
        <div className="ut-dropdown" style={{ position: "relative" }}>
          <button className="ut-lang-btn" onClick={() => setShowNotificationsPanel(!showNotificationsPanel)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {unreadCount > 0 && <span className="ut-notification-badge">{unreadCount}</span>}
          </button>
          {showNotificationsPanel && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setShowNotificationsPanel(false)} />
              <div className="ut-notifications-panel">
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ut-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>Notifications</span>
                  {unreadCount > 0 && <button style={{ background: "none", border: "none", color: "var(--ut-primary)", cursor: "pointer", fontSize: "12px" }} onClick={markAllAsRead}>Mark all read</button>}
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--ut-text-secondary)" }}>No notifications</div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`ut-notification-item ${!n.read ? "unread" : ""}`} onClick={() => markAsRead(n.id)}>
                      <div className="ut-notification-header">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className={`ut-notification-type ${n.type}`} />
                          <span className="ut-notification-title">{n.title}</span>
                        </div>
                        <span className="ut-notification-time">{n.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="ut-notification-message">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        <button className="ut-lang-btn" onClick={() => setShowLegendModal(true)} title="Legend">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Legend
        </button>
        <button className="ut-lang-btn" onClick={() => setShowSettingsModal(true)} title="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
        <button className="ut-lang-btn" title={theme === "dark" ? "Light mode" : "Dark mode"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? "☀" : "☾"}
        </button>
        {isAuthenticated ? (
          <button className="ut-lang-btn" onClick={() => { localStorage.removeItem("auth_token"); localStorage.removeItem("user"); setIsAuthenticated(false); }}>
            Logout
          </button>
        ) : (
          <button className="ut-lang-btn" onClick={() => setShowAuthModal(true)}>
            Login
          </button>
        )}
      </div>

      <header className="ut-header">
        <div className="ut-logo-section">
          <div className="ut-logo">{schoolName.charAt(0)}</div>
          <span className="ut-school-name">{schoolName}</span>
        </div>
        <nav className="ut-nav-menu">
          <a href="/" className="ut-nav-item">Main Page</a>
          <a href="/news" className="ut-nav-item">News</a>
          <a href="/about" className="ut-nav-item">About</a>
          <a href="/timetable" className="ut-nav-item active">Timetable</a>
          <a href="/contact" className="ut-nav-item">Contact</a>
        </nav>
      </header>

      <div className="ut-breadcrumb-bar">
        <div className="ut-breadcrumb">
          <a href="/">Main Page</a>
          <span>/</span>
          <a href="/dashboard">Students and parents</a>
          <span>/</span>
          <a href="/timetable">Everyday info</a>
          <span>/</span>
          <span>Timetable</span>
        </div>
      </div>

      <main className="ut-content" style={{ display: 'flex', gap: '0', padding: '0' }}>
        {/* Lesson Requirements Panel - Only show for admin */}
        {hasRoleAccess(["admin", "teacher"]) && showRequirementsPanel && (
          <LessonRequirementsPanel
            termId={selectedTerm}
            classTimetable={classTimetable}
          />
        )}
        
        <div style={{ flex: 1, padding: '24px', overflowX: 'auto' }}>
          {/* Toggle Requirements Panel Button */}
          {hasRoleAccess(["admin", "teacher"]) && (
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={() => setShowRequirementsPanel(!showRequirementsPanel)}
                style={{
                  padding: '8px 16px',
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  background: showRequirementsPanel ? '#667eea' : 'transparent',
                  color: showRequirementsPanel ? '#fff' : '#667eea',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <i className={`fa fa-chevron-${showRequirementsPanel ? 'left' : 'right'}`}></i>
                {showRequirementsPanel ? 'Hide' : 'Show'} Requirements
              </button>
            </div>
          )}
          
          <div className="ut-controls-panel">
            <div className="ut-controls-row">
              <div className="ut-control-group">
            <div className="ut-control-group">
              <span className="ut-control-label">View</span>
              <div className="ut-view-tabs">
                {["class", "teacher", "room", "student"].map((v) => (
                  <button key={v} className={`ut-view-tab ${view === v ? "active" : ""}`} onClick={() => { setView(v as ViewType); setSelectedEntity(""); }}>
                    {v === "class" ? "Class" : v === "teacher" ? "Teacher" : v === "room" ? "Room" : "My Timetable"}
                  </button>
                ))}
              </div>
            </div>

            {view === "class" && (
              <div className="ut-control-group">
                <span className="ut-control-label">Class</span>
                <select className="ut-select" value={selectedEntity} onChange={(e) => setSelectedEntity(e.target.value)}>
                  <option value="">-- Select Class --</option>
                  {classesData?.map((cls: any) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
                </select>
              </div>
            )}

            {view === "teacher" && (
              <div className="ut-control-group">
                <span className="ut-control-label">Teacher</span>
                <select className="ut-select" value={selectedEntity} onChange={(e) => setSelectedEntity(e.target.value)}>
                  <option value="">-- Select Teacher --</option>
                  {teachersData?.map((t: any) => <option key={t.id} value={t.id}>{t.user.firstName} {t.user.lastName}</option>)}
                </select>
              </div>
            )}

            {view === "room" && (
              <div className="ut-control-group">
                <span className="ut-control-label">Room</span>
                <select className="ut-select" value={selectedEntity} onChange={(e) => setSelectedEntity(e.target.value)}>
                  <option value="">-- Select Room --</option>
                  {roomsData?.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            )}

            <div className="ut-control-group">
              <span className="ut-control-label">Term</span>
              <select className="ut-select" value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}>
                <option value="">-- Select Term --</option>
                {termData && <option value={termData.id}>{termData.name}</option>}
              </select>
            </div>

            <div className="ut-control-group">
              <span className="ut-control-label">Search</span>
              <input 
                type="text" 
                className="ut-search-input" 
                placeholder="Teacher, subject, room..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {(timetableData?.class?.weekRotation || selectedWeekType !== "regular") && (
              <div className="ut-control-group">
                <span className="ut-control-label">Week</span>
                <div className="ut-week-toggle">
                  <button 
                    className={selectedWeekType === "regular" ? "active" : ""} 
                    onClick={() => setSelectedWeekType("regular")}
                  >
                    Regular
                  </button>
                  <button 
                    className={selectedWeekType === "A" ? "active" : ""} 
                    onClick={() => setSelectedWeekType("A")}
                  >
                    Week A
                  </button>
                  <button 
                    className={selectedWeekType === "B" ? "active" : ""} 
                    onClick={() => setSelectedWeekType("B")}
                  >
                    Week B
                  </button>
                </div>
              </div>
            )}

            <div className="ut-control-group">
              <span className="ut-control-label">Options</span>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <label className="ut-toggle-label" style={{ whiteSpace: "nowrap" }}>
                  <input 
                    type="checkbox" 
                    checked={stickyHeader} 
                    onChange={(e) => setStickyHeader(e.target.checked)} 
                  />
                  <span>Sticky</span>
                </label>
                <label className="ut-toggle-label" style={{ whiteSpace: "nowrap" }}>
                  <input 
                    type="checkbox" 
                    checked={showBreaks} 
                    onChange={(e) => {}} 
                  />
                  <span>Breaks</span>
                </label>
              </div>
            </div>

            {hasRoleAccess(["admin", "teacher"]) && (
              <div className="ut-control-group">
                <span className="ut-control-label">Manage</span>
                <button 
                  className="ut-action-btn ut-btn-manage" 
                  onClick={() => {
                    setEditingSlot(null);
                    setEditorMode('add');
                    setEditorDay(1);
                    setEditorPeriod(1);
                    setShowEditorModal(true);
                  }}
                  title="Add or Edit Timetable Lessons"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit Timetable
                </button>
              </div>
            )}

            {hasRoleAccess(["admin", "teacher"]) && (
              <div className="ut-control-group">
                <span className="ut-control-label">&nbsp;</span>
                <button className="ut-action-btn ut-btn-manage" onClick={() => setShowSubstitutionModal(true)} title="Manage Substitutions">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                  Substitutions
                </button>
              </div>
            )}

            {hasRoleAccess(["admin"]) && (
              <div className="ut-control-group">
                <span className="ut-control-label">AI Generator</span>
                <button 
                  className="ut-action-btn ut-btn-manage" 
                  onClick={() => setShowGenerationPanel(true)}
                  title="AI Timetable Generator"
                  style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  Generate
                </button>
              </div>
            )}

            <div className="ut-action-btns">
              <button className="ut-action-btn" onClick={() => setShowFilterModal(true)} title="Filter">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                Filter
              </button>
              <button className="ut-action-btn" onClick={() => setShowSettingsModal(true)} title="Settings">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Settings
              </button>
              <div className="ut-dropdown">
                <button className="ut-action-btn" onClick={() => { setShowExportMenu(!showExportMenu); setShowShareMenu(false); }} title="Export">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export
                </button>
                {showExportMenu && (
                  <div className="ut-dropdown-menu">
                    <div className="ut-dropdown-item" onClick={handleExportExcel}><span>📊</span> Export to Excel</div>
                    <div className="ut-dropdown-item" onClick={handleExportCSV}><span>📄</span> Export to CSV</div>
                    <div className="ut-dropdown-item" onClick={handleExportICal}><span>📅</span> Export to iCal</div>
                    <div className="ut-dropdown-item" onClick={handlePrint}><span>🖨️</span> Print / PDF</div>
                  </div>
                )}
              </div>
              <div className="ut-dropdown">
                <button className="ut-action-btn primary" onClick={() => { setShowShareMenu(!showShareMenu); setShowExportMenu(false); }} title="Share">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  Share
                </button>
                {showShareMenu && (
                  <div className="ut-dropdown-menu">
                    <div className="ut-dropdown-item" onClick={handleCopyLink}><span>🔗</span> Copy Link</div>
                    <div className="ut-dropdown-item" onClick={handleShareEmail}><span>✉️</span> Share via Email</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>

        {isLoading ? (
          <div className="ut-loading">
            <div className="ut-spinner"></div>
            <span>Select {view === "class" ? "a class" : view === "teacher" ? "a teacher" : view === "room" ? "a room" : "options"} to view timetable...</span>
          </div>
        ) : filteredSlots.length === 0 ? (
          <div className="ut-empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <h3>No Timetable Available</h3>
            <p>There is no timetable data for this {view}.</p>
          </div>
        ) : (
          <>
            <div className="ut-info-bar">
              <div className="ut-info-item"><span className="ut-info-label">View</span><span className="ut-info-value">{view.charAt(0).toUpperCase() + view.slice(1)}</span></div>
              <div className="ut-info-item"><span className="ut-info-label">{view === "student" ? "Student" : view === "class" ? "Class" : view === "teacher" ? "Teacher" : "Room"}</span><span className="ut-info-value">{getEntityLabel() || "-"}</span></div>
              {timetableData?.class && <div className="ut-info-item"><span className="ut-info-label">Class Group</span><span className="ut-info-value">{timetableData.class.name}</span></div>}
              <div className="ut-info-item"><span className="ut-info-label">Term</span><span className="ut-info-value">{termData?.name || "Active"}</span></div>
              <div className="ut-info-item"><span className="ut-info-label">Total Lessons</span><span className="ut-info-value">{filteredSlots.length}</span></div>
              {(filterSubject || filterTeacher) && <div className="ut-info-item"><span className="ut-info-label">Filter</span><span className="ut-info-value" style={{ color: "var(--ut-primary)" }}>Active</span></div>}
            </div>

            <div className="ut-timetable-card">
              <div className="ut-timetable-header">
                <h2 className="ut-timetable-title">{getEntityLabel() || "Timetable"} - {view === "student" ? "My" : view.charAt(0).toUpperCase() + view.slice(1)} Timetable</h2>
                
                <div className="ut-navigation-controls">
                  {/* Week Navigation */}
                  <div className="ut-week-nav-group">
                    <button className="ut-nav-btn ut-nav-prev" onClick={() => setCurrentWeek(w => w - 1)} title="Previous Week">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                      <span>Prev</span>
                    </button>
                    
                    <button className="ut-nav-btn ut-nav-today" onClick={() => { setCurrentWeek(0); setSelectedDay(null); }} title="Go to Today">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      <span>Today</span>
                    </button>
                    
                    <button className="ut-nav-btn ut-nav-next" onClick={() => setCurrentWeek(w => w + 1)} title="Next Week">
                      <span>Next</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>

                  {/* Week/Day View Toggle */}
                  <div className="ut-view-toggle">
                    <button 
                      className={navigationMode === "week" ? "active" : ""} 
                      onClick={() => { setNavigationMode("week"); setSelectedDay(null); }}
                      title="Week View"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                      Week
                    </button>
                    <button 
                      className={navigationMode === "day" ? "active" : ""} 
                      onClick={() => { setNavigationMode("day"); setSelectedDay(new Date().getDay() === 0 ? 0 : new Date().getDay() - 1); }}
                      title="Day View"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      Day
                    </button>
                  </div>

                  {/* Week Label */}
                  <span className="ut-week-label">
                    {weekDays[0]?.date} {weekDays[0]?.month} - {weekDays[showWeekends ? 6 : 4]?.date} {weekDays[showWeekends ? 6 : 4]?.month}
                  </span>

                  {/* Options */}
                  <div className="ut-nav-options">
                    <label className="ut-toggle-label">
                      <input 
                        type="checkbox" 
                        checked={showWeekends} 
                        onChange={(e) => setShowWeekends(e.target.checked)} 
                      />
                      <span>Sat/Sun</span>
                    </label>
                    
                    <label className="ut-toggle-label ut-substitution-toggle">
                      <input 
                        type="checkbox" 
                        checked={showSubstitutions} 
                        onChange={(e) => setShowSubstitutions(e.target.checked)} 
                      />
                      <span className={showSubstitutions ? "active" : ""}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                        Changes
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Quick Day Selector */}
              <div className="ut-day-selector">
                {weekDays.map((day, idx) => (
                  <button 
                    key={idx} 
                    className={`ut-day-btn ${selectedDay === idx ? "active" : ""} ${day.isToday ? "today" : ""}`} 
                    onClick={() => { setSelectedDay(idx); setNavigationMode("day"); }}
                  >
                    <span className="ut-day-name">{day.dayName}</span>
                    <span className="ut-day-date">{day.date}</span>
                  </button>
                ))}
              </div>

              <div className="ut-table-wrapper">
                <table className={`ut-table ${stickyHeader ? "ut-sticky-header" : ""}`}>
                  <thead>
                    <tr>
                      <th>Period</th>
                      {navigationMode === "day" && selectedDay !== null ? (
                        <th>{weekDays[selectedDay]?.dayName} <span style={{ fontWeight: 400, fontSize: "12px" }}>{weekDays[selectedDay]?.fullDate}</span></th>
                      ) : (
                        VISIBLE_DAYS.slice(0, showWeekends ? 7 : 5).map((day, idx) => <th key={idx}>{day}</th>)
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {PERIODS.map((period) => (
                      <tr key={period}>
                        <td className={`ut-period-cell ${isCurrentPeriod(period) ? "ut-current-period-highlight" : ""}`}>
                          <span className="ut-period-number">{period}</span>
                          <span className="ut-period-time">{periodTimes[period]}</span>
                          {isCurrentPeriod(period) && <span style={{ fontSize: "9px", color: "#4CAF50", fontWeight: 600 }}>NOW</span>}
                        </td>
                        {isBreak(period) ? (
                          <td colSpan={navigationMode === "day" ? 1 : (showWeekends ? 7 : 5)} className="ut-break-cell"><span className="ut-break-text">Break</span></td>
                        ) : navigationMode === "day" && selectedDay !== null ? (
                          <td className={getSlot(selectedDay + 1, period) ? "ut-lesson-cell" : "ut-empty-cell"}>{renderLesson(getSlot(selectedDay + 1, period), undefined, period)}</td>
                        ) : (
                          VISIBLE_DAYS.slice(0, showWeekends ? 7 : 5).map((_, dayIdx) => {
                            const slot = getSlot(dayIdx + 1, period);
                            return <td key={`${dayIdx}-${period}`} className={slot ? "ut-lesson-cell" : "ut-empty-cell"}>{renderLesson(slot, dayIdx, period)}</td>;
                          })
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="ut-mobile-cards">
                  {weekDays.map((day, dayIdx) => (
                    <div key={dayIdx} className={`ut-day-card ${day.isToday ? "today" : ""}`}>
                      <div className="ut-day-card-header"><span>{day.dayName}</span><span className="ut-day-card-date">{day.date} {day.month}</span></div>
                      <div className="ut-day-card-content">
                        {PERIODS.filter(p => !isBreak(p)).map(period => {
                          const slot = getSlot(dayIdx + 1, period);
                          if (!slot) return null;
                          const color = getColor(slot, "subject");
                          return (
                            <div key={period} className="ut-day-card-lesson" style={{ borderLeftColor: color }}>
                              <div className="ut-day-card-period">Period {period} ({periodTimes[period]})</div>
                              <div className="ut-day-card-subject"><TooltipWrap text={slot.subject.name}><span>{abbreviateSubject(slot.subject.name)}</span></TooltipWrap></div>
                              <div className="ut-day-card-info"><TooltipWrap text={`${slot.teacher.user.firstName} ${slot.teacher.user.lastName}`}><span>{abbreviateTeacher(slot.teacher)}</span></TooltipWrap></div>
                              {(slot.classroom || slot.room) && <div className="ut-day-card-info">{slot.classroom?.name || slot.room?.name}</div>}
                            </div>
                          );
                        })}
                        {PERIODS.filter(p => !isBreak(p)).every(p => !getSlot(dayIdx + 1, p)) && <p style={{ color: "var(--ut-text-secondary)", textAlign: "center", padding: "20px" }}>No lessons scheduled</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ut-legend">
                <span className="ut-legend-title">Legend:</span>
                {Object.entries(SUBJECT_COLORS).slice(0, 6).map(([name, color]) => (
                  <div key={name} className="ut-legend-item"><span className="ut-legend-color" style={{ backgroundColor: color }}></span><span>{name}</span></div>
                ))}
              </div>
            </div>
          </>
        )}
        </div>
      </main>

      <footer className="ut-footer">
        <div className="ut-footer-content">
          <div className="ut-footer-links">
            <a href="mailto:support@smarttech.com">Webmaster</a>
            <a href="/privacy">Privacy policy</a>
            <a href="/sitemap">Site map</a>
          </div>
          <div className="ut-footer-powered">Powered by <a href="https://smarttech.com" target="_blank">Smart Tech SaaS</a></div>
        </div>
      </footer>

      {notification && <div className="ut-notification">{notification}</div>}

      {showFilterModal && (
        <div className="ut-modal-overlay" onClick={() => setShowFilterModal(false)}>
          <div className="ut-modal" onClick={e => e.stopPropagation()}>
            <div className="ut-modal-header">
              <h3 className="ut-modal-title">Filter Timetable</h3>
              <button className="ut-modal-close" onClick={() => setShowFilterModal(false)}>&times;</button>
            </div>
            <div className="ut-modal-section">
              <div className="ut-filter-group">
                <label className="ut-filter-label">Filter by Subject</label>
                <select className="ut-select" value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={{ width: "100%" }}>
                  <option value="">All Subjects</option>
                  {uniqueSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="ut-filter-group">
                <label className="ut-filter-label">Filter by Teacher</label>
                <select className="ut-select" value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} style={{ width: "100%" }}>
                  <option value="">All Teachers</option>
                  {uniqueTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="ut-action-btn" onClick={() => { setFilterSubject(""); setFilterTeacher(""); setShowFilterModal(false); }} style={{ flex: 1, justifyContent: "center" }}>Clear Filters</button>
              <button className="ut-action-btn primary" onClick={() => setShowFilterModal(false)} style={{ flex: 1, justifyContent: "center" }}>Apply Filters</button>
            </div>
          </div>
        </div>
      )}

      {hoveredSlot && (
        <div 
          className="ut-tooltip" 
          style={{ 
            left: hoveredSlot.position.x, 
            top: hoveredSlot.position.y,
            maxHeight: "400px",
            overflow: "auto"
          }}
        >
          <div className="ut-tooltip-title"><TooltipWrap text={hoveredSlot.slot.subject.name}><span>{abbreviateSubject(hoveredSlot.slot.subject.name)}</span></TooltipWrap></div>
          {getActiveSubstitution(hoveredSlot.slot.id, new Date()) && !getActiveSubstitution(hoveredSlot.slot.id, new Date())?.isCancelled && (
            <span className="ut-tooltip-badge ut-tooltip-badge-substituted">Substituted</span>
          )}
          {getActiveSubstitution(hoveredSlot.slot.id, new Date())?.isCancelled && (
            <span className="ut-tooltip-badge ut-tooltip-badge-cancelled">Cancelled</span>
          )}
          <div className="ut-tooltip-row">
            <span className="ut-tooltip-label">Teacher:</span>
            <span data-full={`${hoveredSlot.slot.teacher.user.firstName} ${hoveredSlot.slot.teacher.user.lastName}`}>{abbreviateTeacher(hoveredSlot.slot.teacher)}</span>
          </div>
          {(hoveredSlot.slot.classroom || hoveredSlot.slot.room) && (
            <div className="ut-tooltip-row">
              <span className="ut-tooltip-label">Room:</span>
              <span>{hoveredSlot.slot.classroom?.name || hoveredSlot.slot.room?.name}</span>
            </div>
          )}
          {hoveredSlot.slot.classGroup && (
            <div className="ut-tooltip-row">
              <span className="ut-tooltip-label">Class:</span>
              <span>{hoveredSlot.slot.classGroup.name}</span>
            </div>
          )}
          {hoveredSlot.slot.weekType && hoveredSlot.slot.weekType !== "regular" && (
            <div className="ut-tooltip-row">
              <span className="ut-tooltip-label">Week:</span>
              <span>{hoveredSlot.slot.weekType}</span>
            </div>
          )}
          <div className="ut-tooltip-row">
            <span className="ut-tooltip-label">Time:</span>
            <span>{periodTimes[hoveredSlot.slot.period] || "N/A"}</span>
          </div>
          {getActiveSubstitution(hoveredSlot.slot.id, new Date())?.reason && (
            <div className="ut-tooltip-row" style={{ flexDirection: "column", gap: "2px" }}>
              <span className="ut-tooltip-label">Note:</span>
              <span>{getActiveSubstitution(hoveredSlot.slot.id, new Date())?.reason}</span>
            </div>
          )}
        </div>
      )}

      {showLegendModal && (
        <div className="ut-modal-overlay" onClick={() => setShowLegendModal(false)}>
          <div className="ut-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            <div className="ut-modal-header">
              <h3 className="ut-modal-title">Subject Abbreviations</h3>
              <button className="ut-modal-close" onClick={() => setShowLegendModal(false)}>&times;</button>
            </div>
            <div className="ut-legend-modal-content">
              {Object.entries(ABBREVIATIONS).filter(([key]) => !["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].includes(key)).map(([name, abbr]) => (
                <div key={name} className="ut-abbr-item">
                  <span className="ut-abbr-code" style={{ background: getColorBySubject(name) }}>{abbr}</span>
                  <span className="ut-abbr-full">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="ut-modal-overlay" onClick={() => setShowShareModal(false)}>
          <div className="ut-share-modal" onClick={e => e.stopPropagation()}>
            <div className="ut-modal-header">
              <h3 className="ut-modal-title">Share Timetable</h3>
              <button className="ut-modal-close" onClick={() => setShowShareModal(false)}>&times;</button>
            </div>
            <p style={{ fontSize: "13px", color: "var(--ut-text-secondary)", marginBottom: "16px" }}>
              Copy the link below to share this timetable. Anyone with this link can view a read-only version.
            </p>
            <div className="ut-share-link">
              <input type="text" readOnly value={shareLink} onClick={(e) => e.currentTarget.select()} />
              <button className="ut-share-btn" onClick={handleCopyShareLink}>Copy</button>
            </div>
            <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
              <button className="ut-action-btn" onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(`${schoolName} Timetable`)}`, "_blank")} style={{ flex: 1, justifyContent: "center" }}>
                Share on X
              </button>
              <button className="ut-action-btn" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`View my timetable: ${shareLink}`)}`, "_blank")} style={{ flex: 1, justifyContent: "center" }}>
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="ut-modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="ut-modal" onClick={e => e.stopPropagation()}>
            <div className="ut-modal-header">
              <h3 className="ut-modal-title">Settings</h3>
              <button className="ut-modal-close" onClick={() => setShowSettingsModal(false)}>&times;</button>
            </div>
            <div className="ut-settings-row">
              <div>
                <div className="ut-settings-label">Push Notifications</div>
                <div className="ut-settings-desc">Get notified about timetable changes</div>
              </div>
              <div className={`ut-toggle-switch ${pushNotifications ? "active" : ""}`} onClick={() => setPushNotifications(!pushNotifications)} />
            </div>
            <div className="ut-settings-row">
              <div>
                <div className="ut-settings-label">Email Notifications</div>
                <div className="ut-settings-desc">Receive updates via email</div>
              </div>
              <div className={`ut-toggle-switch ${emailNotifications ? "active" : ""}`} onClick={() => setEmailNotifications(!emailNotifications)} />
            </div>
            <div className="ut-settings-row">
              <div>
                <div className="ut-settings-label">Sticky Headers</div>
                <div className="ut-settings-desc">Keep headers visible while scrolling</div>
              </div>
              <div className={`ut-toggle-switch ${stickyHeader ? "active" : ""}`} onClick={() => setStickyHeader(!stickyHeader)} />
            </div>
            <div className="ut-settings-row">
              <div>
                <div className="ut-settings-label">Color by</div>
                <div className="ut-settings-desc">Choose how to color lessons</div>
              </div>
              <select className="ut-select" value={colorBy} onChange={e => setColorBy(e.target.value as ColorBy)} style={{ width: "120px" }}>
                <option value="subject">Subject</option>
                <option value="teacher">Teacher</option>
                <option value="room">Room</option>
                <option value="none">None</option>
              </select>
            </div>
            <div className="ut-settings-row">
              <div>
                <div className="ut-settings-label">Number of Periods</div>
                <div className="ut-settings-desc">Periods per day</div>
              </div>
              <select 
                className="ut-select" 
                value={periodsCount} 
                onChange={e => {
                  const newCount = parseInt(e.target.value);
                  setPeriodsCount(newCount);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('timetable-periods', String(newCount));
                  }
                }} 
                style={{ width: "120px" }}
              >
                {[5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                  <option key={num} value={num}>{num} Periods</option>
                ))}
              </select>
            </div>

            {/* Break Period Settings */}
            <div style={{ marginTop: "24px", padding: "16px", background: "var(--ut-bg)", borderRadius: "8px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "16px" }}>☕</span> Break Period Settings
              </h4>
              <p style={{ fontSize: "12px", color: "var(--ut-text-secondary)", marginBottom: "12px" }}>
                Automatically insert break periods into the timetable
              </p>
              
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", color: "var(--ut-text-secondary)", marginBottom: "6px", display: "block" }}>
                  Insert Break Before Period
                </label>
                <select 
                  className="ut-select"
                  value={breakBeforePeriod} 
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setBreakBeforePeriod(val);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('timetable-break-before', String(val));
                    }
                  }}
                  style={{ width: "100%" }}
                >
                  {[3, 4, 5, 6, 7].map(num => (
                    <option key={num} value={num}>Period {num}</option>
                  ))}
                </select>
                <p style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
                  Break will appear after this period (e.g., after period 4 = break between P4 and P5)
                </p>
              </div>
              
              <div style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", color: "var(--ut-text-secondary)", marginBottom: "6px", display: "block" }}>
                  Break Duration
                </label>
                <select 
                  className="ut-select"
                  value={breakDuration} 
                  onChange={e => {
                    setBreakDuration(e.target.value);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('timetable-break-duration', e.target.value);
                    }
                  }}
                  style={{ width: "100%" }}
                >
                  {['5 min', '10 min', '15 min', '20 min', '30 min'].map(dur => (
                    <option key={dur} value={dur}>{dur}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ 
                padding: "10px", 
                background: "#fff3e0", 
                borderRadius: "6px", 
                fontSize: "12px",
                color: "#e65100",
              }}>
                <strong>Preview:</strong> Break will be inserted after Period {breakBeforePeriod}, lasting {breakDuration}
              </div>
            </div>

            <div style={{ marginTop: "24px", padding: "16px", background: "var(--ut-bg)", borderRadius: "8px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px" }}>Period Times</h4>
              <p style={{ fontSize: "12px", color: "var(--ut-text-secondary)", marginBottom: "12px" }}>
                Configure start and end times for each period
              </p>
              {Array.from({ length: periodsCount }, (_, i) => i + 1).map(p => (
                <div key={p} className="ut-period-edit">
                  <span className="ut-period-edit-label">P{p}</span>
                  <input type="text" className="ut-period-edit-input" value={periodTimes[p] || ''} onChange={e => setPeriodTimes({ ...periodTimes, [p]: e.target.value })} placeholder="HH:MM - HH:MM" />
                </div>
              ))}
              <button className="ut-action-btn primary" onClick={handleSavePeriodTimes} style={{ width: "100%", justifyContent: "center", marginTop: "12px" }}>Save All Settings</button>
            </div>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="ut-modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="ut-auth-modal" onClick={e => e.stopPropagation()}>
            <div className="ut-modal-header">
              <h3 className="ut-modal-title">{authMode === "login" ? "Login" : "Register"}</h3>
              <button className="ut-modal-close" onClick={() => setShowAuthModal(false)}>&times;</button>
            </div>
            <form className="ut-auth-form" onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const email = (form.elements.namedItem("email") as HTMLInputElement).value;
              const password = (form.elements.namedItem("password") as HTMLInputElement).value;
              if (authMode === "login") {
                authApi.login(email, password).then(() => {
                  setIsAuthenticated(true);
                  setShowAuthModal(false);
                  showNotification("Logged in successfully!");
                }).catch(() => showNotification("Login failed", "error"));
              } else {
                showNotification("Registration not implemented yet", "info");
              }
            }}>
              <input type="email" name="email" className="ut-auth-input" placeholder="Email" required />
              <input type="password" name="password" className="ut-auth-input" placeholder="Password" required />
              <button type="submit" className="ut-action-btn primary" style={{ width: "100%", justifyContent: "center" }}>
                {authMode === "login" ? "Login" : "Register"}
              </button>
            </form>
            <p style={{ textAlign: "center", marginTop: "16px", fontSize: "13px", color: "var(--ut-text-secondary)" }}>
              {authMode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button style={{ background: "none", border: "none", color: "var(--ut-primary)", cursor: "pointer", fontWeight: 600 }} onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
                {authMode === "login" ? "Register" : "Login"}
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Timetable Editor Modal */}
      {showEditorModal && (
        <TimetableEditorModal
          isOpen={showEditorModal}
          onClose={() => setShowEditorModal(false)}
          termId={selectedTerm}
          initialSlot={editingSlot}
          mode={editorMode}
        />
      )}

      {/* Generation Panel Modal */}
      {showGenerationPanel && (
        <GenerationPanel
          termId={selectedTerm}
          schoolId={schoolData?.id}
          onClose={() => setShowGenerationPanel(false)}
        />
      )}
    </div>
  );

  function renderLesson(slot: Slot | undefined, dayIdx?: number, period?: number) {
    if (!slot) {
      // Empty cell - show add button for admin
      if (hasRoleAccess(["admin", "teacher"])) {
        return (
          <div 
            className="ut-lesson"
            style={{ 
              border: '2px dashed var(--ut-border)',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '70px',
              cursor: 'pointer',
            }}
            onClick={() => {
              setEditorDay(dayIdx !== undefined ? dayIdx + 1 : 1);
              setEditorPeriod(period || 1);
              setEditingSlot(null);
              setEditorMode('add');
              setShowEditorModal(true);
            }}
          >
            <span style={{ color: 'var(--ut-border)', fontSize: '20px' }}>+</span>
          </div>
        );
      }
      return null;
    }
    
    const today = new Date();
    const lessonDate = new Date(today);
    if (dayIdx !== undefined) {
      lessonDate.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) + (currentWeek * 7) + dayIdx);
    }
    
    const sub = getActiveSubstitution(slot.id, lessonDate);
    const isCancelled = sub?.isCancelled;
    const isSubstituted = !!sub && !isCancelled;
    const isCurrent = period ? isCurrentPeriod(period) : false;
    
    const color = isCancelled ? "#999" : isSubstituted ? "#FFC107" : getColor(slot, colorBy);
    
    return (
      <div 
        className={`ut-lesson ${isCancelled ? "ut-lesson-cancelled" : ""} ${isSubstituted ? "ut-lesson-substituted" : ""} ${isCurrent ? "ut-current-period-highlight" : ""}`} 
        style={{ borderLeftColor: color, backgroundColor: isCancelled ? "#f5f5f5" : `${color}15`, position: 'relative' }}
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHoveredSlot({ slot, position: { x: rect.right + 10, y: rect.top } });
        }}
        onMouseLeave={() => setHoveredSlot(null)}
      >
        {/* Edit Button */}
        {hasRoleAccess(["admin", "teacher"]) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingSlot(slot);
              setEditorMode('edit');
              setEditorDay(slot.day);
              setEditorPeriod(slot.period);
              setShowEditorModal(true);
            }}
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '20px',
              height: '20px',
              border: 'none',
              borderRadius: '4px',
              background: 'rgba(0,0,0,0.3)',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              opacity: 0.7,
            }}
            title="Edit"
          >
            ✎
          </button>
        )}
        
        {isCancelled && (
          <div className="ut-lesson-badge ut-badge-cancelled">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Cancelled
          </div>
        )}
        {isSubstituted && (
          <div className="ut-lesson-badge ut-badge-substituted">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
            Changed
          </div>
        )}
        <div className="ut-lesson-subject"><TooltipWrap text={slot.subject.name}><span>{abbreviateSubject(slot.subject.name)}</span></TooltipWrap></div>
        <div className="ut-lesson-info">
          <svg className="ut-lesson-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <TooltipWrap text={`${slot.teacher.user.firstName} ${slot.teacher.user.lastName}`}><span>{abbreviateTeacher(slot.teacher)}</span></TooltipWrap>
        </div>
        {(slot.classroom || slot.room) && (
          <div className="ut-lesson-room">
            <svg className="ut-lesson-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {slot.classroom?.name || slot.room?.name}
          </div>
        )}
        {(slot as any).weekType && (slot as any).weekType !== "regular" && (
          <div className="ut-lesson-week-badge">Week {(slot as any).weekType}</div>
        )}
      </div>
    );
  }
}
