import { renderDiagramSvg } from './exam-diagram-renderer';

export interface ExamPaperTemplateInput {
  version: number;
  title: string;
  subjectName: string;
  className: string;
  termName?: string;
  academicYearName?: string;
  durationMinutes: number;
  totalMarks: number;
  school: {
    name: string;
    logoUrl?: string | null;
    motto?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    primaryColor?: string | null;
  };
  snapshot: any;
  includeAnswers: boolean;
}

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));

const safeColor = (value: unknown) => /^#[0-9a-f]{3,8}$/i.test(String(value || '')) ? String(value) : '#173b68';

const answerSpace = (marks: number) => `<div class="answer-space" style="--answer-lines:${Math.max(2, Math.min(6, Math.ceil(Number(marks || 0) / 2)))}" aria-label="Written answer area"></div>`;

const taskAnswerSpace = (task: any) => {
  const prompt = String(task.prompt || '').toLowerCase();
  if (/graph|cartesian|histogram|frequency polygon|plot/.test(prompt)) return '<div class="graph-answer-space" aria-label="Graph answer area"></div>';
  if (/venn/.test(prompt)) return '<div class="venn-answer-space" aria-label="Venn diagram answer area"></div>';
  if (/construct|construction|triangle|circumcircle|scale model/.test(prompt)) return '<div class="construction-answer-space" aria-label="Construction answer area"></div>';
  if (/draw|diagram|sketch|illustrate/.test(prompt)) return '<div class="diagram-answer-space" aria-label="Diagram answer area"></div>';
  return answerSpace(task.marks);
};

const sectionRules = (section: any) => {
  if (section.answerRule === 'ONE') return `Answer one item in ${section.title}.`;
  if (section.answerRule === 'ANY') return `Answer the required number of items in ${section.title}.`;
  if (section.answerRule === 'ALL') return `Answer all items in ${section.title}.`;
  return '';
};

const defaultInstructions = (snapshot: any) => {
  const supplied = Array.isArray(snapshot?.candidateInstructions) ? snapshot.candidateInstructions : [];
  if (supplied.length) return supplied.map((item: any) => String(item));
  return [
    'Write your name, class and examination number in the spaces provided.',
    'Write your examination number on every page of this paper.',
    'Follow the answer rule stated for each section.',
    'The number of marks is shown in brackets at the end of each task or part task.',
    'Write all answers in the spaces provided and show your working where applicable.',
  ];
};

const additionalMaterials = (snapshot: any) => {
  const materials = snapshot?.metadata?.additionalMaterials || snapshot?.additionalMaterials;
  return Array.isArray(materials) ? materials.map((item: any) => String(item)).filter(Boolean) : [];
};

const renderMarksTable = (sections: any[]) => {
  const rows = sections.map(section => {
    const marks = section.answerRule === 'ONE'
      ? Number(section.questions?.[0]?.marks || 0)
      : (section.questions || []).reduce((sum: number, question: any) => sum + Number(question.marks || 0), 0);
    return `<tr><td>${escapeHtml(section.title)}</td><td>${(section.questions || []).length}</td><td>${marks}</td><td>${escapeHtml(section.answerRule === 'ONE' ? 'One item' : section.answerRule === 'ANY' ? 'Required number' : 'All items')}</td></tr>`;
  }).join('');
  return `<table class="marks-table"><thead><tr><th>Section</th><th>Items</th><th>Marks</th><th>Candidate response</th></tr></thead><tbody>${rows}<tr class="total-row"><th colspan="2">Total</th><th>${Number(sections.reduce((sum: number, section: any) => sum + (section.answerRule === 'ONE' ? Number(section.questions?.[0]?.marks || 0) : (section.questions || []).reduce((inner: number, question: any) => inner + Number(question.marks || 0), 0)), 0))}</th><th></th></tr></tbody></table>`;
};

const renderMarkingKey = (key: any) => {
  const diagram = key.diagram
    ? renderDiagramSvg(key.diagram)
    : key.diagramSvg
      ? renderDiagramSvg({ type: 'SVG', svg: key.diagramSvg })
      : '';
  const caption = key.diagram?.caption ? `<div class="diagram-caption">${escapeHtml(key.diagram.caption)}</div>` : '';
  return `<div class="marking-key-item"><p><b>${escapeHtml(key.task || 'Answer')}</b>: ${escapeHtml(key.answer || '')}<br/><span class="criteria">${(key.markAllocation || []).map((item: any) => `${item.marks} ${escapeHtml(item.criterion || '')}`).join('; ')}</span>${key.acceptableAlternatives?.length ? `<br/><span class="alternatives">Accept: ${escapeHtml(key.acceptableAlternatives.join('; '))}</span>` : ''}</p>${diagram ? `<div class="diagram">${diagram}${caption}</div>` : ''}</div>`;
};

