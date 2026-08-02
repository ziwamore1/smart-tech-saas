// Human-friendly subject shortcuts keyed by subject name.
// These are the labels used as column headers in results templates and
// on-screen tables. The Subject.code field holds numeric codes (e.g. "1121")
// and must NOT be used as a display label.
export const subjectShortcuts: Record<string, string> = {
  Mathematics: 'MATH',
  'Mathematics I': 'MATH I',
  'Mathematics II': 'MATH II',
  'English Language': 'ENG',
  English: 'ENG',
  Biology: 'BIO',
  Chemistry: 'CHEM',
  Physics: 'PHY',
  Geography: 'GEO',
  History: 'HIST',
  'Religious Education': 'RE',
  French: 'FR',
  'Computer Studies': 'ICT',
  'Information and Communication Technology': 'ICT',
  'Information and Communications Technology': 'ICT',
  'Design and Technology': 'DT',
  'Physical Education and Sports': 'PES',
  'Physical Education': 'PE',
  'Creative and Performing Art': 'CPA',
  'Art and Design': 'ART',
  'Fashion and Fabrics': 'FF',
  Music: 'MUS',
  Commerce: 'COM',
  'Business Studies': 'BS',
  'Home Economics': 'HE',
  'Technical Drawing': 'TD',
  'Literature in English': 'LIT',
  'Civic Education': 'CIV',
  'Zambian Language': 'ZL',
  'Zambian Languages': 'ZL',
  'Agricultural Science': 'AGR',
  'Food and Nutrition': 'FN',
  'Additional Mathematics': 'AM',
  'Computer Science': 'CS',
  Economics: 'ECON',
  Government: 'GOV',
  'Principles of Accounts': 'PA',
  'Transport and Tourism': 'TT',
};

export function getSubjectShortcut(name: string | null | undefined): string {
  if (!name) return '??';
  const normalized = name.toUpperCase().trim();
  const shortcut =
    subjectShortcuts[name] ||
    subjectShortcuts[
      Object.keys(subjectShortcuts).find((k) => k.toUpperCase() === normalized) || ''
    ];
  if (shortcut) return shortcut;
  const words = name.split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 4).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
