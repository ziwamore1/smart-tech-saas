import { ExamDiagramService } from './exam-diagram.service';

describe('ExamDiagramService', () => {
  const service = new ExamDiagramService({} as any);

  it('renders a deterministic Cartesian graph from editable coordinates', () => {
    const svg = (service as any).render('CARTESIAN_GRAPH', { xMin: 0, xMax: 10, yMin: 0, yMax: 10, points: [{ x: 2, y: 4, label: 'P' }] });
    expect(svg).toContain('<svg');
    expect(svg).toContain('P');
    expect(svg).toContain('circle');
  });

  it('renders labelled Venn and triangle diagrams without AI assets', () => {
    expect((service as any).render('VENN_3_SET', { labels: ['T', 'C', 'P'], regionValues: { onlyA: 8 } })).toContain('T');
    expect((service as any).render('TRIANGLE', { points: { A: [10, 200], B: [300, 200], C: [150, 20] } })).toContain('polygon');
  });
});