const renderSections = (snapshot: any, includeAnswers: boolean) => (snapshot.sections || []).map((section: any) => {
  const candidateMarks = section.answerRule === 'ONE'
    ? Number(section.questions?.[0]?.marks || 0)
    : (section.questions || []).reduce((sum: number, question: any) => sum + Number(question.marks || 0), 0);
  const questions = (section.questions || []).map((question: any) => `<article class="question-block"><div class="question-stem"><strong>${escapeHtml(question.number)}.</strong> ${escapeHtml(question.stem)}${(question.tasks || []).length ? '' : ` <span class="mark">[${question.marks}]</span>`}</div>${(question.tasks || []).map((task: any) => `<div class="task-block"><div class="task"><strong>${escapeHtml(task.label || '')}</strong> ${escapeHtml(task.prompt || '')} <span class="mark">[${task.marks}]</span></div>${includeAnswers ? '' : taskAnswerSpace(task)}</div>`).join('')}${includeAnswers ? `<div class="answer-key"><div class="answer-key-title">Marking key</div>${(question.markingKey || []).map(renderMarkingKey).join('')}</div>` : ''}</article>`).join('');
  return `<section class="paper-section"><h2>${escapeHtml(section.title)} <span>${candidateMarks} marks</span></h2><p class="section-instruction">${escapeHtml(section.instructions || sectionRules(section))}</p>${questions}</section>`;
}).join('');

