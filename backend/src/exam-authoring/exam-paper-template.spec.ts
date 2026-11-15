import { renderExamPaperHtml } from './exam-paper-template';

const snapshot = {
  durationMinutes: 150,
  totalMarks: 100,
  sections: [
    {
      title: 'Section A',
      answerRule: 'ALL',
      instructions: 'Answer all items.',
      questions: [{
        number: 1,
        stem: 'Draw a graph for the data.',
        marks: 10,
        tasks: [{ label: '(a)', prompt: 'Draw a graph.', marks: 10 }],
        markingKey: [{ task: '(a)', answer: 'Correct graph.', markAllocation: [{ marks: 10, criterion: 'Correct graph' }], diagram: { type: 'SVG', svg: '<svg><circle cx="10" cy="10" r="5"/></svg>' } }],
      }],
    },
    { title: 'Section B', answerRule: 'ONE', instructions: 'Answer one item.', questions: [{ number: 2, stem: 'Explain the result.', marks: 20, tasks: [{ label: '(a)', prompt: 'Explain the result.', marks: 20 }] }] },
  ],
};

describe('exam paper HTML template', () => {
  it('renders a branded cover, candidate identity fields and candidate graph space', () => {
    const html = renderExamPaperHtml({
      version: 1,
      title: 'Term Examination',
      subjectName: 'Biology',
      className: 'Grade 12',
      termName: 'Term 2',
      academicYearName: '2026',
      durationMinutes: 150,
      totalMarks: 100,
      school: { name: 'Sample Academy', motto: 'Learn and Serve', primaryColor: '#173b68' },
      snapshot,
      includeAnswers: false,
    });

    expect(html).toContain('Sample Academy');
    expect(html).toContain('Candidate name:');
    expect(html).toContain('Paper structure and marks');
    expect(html).toContain('graph-answer-space');
    expect(html).not.toContain('Marking key');
  });

  it('renders examiner diagrams without using a browser print window', () => {
    const html = renderExamPaperHtml({
      version: 1,
      title: 'Term Examination',
      subjectName: 'Biology',
      className: 'Grade 12',
      durationMinutes: 150,
      totalMarks: 100,
      school: { name: 'Sample Academy' },
      snapshot,
      includeAnswers: true,
    });

    expect(html).toContain('EXAMINER MARKING SCHEME');
    expect(html).toContain('Marking key');
    expect(html).toContain('<circle');
    expect(html).not.toContain('window.print');
  });
});
