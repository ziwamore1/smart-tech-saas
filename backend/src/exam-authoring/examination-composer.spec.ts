import { ExaminationComposer } from './examination-composer';

const blueprint = {
  title: 'Mathematics I Pilot Paper',
  totalMarks: 100,
  durationMinutes: 150,
  sections: [
    { code: 'A', title: 'Section A', totalMarks: 80, itemCount: 4, answerRule: 'ALL' as const },
    { code: 'B', title: 'Section B', totalMarks: 20, itemCount: 2, answerRule: 'ONE' as const },
  ],
};

const curriculum = {
  subject: { id: 'subject-1', name: 'Mathematics', code: 'MATH' },
  topics: [{ id: 'topic-1', name: 'Number', competencies: [{ id: 'competency-1', name: 'Use number operations' }] }],
  eocs: [],
  syllabusEntries: [{ code: 'M1', topic: 'Number', competency: 'Use number operations', standard: 'Accurate calculation', sourcePage: 1 }],
};

describe('ExaminationComposer', () => {
  it('composes the ECZ 80/20 structure with real subquestions and reconciled marking keys', () => {
    const result = new ExaminationComposer().compose(blueprint, curriculum);
    const questions = result.sections.flatMap((section: any) => section.questions);
    const candidateMarks = result.sections.reduce((sum: number, section: any) => {
      const expected = blueprint.sections.find(item => item.code === section.code);
      const sectionMarks = section.questions.reduce((inner: number, question: any) => inner + question.marks, 0);
      return sum + (expected?.answerRule === 'ONE' ? section.questions[0].marks : sectionMarks);
    }, 0);

    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].questions).toHaveLength(4);
    expect(result.sections[1].questions).toHaveLength(2);
    expect(result.sections[1].questions.every((question: any) => question.marks === 20)).toBe(true);
    expect(candidateMarks).toBe(100);
    expect(new Set(questions.map((question: any) => question.stem)).size).toBe(questions.length);
    expect(new Set(questions.map((question: any) => question.topic)).size).toBeGreaterThanOrEqual(5);
    expect(questions.every((question: any) => question.tasks.length >= 2)).toBe(true);
    expect(questions.every((question: any) => question.tasks.every((task: any) => task.prompt !== question.stem))).toBe(true);
    expect(questions.every((question: any) => question.tasks.reduce((sum: number, task: any) => sum + task.marks, 0) === question.marks)).toBe(true);
    expect(questions.every((question: any) => question.markingKey.reduce((sum: number, key: any) => sum + key.markAllocation.reduce((inner: number, mark: any) => inner + mark.marks, 0), 0) === question.marks)).toBe(true);
    expect(result.sections[1].instructions).toContain('one');
  });

  it('attaches renderable marking-key diagrams for drawing tasks', () => {
    const result = new ExaminationComposer().compose(blueprint, curriculum);
    const questions = result.sections.flatMap((section: any) => section.questions);
    const keys = questions.flatMap((question: any) => question.markingKey);
    const diagramKeys = keys.filter((key: any) => key.diagram);

    expect(diagramKeys.length).toBeGreaterThanOrEqual(5);
    expect(diagramKeys.every((key: any) => String(key.diagramSvg || '').includes('<svg'))).toBe(true);
    expect(diagramKeys.some((key: any) => key.diagram.type === 'VENN_3_SET')).toBe(true);
    expect(diagramKeys.some((key: any) => key.diagram.type === 'HISTOGRAM')).toBe(true);
    expect(diagramKeys.some((key: any) => key.diagram.type === 'DISTANCE_TIME_GRAPH')).toBe(true);
    expect(diagramKeys.some((key: any) => key.diagram.type === 'TRIANGLE_CONSTRUCTION')).toBe(true);
    const linearProgramming = questions.find((question: any) => question.topic === 'Linear programming');
    expect(linearProgramming.markingKey[2].answer).toContain('K3 300');
  });

  it('maps requested topic-plan topics into the composed paper', () => {
    const topicPlan = [
      { topic: 'Number and financial mathematics', marks: 20 },
      { topic: 'Statistics and probability', marks: 20 },
      { topic: 'Geometry and trigonometry', marks: 20 },
      { topic: 'Linear programming', marks: 20 },
      { topic: 'Relations, functions and graphs', marks: 10 },
      { topic: 'Sets, variation and simultaneous equations', marks: 10 },
    ];
    const result = new ExaminationComposer().compose({ ...blueprint, topicPlan }, curriculum);
    const questions = result.sections.flatMap((section: any) => section.questions);

    expect(topicPlan.every(target => questions.some((question: any) =>
      question.topic.toLowerCase().includes(target.topic.toLowerCase())))).toBe(true);
    expect(new Set(questions.map((question: any) => question.stem)).size).toBe(questions.length);
  });

  it('covers a topic-plan topic that has no fixed mathematics template', () => {
    const topicPlan = [{ topic: 'Vectors', marks: 100 }];
    const result = new ExaminationComposer().compose({
      ...blueprint,
      sections: [{ code: 'A', title: 'Section A', totalMarks: 100, itemCount: 5, answerRule: 'ALL' as const }],
      topicPlan,
    }, curriculum);
    const questions = result.sections.flatMap((section: any) => section.questions);

    expect(questions.every((question: any) => question.topic.toLowerCase().includes('vectors'))).toBe(true);
    expect(new Set(questions.map((question: any) => question.stem)).size).toBe(questions.length);
    expect(questions.every((question: any) => question.tasks.length >= 2)).toBe(true);
  });

  it('keeps non-mathematics questions distinct and distributes available syllabus topics', () => {
    const result = new ExaminationComposer().compose({
      ...blueprint,
      sections: [{ code: 'A', title: 'Section A', totalMarks: 100, itemCount: 6, answerRule: 'ALL' as const }],
      topicPlan: [
        { topic: 'Cells', marks: 17 }, { topic: 'Nutrition', marks: 17 }, { topic: 'Ecology', marks: 17 },
        { topic: 'Genetics', marks: 17 }, { topic: 'Reproduction', marks: 16 }, { topic: 'Health', marks: 16 },
      ],
    }, {
      subject: { id: 'biology', name: 'Biology', code: '4012' },
      topics: ['Cells', 'Nutrition', 'Ecology', 'Genetics', 'Reproduction', 'Health'].map((name, index) => ({ id: `topic-${index}`, name, competencies: [{ id: `competency-${index}`, name: `Apply ${name}` }] })),
      eocs: [],
      syllabusEntries: [],
    });
    const questions = result.sections[0].questions;

    expect(new Set(questions.map((question: any) => question.stem)).size).toBe(6);
    expect(new Set(questions.map((question: any) => question.topic)).size).toBe(6);
  });

  it('uses full curriculum topic labels and grammatical marking keys for abbreviated biology plans', () => {
    const biologyCurriculum = {
      subject: { id: 'biology', name: 'Biology', code: '4021' },
      topics: [
        { id: 'topic-1', name: 'Concepts and Methods in Biology', competencies: [{ id: 'competency-1', name: 'Apply knowledge of concepts and methods in biology' }] },
        { id: 'topic-2', name: 'Principles of Cellular Life', competencies: [{ id: 'competency-2', name: 'Apply knowledge of principles of cellular life' }] },
      ],
      eocs: [],
      syllabusEntries: [
        { code: 'B1', topic: 'Concepts and Method in Biology', subtopic: 'Concepts and Methods in Biology', competency: 'Apply knowledge of concepts and methods in biology', standard: 'demonstrate the expected competence in concepts and methods in biology', sourcePage: 1 },
        { code: 'B2', topic: 'Principles of Cellular', subtopic: 'Principles of Cellular', competency: 'Apply knowledge of principles of cellular life', standard: 'demonstrate the expected competence in principles of cellular life', sourcePage: 2 },
      ],
    };
    const result = new ExaminationComposer().compose({
      ...blueprint,
      sections: [{ code: 'A', title: 'Section A', totalMarks: 100, itemCount: 4, answerRule: 'ALL' as const }],
      topicPlan: [
        { topic: 'Concepts and Method in Biology', marks: 50 },
        { topic: 'Principles of Cellular', marks: 50 },
      ],
    }, biologyCurriculum);
    const questions = result.sections[0].questions;
    const paperText = questions.map((question: any) => `${question.topic} ${question.stem}`).join(' ');
    const answers = questions.flatMap((question: any) => question.markingKey.map((key: any) => key.answer)).join('\n');

    expect(paperText).toContain('Concepts and Methods in Biology');
    expect(paperText).toContain('Principles of Cellular Life');
    expect(paperText).not.toMatch(/Concepts and Method(?!s)/);
    expect(paperText).not.toMatch(/Principles of Cellular(?! Life)/);
    expect(answers).not.toContain('Use the evidence to knowledge');
    expect(answers).not.toContain('benefit Explain');
    expect(answers).toContain('Expected answer: A microscope is used');
  });
});
