import { renderDiagramSvg } from './exam-diagram-renderer';

describe('exam diagram renderer', () => {
  it('renders every labelled region of a three-set Venn diagram', () => {
    const svg = renderDiagramSvg({
      type: 'VENN_3_SET',
      labels: ['M', 'G', 'S'],
      regionValues: { onlyA: 14, onlyB: 16, onlyC: 14, onlyAB: 8, onlyAC: 4, onlyBC: 6, abc: 4, outside: 14 },
    });

    expect(svg).toContain('<svg');
    expect(svg).toContain('>14<');
    expect(svg).toContain('>16<');
    expect(svg).toContain('>8<');
  });

  it('renders a Cartesian feasible region with boundary lines and labelled vertices', () => {
    const svg = renderDiagramSvg({
      type: 'CARTESIAN_GRAPH',
      xMin: 0,
      xMax: 140,
      yMin: 0,
      yMax: 140,
      shadedRegion: [{ x: 30, y: 40 }, { x: 40, y: 40 }, { x: 60, y: 60 }, { x: 30, y: 90 }],
      lines: [{ from: { x: 0, y: 120 }, to: { x: 120, y: 0 }, label: 'x + y = 120' }],
      points: [{ x: 30, y: 90, label: 'Optimal (30, 90)', highlight: true }],
    });

    expect(svg).toContain('<polygon');
    expect(svg).toContain('x + y = 120');
    expect(svg).toContain('Optimal (30, 90)');
  });

  it('renders a histogram with a frequency polygon', () => {
    const svg = renderDiagramSvg({
      type: 'HISTOGRAM',
      classes: [
        { label: '30–39', frequency: 1 },
        { label: '40–49', frequency: 9 },
        { label: '50–59', frequency: 12 },
        { label: '60–69', frequency: 11 },
        { label: '70–79', frequency: 11 },
        { label: '80–89', frequency: 6 },
      ],
      frequencyPolygon: true,
    });

    expect(svg).toContain('<rect');
    expect(svg).toContain('<polyline');
    expect(svg).toContain('50–59');
  });

  it('renders a scale triangle construction with its circumcircle', () => {
    const svg = renderDiagramSvg({
      type: 'TRIANGLE_CONSTRUCTION',
      sideAB: 9,
      sideAC: 7,
      angleA: 65,
      units: 'cm',
      scaleLabel: 'Scale: 1 cm : 10 m',
      showCircumcircle: true,
    });

    expect(svg).toContain('<polygon');
    expect(svg).toContain('<circle');
    expect(svg).toContain('65°');
    expect(svg).toContain('Scale: 1 cm : 10 m');
  });

  it('returns an empty string for an unknown diagram type', () => {
    expect(renderDiagramSvg({ type: 'UNKNOWN' } as any)).toBe('');
  });
});
