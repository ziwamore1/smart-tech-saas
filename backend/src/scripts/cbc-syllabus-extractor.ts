import { readFileSync } from 'fs';

export interface ExtractedSyllabusRow {
  formNumber?: number;
  conceptCode?: string;
  concept: string;
  subtopicCode?: string;
  subtopic: string;
  competencyCode: string;
  competency: string;
  learningActivities: string[];
  expectedStandard?: string;
  sourcePage: number;
  rawText: string;
}

export function syllabusRowCompleteness(row: ExtractedSyllabusRow) {
  return Boolean(
    row.concept &&
    row.subtopic &&
    row.competencyCode &&
    row.competency &&
    row.learningActivities.length > 0 &&
    row.expectedStandard,
  );
}

const COLUMN_NAMES = [
  ['concepts', 'topic'],
  ['sub-topics', 'sub-topic', 'subtopics', 'subtopic'],
  ['specific competences', 'specific', 'competences'],
  ['learning activities'],
  ['expected standard', 'expected', 'standard'],
];

function decodeLegacyText(value: string) {
  const decodePlus29 = (text: string) => [...text].map(char => {
    const code = char.charCodeAt(0);
    return code >= 1 && code <= 127 ? String.fromCharCode(code + 29) : char;
  }).join('');
  if ([...value].some(char => char.charCodeAt(0) < 32) || /&[A-Z]|[67][$']|\d.*&|^\d[^.]*[,/]|\*HRJ|5HOL|723,&/.test(value)) return decodePlus29(value);
  if (/DFF|5HQ|7K|LQ|H[WU]/i.test(value)) {
    return [...value].map(char => {
      const code = char.charCodeAt(0);
      return code >= 35 && code <= 126 ? String.fromCharCode(code - 3) : char;
    }).join('');
  }
  if (/\^ka|qeb|\blk\b|bks|erj/i.test(value)) {
    return [...value].map(char => {
      const code = char.charCodeAt(0);
      return code >= 35 && code <= 126 ? String.fromCharCode(code + 3) : char;
    }).join('');
  }
  return value;
}

function cleanText(value: string) {
  return decodeLegacyText(value)
    .replace(/[]/g, '•')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*(?:(?:[.·…]\s*){3,})\d+\s*$/g, '')
    .replace(/^[•x](?:=)?\s*/i, '')
    .replace(/\s+[•x](?:=)?\s*$/i, '')
    .trim();
}

function removeCode(value: string) {
  return value.replace(/^\d+(?:\.\d+){1,}\.?\s*/, '').trim();
}

function labelForCode(value: string, codePrefix: string) {
  const escaped = codePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = value.match(new RegExp(`(?:^|\\s)${escaped}\\.?\\s+(.+?)(?=\\s+\\d+(?:\\.\\d+){1,}\\.?\\s|$)`));
  return match?.[1]?.trim();
}

function formFromCode(code: string) {
  const form = Number(code.split('.')[0]);
  return form >= 1 && form <= 4 ? form : undefined;
}

function groupByLine(items: any[]) {
  const groups: Array<{ position: number; text: string }> = [];
  for (const item of [...items].sort((a, b) => a.position - b.position)) {
    const previous = groups[groups.length - 1];
    if (previous && Math.abs(previous.position - item.position) <= 1.5) previous.text += ` ${item.text}`;
    else groups.push({ position: item.position, text: item.text });
  }
  return groups;
}

function cellText(items: any[], start: number, end: number) {
  return groupByLine(items.filter(item => item.position >= start && item.position < end).map(item => ({ ...item, text: cleanText(item.text) })))
    .map(item => item.text)
    .filter(Boolean)
    .join(' ')
    .replace(/^[x•](?:=)?\s*/i, '')
    .trim();
}

function cellActivities(items: any[], start: number, end: number) {
  const groups = groupByLine(items.filter(item => item.position >= start && item.position < end).map(item => ({ ...item, text: cleanText(item.text) })));
  const activities: string[] = [];
  let current = '';
  for (const group of groups) {
    const text = group.text.replace(/^[x•](?:=)?\s*/i, '').replace(/\s+[•x](?:=)?\s*$/i, '').trim();
    if (!text) continue;
    const startsBullet = /^[x•](?:=)?\s*/i.test(group.text);
    if (startsBullet && current) {
      activities.push(current.trim());
      current = '';
    }
    current += `${current ? ' ' : ''}${text}`;
  }
  if (current.trim()) activities.push(current.trim());
  return activities;
}

function headerPositions(items: any[]) {
  const found = COLUMN_NAMES.map((names, index) => {
    const item = items.find(candidate => names.some(name => {
      const value = candidate.text.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
      const target = name.replace(/[^a-z]+/g, ' ');
      if (index === 0) return (target === 'topic' && value === 'topic') || (target !== 'topic' && value.startsWith(target));
      if (index === 1) return value.startsWith(target);
      return value === target || value.startsWith(`${target} `);
    }));
    return item?.column;
  });
  return found.every(position => typeof position === 'number') ? found as number[] : null;
}

export async function extractStructuredSyllabusRows(filePath: string): Promise<ExtractedSyllabusRow[]> {
  const globals = globalThis as any;
  globals.DOMMatrix ||= class {};
  globals.ImageData ||= class {};
  globals.Path2D ||= class {};
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(filePath)), verbosity: 0 }).promise;
  const rows: ExtractedSyllabusRow[] = [];
  let previousRow: ExtractedSyllabusRow | undefined;
  let defaultHeaders: number[] | null = null;

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const rotatedTable = page.rotate === 90 || page.rotate === 270;
    const rawItems = (content.items as any[])
      .filter(item => String(item.str || '').trim())
      .map(item => ({
        text: cleanText(String(item.str)),
        rawText: String(item.str),
        position: rotatedTable ? Number(item.transform[4]) : -Number(item.transform[5]),
        column: rotatedTable ? Number(item.transform[5]) : Number(item.transform[4]),
      }));
    const detectedHeaders = headerPositions(rawItems);
    if (detectedHeaders) defaultHeaders = detectedHeaders;
    const headers = detectedHeaders || defaultHeaders;
    if (!headers) continue;

    const columns = headers.map((header, index) => rawItems
      .filter(item => Math.abs(item.column - header) <= 38 || (index === 4 && item.column >= header - 55))
      .map(item => ({ position: item.position, text: item.text, rawText: item.rawText })));
    const competenceItems = columns[2]
      .filter(item => /^\d+(?:\.\d+){3,}\.?(?:\s+.*)?$/.test(item.text))
      .sort((a, b) => a.position - b.position);

    if (previousRow && columns[3].length && columns[4].length) {
      const continuationEnd = competenceItems[0]?.position ?? Number.POSITIVE_INFINITY;
      const continuationStart = competenceItems[0] ? continuationEnd - 25 : Number.POSITIVE_INFINITY;
      const continuationActivities = competenceItems.length ? cellActivities(columns[3], continuationStart, continuationEnd) : [];
      const continuationStandard = competenceItems.length ? cellText(columns[4], continuationStart, continuationEnd) : '';
      if (continuationActivities.length) previousRow.learningActivities.push(...continuationActivities);
      if (!previousRow.expectedStandard && continuationStandard) previousRow.expectedStandard = continuationStandard;
    }
    if (!competenceItems.length) continue;
    for (let index = 0; index < competenceItems.length; index += 1) {
      const competenceStart = competenceItems[index].position;
      const nextStart = competenceItems[index + 1]?.position ?? Number.POSITIVE_INFINITY;
      const competenceMatch = competenceItems[index].text.match(/^(\d+(?:\.\d+){3,})\.?(?:\s+(.+))?$/);
      if (!competenceMatch) continue;
      const competencyCode = competenceMatch[1];
      const codeParts = competencyCode.split('.');
      const conceptCode = codeParts.length >= 5 ? codeParts.slice(0, 3).join('.') : `${codeParts[0]}.${codeParts[1]}.0`;
      const subtopicCode = codeParts.length >= 5 ? codeParts.slice(0, 4).join('.') : codeParts.slice(0, 3).join('.');
      const conceptCell = cellText(columns[0], competenceStart - 15, nextStart);
      const subtopicCell = cellText(columns[1], competenceStart - 15, nextStart);
      const competencyCell = cellText(columns[2], competenceStart, nextStart);
      const activities = cellActivities(columns[3], competenceStart, nextStart);
      const standard = cellText(columns[4], competenceStart, nextStart);
      const concept = labelForCode(conceptCell, codeParts.length >= 5 ? codeParts.slice(0, 3).join('.') : codeParts.slice(0, 2).join('.')) || removeCode(conceptCell) || previousRow?.concept || conceptCode;
      const subtopic = labelForCode(subtopicCell, subtopicCode) || removeCode(subtopicCell) || previousRow?.subtopic || subtopicCode;
      const competency = labelForCode(competencyCell, competencyCode) || removeCode(competencyCell) || competenceMatch[2] || competencyCode;
      const row: ExtractedSyllabusRow = {
        formNumber: formFromCode(competencyCode),
        conceptCode,
        concept,
        subtopicCode,
        subtopic,
        competencyCode,
        competency,
        learningActivities: activities,
        expectedStandard: standard || undefined,
        sourcePage: pageNumber,
        rawText: [conceptCell, subtopicCell, competencyCell, activities.join(' | '), standard].filter(Boolean).join(' | '),
      };
      rows.push(row);
      previousRow = row;
    }
  }
  return rows;
}