export function renderExamPaperHtml(input: ExamPaperTemplateInput) {
  const color = safeColor(input.school.primaryColor);
  const sections = input.snapshot?.sections || [];
  const instructions = defaultInstructions(input.snapshot);
  const materials = additionalMaterials(input.snapshot);
  const logo = input.school.logoUrl ? `<img class="school-logo" src="${escapeHtml(input.school.logoUrl)}" alt="${escapeHtml(input.school.name)} logo"/>` : `<div class="school-logo-placeholder">${escapeHtml(input.school.name.slice(0, 2).toUpperCase())}</div>`;
  const contact = [input.school.address, input.school.phone, input.school.email].filter(Boolean).map(escapeHtml).join(' | ');
  const edition = input.includeAnswers ? 'EXAMINER MARKING SCHEME' : 'CANDIDATE PAPER';
  const year = input.academicYearName || new Date().getFullYear();
  const sectionInstructions = sections.map(sectionRules).filter(Boolean).join(' ');
  const candidateInstructions = [...instructions, ...(sectionInstructions ? [sectionInstructions] : [])];

  const identityFields = !input.includeAnswers ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:-5px 0 18px"><div style="border-bottom:1px solid #64748b;min-height:28px;padding:5px 0"><strong>Candidate name:</strong></div><div style="border-bottom:1px solid #64748b;min-height:28px;padding:5px 0"><strong>Examination number:</strong></div><div style="border-bottom:1px solid #64748b;min-height:28px;padding:5px 0"><strong>Class/Form:</strong> ${escapeHtml(input.className)}</div><div style="border-bottom:1px solid #64748b;min-height:28px;padding:5px 0"><strong>Date:</strong></div></div>` : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
@page{size:A4;margin:20mm 16mm 18mm}body{font-family:Arial,Helvetica,sans-serif;color:#172033;font-size:10.5pt;line-height:1.42;margin:0}*{box-sizing:border-box}.cover-page{min-height:250mm;page-break-after:always;display:flex;flex-direction:column}.cover-brand{border-top:8px solid ${color};border-bottom:1px solid #cbd5e1;padding:8px 0 7px;display:flex;align-items:center;gap:14px}.school-logo,.school-logo-placeholder{width:64px;height:64px;object-fit:contain;border:1px solid #cbd5e1;border-radius:8px}.school-logo-placeholder{display:flex;align-items:center;justify-content:center;background:#eef4fb;color:${color};font-size:20px;font-weight:700}.school-name{font-size:17pt;font-weight:800;color:${color};margin:0}.motto{font-size:9pt;color:#526174;margin-top:2px}.contact{font-size:8pt;color:#526174;margin-top:3px}.cover-title{text-align:center;margin:18px 0 12px}.cover-title .edition{font-size:9pt;letter-spacing:1.1px;font-weight:700;color:${color}}.cover-title h1{font-size:18pt;margin:6px 0;color:#111827}.cover-title h3{font-size:12pt;margin:3px 0;font-weight:600}.metadata-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #94a3b8;margin:8px 0 12px}.metadata-grid div{padding:6px 9px;border-bottom:1px solid #cbd5e1}.metadata-grid div:nth-child(odd){border-right:1px solid #cbd5e1}.metadata-grid div:nth-last-child(-n+2){border-bottom:0}.metadata-grid strong{display:block;font-size:7.5pt;text-transform:uppercase;color:#64748b;letter-spacing:.5px}.metadata-grid span{font-size:10pt;font-weight:700}.cover-columns{display:grid;grid-template-columns:1fr 1fr;gap:18px}.cover-box{border-top:3px solid ${color};padding-top:5px}.cover-box h3{font-size:10.5pt;margin:0 0 4px;color:${color}}.cover-box ol,.cover-box ul{margin:3px 0 0 18px;padding:0}.cover-box li{margin:3px 0}.cover-footer{margin-top:auto;padding-top:10px;display:flex;justify-content:space-between;border-top:1px solid #cbd5e1;font-size:8pt;color:#64748b}.paper-section{page-break-before:auto}.paper-section h2{font-size:13pt;color:${color};border-bottom:2px solid ${color};padding-bottom:5px;margin:18px 0 4px;page-break-after:avoid}.paper-section h2 span{float:right;font-size:10pt}.section-instruction{font-style:italic;margin:0 0 12px;color:#526174}.question-block{margin:14px 0 20px}.question-stem{font-size:11pt;margin:0 0 10px}.task-block{page-break-inside:avoid;margin:0 0 18px 22px}.task{margin:0 0 8px;position:relative;padding-right:45px}.mark{float:right;font-weight:700;white-space:nowrap}.candidate-answer-space{margin-left:22px}.answer-space{height:calc(var(--answer-lines) * 26px);margin:8px 0 13px;background:repeating-linear-gradient(to bottom,transparent 0,transparent 25px,#94a3b8 25px,#94a3b8 26px)}.graph-answer-space{width:100%;height:260px;margin:12px 0 18px;border:1px solid #334155;background-image:linear-gradient(#dbe4ef 1px,transparent 1px),linear-gradient(90deg,#dbe4ef 1px,transparent 1px);background-size:14px 14px}.venn-answer-space,.construction-answer-space{width:100%;height:260px;margin:12px 0 18px;border:1px solid #64748b}.diagram-answer-space{width:100%;height:220px;margin:12px 0 18px;border:1px solid #94a3b8}.answer-key{border-left:4px solid ${color};background:#f4f7fb;padding:9px 12px;margin:12px 0;font-size:9pt}.answer-key-title{font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:${color};margin-bottom:7px}.marking-key-item{margin-bottom:10px;page-break-inside:avoid}.criteria{color:#334155}.alternatives{color:#526174}.diagram{margin:9px 0;padding:8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;page-break-inside:avoid}.diagram svg{display:block;width:100%;max-width:150mm;height:auto;margin:0 auto}.diagram-caption{font-size:8pt;color:#526174;font-style:italic;margin-top:4px}.running-footer{font-size:8pt;color:#526174;width:100%;text-align:center}.marks-table{border-collapse:collapse;width:100%;margin-top:5px;page-break-inside:avoid}.marks-table th,.marks-table td{border:1px solid #94a3b8;padding:5px 6px;text-align:left}.marks-table th{background:#eef4fb}.marks-table th:nth-child(2),.marks-table th:nth-child(3),.marks-table td:nth-child(2),.marks-table td:nth-child(3){text-align:center;width:14%}.total-row th{background:#e2e8f0}.end-paper{text-align:center;font-weight:700;margin:32px 0;page-break-inside:avoid}
}</style></head><body><main class="cover-page"><div class="cover-brand">${logo}<div><p class="school-name">${escapeHtml(input.school.name)}</p>${input.school.motto ? `<div class="motto">${escapeHtml(input.school.motto)}</div>` : ''}${contact ? `<div class="contact">${contact}</div>` : ''}</div></div><div class="cover-title"><div class="edition">${edition}</div><h1>${escapeHtml(input.title)}</h1><h3>${escapeHtml(input.subjectName)}</h3><p>${escapeHtml(input.className)}${input.termName ? ` · ${escapeHtml(input.termName)}` : ''}${input.academicYearName ? ` · ${escapeHtml(input.academicYearName)}` : ''}</p></div><div class="metadata-grid"><div><strong>Time allowed</strong><span>${Number(input.durationMinutes)} minutes</span></div><div><strong>Total marks</strong><span>${Number(input.totalMarks)}</span></div><div><strong>Version</strong><span>${input.version}</span></div><div><strong>Paper status</strong><span>${input.includeAnswers ? 'Examiner copy' : 'Candidate copy'}</span></div></div>${identityFields}<div class="cover-columns"><div class="cover-box"><h3>${input.includeAnswers ? 'Examiner information' : 'Instructions to candidates'}</h3><ol>${candidateInstructions.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol></div><div class="cover-box"><h3>${materials.length ? 'Additional materials' : 'Paper information'}</h3>${materials.length ? `<ul>${materials.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '<p>No additional materials specified for this paper.</p>'}</div></div><div class="cover-box" style="margin-top:18px"><h3>Paper structure and marks</h3>${renderMarksTable(sections)}</div>${input.includeAnswers ? `<div class="cover-box" style="margin-top:18px"><h3>Examiner use</h3><p>Use this copy with the marking key. Apply method marks consistently and record moderation decisions through the examination authoring workflow.</p></div>` : ''}<div class="cover-footer"><span>${escapeHtml(input.school.name)}</span><span>${escapeHtml(String(year))} · ${edition}</span></div></main><main class="paper-content">${renderSections(input.snapshot, input.includeAnswers)}<div class="end-paper">END OF PAPER</div></main></body></html>`;
}

export function escapeExamHtml(value: unknown) {
  return escapeHtml(value);
}
