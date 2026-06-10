export interface SubjectColorConfig {
  bg: string;
  text: string;
  border: string;
  hover: string;
}

export const subjectColors: Record<string, SubjectColorConfig> = {
  MATHS: {
    bg: "bg-amber-200",
    text: "text-amber-900",
    border: "border-amber-400",
    hover: "hover:bg-amber-300"
  },
  ENGLISH: {
    bg: "bg-blue-200",
    text: "text-blue-900",
    border: "border-blue-400",
    hover: "hover:bg-blue-300"
  },
  ENG: {
    bg: "bg-blue-200",
    text: "text-blue-900",
    border: "border-blue-400",
    hover: "hover:bg-blue-300"
  },
  BIOLOGY: {
    bg: "bg-green-200",
    text: "text-green-900",
    border: "border-green-400",
    hover: "hover:bg-green-300"
  },
  BIO: {
    bg: "bg-green-200",
    text: "text-green-900",
    border: "border-green-400",
    hover: "hover:bg-green-300"
  },
  CHEMISTRY: {
    bg: "bg-pink-200",
    text: "text-pink-900",
    border: "border-pink-400",
    hover: "hover:bg-pink-300"
  },
  CHEM: {
    bg: "bg-pink-200",
    text: "text-pink-900",
    border: "border-pink-400",
    hover: "hover:bg-pink-300"
  },
  PHYSICS: {
    bg: "bg-indigo-200",
    text: "text-indigo-900",
    border: "border-indigo-400",
    hover: "hover:bg-indigo-300"
  },
  PHYS: {
    bg: "bg-indigo-200",
    text: "text-indigo-900",
    border: "border-indigo-400",
    hover: "hover:bg-indigo-300"
  },
  ICT: {
    bg: "bg-violet-200",
    text: "text-violet-900",
    border: "border-violet-400",
    hover: "hover:bg-violet-300"
  },
  COMPUTER: {
    bg: "bg-violet-200",
    text: "text-violet-900",
    border: "border-violet-400",
    hover: "hover:bg-violet-300"
  },
  COM: {
    bg: "bg-violet-200",
    text: "text-violet-900",
    border: "border-violet-400",
    hover: "hover:bg-violet-300"
  },
  GEOGRAPHY: {
    bg: "bg-teal-200",
    text: "text-teal-900",
    border: "border-teal-400",
    hover: "hover:bg-teal-300"
  },
  GEO: {
    bg: "bg-teal-200",
    text: "text-teal-900",
    border: "border-teal-400",
    hover: "hover:bg-teal-300"
  },
  HISTORY: {
    bg: "bg-orange-200",
    text: "text-orange-900",
    border: "border-orange-400",
    hover: "hover:bg-orange-300"
  },
  "RELIGIOUS EDUCATION": {
    bg: "bg-rose-200",
    text: "text-rose-900",
    border: "border-rose-400",
    hover: "hover:bg-rose-300"
  },
  RE: {
    bg: "bg-rose-200",
    text: "text-rose-900",
    border: "border-rose-400",
    hover: "hover:bg-rose-300"
  },
  FRENCH: {
    bg: "bg-sky-200",
    text: "text-sky-900",
    border: "border-sky-400",
    hover: "hover:bg-sky-300"
  },
  CHINESE: {
    bg: "bg-red-200",
    text: "text-red-900",
    border: "border-red-400",
    hover: "hover:bg-red-300"
  },
  ART: {
    bg: "bg-fuchsia-200",
    text: "text-fuchsia-900",
    border: "border-fuchsia-400",
    hover: "hover:bg-fuchsia-300"
  },
  MUSIC: {
    bg: "bg-purple-200",
    text: "text-purple-900",
    border: "border-purple-400",
    hover: "hover:bg-purple-300"
  },
  PE: {
    bg: "bg-lime-200",
    text: "text-lime-900",
    border: "border-lime-400",
    hover: "hover:bg-lime-300"
  },
  PHYSICAL: {
    bg: "bg-lime-200",
    text: "text-lime-900",
    border: "border-lime-400",
    hover: "hover:bg-lime-300"
  },
  TECHNICAL: {
    bg: "bg-slate-200",
    text: "text-slate-900",
    border: "border-slate-400",
    hover: "hover:bg-slate-300"
  },
  DRAWING: {
    bg: "bg-stone-200",
    text: "text-stone-900",
    border: "border-stone-400",
    hover: "hover:bg-stone-300"
  },
  COMMERCE: {
    bg: "bg-cyan-200",
    text: "text-cyan-900",
    border: "border-cyan-400",
    hover: "hover:bg-cyan-300"
  },
  BUSINESS: {
    bg: "bg-cyan-200",
    text: "text-cyan-900",
    border: "border-cyan-400",
    hover: "hover:bg-cyan-300"
  },
  HOMEMAKING: {
    bg: "bg-amber-200",
    text: "text-amber-900",
    border: "border-amber-400",
    hover: "hover:bg-amber-300"
  },
  FOOD: {
    bg: "bg-amber-200",
    text: "text-amber-900",
    border: "border-amber-400",
    hover: "hover:bg-amber-300"
  },
};

