import { StampRendererService } from './stamp-renderer.service';
import { StampTemplateConfig } from './stamp-engine.types';

const baseConfig = (): StampTemplateConfig => ({
  canvas: { width: 600, height: 600, background: 'transparent' },
  shape: {
    type: 'circle',
    outerRadius: 280,
    borderWidth: 8,
    borderColor: '#123456',
    borderCount: 2,
    innerRings: [{ radius: 240, width: 2, color: '#123456', dashed: true }],
  },
  layers: [
    {
      id: 'topArc',
      type: 'curved-text',
      x: 300,
      y: 120,
      content: 'INSTITUTION NAME',
      fontSize: 42,
      letterSpacing: 4,
      curve: { centerX: 300, centerY: 300, radius: 220, startAngle: -150, endAngle: -30, orientation: 'outward' },
    },
    { id: 'centerText', type: 'text', x: 300, y: 280, content: 'OFFICIAL DOCUMENT', fontSize: 28, color: '#123456' },
    { id: 'dateLayer', type: 'date', x: 300, y: 380, showTime: true, label: 'DIGITALLY STAMPED' },
    { id: 'serialLayer', type: 'serial', x: 300, y: 430, label: 'SERIAL NO' },
    {
      id: 'logo',
      type: 'image',
      x: 300,
      y: 210,
      width: 120,
      height: 120,
      assetId: 'asset-1',
    },
    { id: 'marker', type: 'verification-marker', x: 300, y: 500 },
    { id: 'hidden', type: 'text', x: 0, y: 0, content: 'SHOULD NOT APPEAR', visible: false },
  ],
  effects: { inkOpacity: 0.9, texture: 'ink', noiseAmount: 0.15 },
});

describe('StampRendererService', () => {
  let svc: StampRendererService;

  beforeEach(() => {
    svc = new StampRendererService();
  });

  it('renders well-formed SVG with all visible layers', () => {
    const svg = svc.render(baseConfig(), {
      serialNumber: 'STS-2026-000001',
      stampDate: '23 AUG 2026',
      stampTime: '13:42:17',
      timezoneLabel: 'CAT',
      assets: { 'asset-1': 'https://res.cloudinary.com/test/logo.png' },
    });
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('INSTITUTION NAME');
    expect(svg).toContain('OFFICIAL DOCUMENT');
    expect(svg).toContain('23 AUG 2026');
    expect(svg).toContain('13:42:17');
    expect(svg).toContain('STS-2026-000001');
    expect(svg).not.toContain('SHOULD NOT APPEAR');
    // balanced tags sanity
    expect((svg.match(/<text/g) || []).length).toBe((svg.match(/<\/text>/g) || []).length);
  });

  it('escapes XML-unsafe characters in text content', () => {
    const cfg = baseConfig();
    (cfg.layers[1] as any).content = 'A & B <C> "D"';
    const svg = svc.render(cfg, {});
    expect(svg).toContain('A &amp; B &lt;C&gt; &quot;D&quot;');
    expect(svg).not.toContain('A & B <C>');
  });

  it('omits image layers whose assets are not provided (tenant-scoped)', () => {
    const svg = svc.render(baseConfig(), { assets: {} });
    expect(svg).not.toContain('<image');
  });

  it('renders date/serial placeholders as empty when context missing (no client values)', () => {
    const svg = svc.render(baseConfig(), {});
    expect(svg).not.toContain('undefined');
    expect(svg).not.toContain('null');
  });

  it('honours layer visibility and rotation transforms', () => {
    const cfg = baseConfig();
    (cfg.layers[1] as any).rotation = 45;
    (cfg.layers[1] as any).opacity = 0.5;
    const svg = svc.render(cfg, {});
    expect(svg).toMatch(/transform="rotate\(45 [^"]+\)"/);
    expect(svg).toContain('opacity="0.50"');
  });

  it('renders rectangle and oval shapes with concentric borders', () => {
    for (const type of ['rectangle', 'square', 'oval'] as const) {
      const cfg = baseConfig();
      cfg.shape.type = type;
      cfg.shape.width = 560;
      cfg.shape.height = 360;
      const svg = svc.render(cfg, {});
      expect(type === 'oval' ? svg : svg).toBeTruthy();
      expect(svg).toContain(type === 'oval' ? '<ellipse' : '<rect');
    }
  });
});
