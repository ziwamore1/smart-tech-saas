const subjectAbbreviationMap: Record<string, string> = {
  biology: "Bio",
  bio: "Bio",
  chemistry: "Chem",
  chem: "Chem",
  "civic education": "CE",
  "english language": "ENG",
  english: "ENG",
  eng: "ENG",
  "information and computer technology": "ICT",
  "information & computer technology": "ICT",
  "information and communications technology": "ICT",
  "information & communications technology": "ICT",
  ict: "ICT",
  mathematics: "Math",
  maths: "Math",
  math: "Math",
  geography: "Geo",
  geo: "Geo",
  history: "Hist",
  hist: "Hist",
  commerce: "Com",
  com: "Com",
  "principles of accounts": "POA",
  "principles of account": "POA",
  physics: "Phy",
  phys: "Phy",
  "religious education": "RE",
  re: "RE",
  "physical education": "PE",
  pe: "PE",
  "agricultural science": "Agri",
  "computer studies": "Comp",
  "integrated science": "IntSci",
  french: "Fre",
  "art and design": "Art",
  art: "Art",
  music: "Mus",
  "social studies": "SocSt",
  "home economics": "HomeEc",
  homemaking: "HomeEc",
  "food and nutrition": "Food",
  "technical drawing": "TD",
  drawing: "TD",
  "business studies": "BusSt",
};

export function abbreviateSubject(name: string | undefined, code?: string): string {
  if (!name) return "";
  const lower = name.trim().toLowerCase();
  if (subjectAbbreviationMap[lower]) return subjectAbbreviationMap[lower];
  const words = lower.split(/\s+/);
  if (words.length >= 2) {
    return words.map((w) => w[0]?.toUpperCase() || "").join("");
  }
  if (name.length > 6) {
    return name.slice(0, 4) + ".";
  }
  return name;
}

export function abbreviateClassName(name: string | undefined): string {
  if (!name) return "";
  const trimmed = name.trim();
  const patterns: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^Form\s+(\d+\s*[A-Za-z]?)$/i, (m) => "F" + m[1].replace(/\s/g, "")],
    [/^Grade\s+(\d+\s*[A-Za-z]?)$/i, (m) => "G" + m[1].replace(/\s/g, "")],
    [/^Class\s+(\d+\s*[A-Za-z]?)$/i, (m) => m[1].replace(/\s/g, "")],
    [/^Year\s+(\d+\s*[A-Za-z]?)$/i, (m) => "Y" + m[1].replace(/\s/g, "")],
    [/^SS\s+(\d+)\s*([A-Za-z]?)$/i, (m) => "SS" + m[1] + (m[2] || "")],
    [/^JSS\s+(\d+)\s*([A-Za-z]?)$/i, (m) => "JSS" + m[1] + (m[2] || "")],
  ];

  for (const [regex, replacer] of patterns) {
    const match = trimmed.match(regex);
    if (match) return replacer(match);
  }

  if (trimmed.length > 6) {
    const words = trimmed.split(/\s+/);
    if (words.length >= 2) {
      return words.map((w) => w[0]?.toUpperCase() || "").join("");
    }
    return trimmed.slice(0, 5);
  }
  return trimmed;
}

export function abbreviateTeacher(
  teacher: { title?: string; firstName?: string; lastName?: string; abbreviation?: string; name?: string; user?: { firstName?: string; lastName?: string } } | undefined | null
): string {
  if (!teacher) return "";
  const lastName = teacher.lastName || teacher.user?.lastName || "";
  const firstName = teacher.firstName || teacher.user?.firstName || "";
  if (firstName && lastName) return `${firstName.trim()[0]}. ${lastName}`;
  if (lastName) return lastName;
  if (firstName) return firstName;
  if (teacher.name) return teacher.name;
  return "";
}

export function getTeacherShortName(teacher: any): string {
  if (!teacher) return "";
  const lastName = teacher.lastName || teacher.user?.lastName || "";
  const firstName = teacher.firstName || teacher.user?.firstName || "";
  if (firstName && lastName) return `${firstName[0]}. ${lastName}`;
  if (lastName) return lastName;
  if (firstName) return firstName;
  if (teacher.name) return teacher.name;
  return "";
}