export function getSubjectColor(subjectName: string): SubjectColorConfig {
  const normalized = subjectName?.toUpperCase()?.trim() || ""

  if (subjectColors[normalized]) {
    return subjectColors[normalized]
  }

  for (const [key, config] of Object.entries(subjectColors)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return config
    }
  }

  const hash = normalized.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const colors = [
    { bg: "bg-red-200", text: "text-red-900", border: "border-red-400", hover: "hover:bg-red-300" },
    { bg: "bg-orange-200", text: "text-orange-900", border: "border-orange-400", hover: "hover:bg-orange-300" },
    { bg: "bg-yellow-200", text: "text-yellow-900", border: "border-yellow-400", hover: "hover:bg-yellow-300" },
    { bg: "bg-green-200", text: "text-green-900", border: "border-green-400", hover: "hover:bg-green-300" },
    { bg: "bg-teal-200", text: "text-teal-900", border: "border-teal-400", hover: "hover:bg-teal-300" },
    { bg: "bg-blue-200", text: "text-blue-900", border: "border-blue-400", hover: "hover:bg-blue-300" },
    { bg: "bg-indigo-200", text: "text-indigo-900", border: "border-indigo-400", hover: "hover:bg-indigo-300" },
    { bg: "bg-violet-200", text: "text-violet-900", border: "border-violet-400", hover: "hover:bg-violet-300" },
    { bg: "bg-purple-200", text: "text-purple-900", border: "border-purple-400", hover: "hover:bg-purple-300" },
    { bg: "bg-fuchsia-200", text: "text-fuchsia-900", border: "border-fuchsia-400", hover: "hover:bg-fuchsia-300" },
    { bg: "bg-pink-200", text: "text-pink-900", border: "border-pink-400", hover: "hover:bg-pink-300" },
    { bg: "bg-rose-200", text: "text-rose-900", border: "border-rose-400", hover: "hover:bg-rose-300" },
  ]

  return colors[hash % colors.length]
}

export const dayLabels = [
  { id: 1, short: "Mon", full: "Monday" },
  { id: 2, short: "Tue", full: "Tuesday" },
  { id: 3, short: "Wed", full: "Wednesday" },
  { id: 4, short: "Thu", full: "Thursday" },
  { id: 5, short: "Fri", full: "Friday" },
  { id: 6, short: "Sat", full: "Saturday" },
  { id: 7, short: "Sun", full: "Sunday" },
]

export const periodTimes = [
  { period: 1, start: "07:30", end: "08:15" },
  { period: 2, start: "08:15", end: "09:00" },
  { period: 3, start: "09:00", end: "09:45" },
  { period: 4, start: "09:45", end: "10:30" },
  { period: 5, start: "10:30", end: "11:15" },
  { period: 6, start: "11:15", end: "12:00" },
  { period: 7, start: "12:00", end: "12:45" },
  { period: 8, start: "12:45", end: "13:30" },
]
