'use client';

interface GeometryDiagramSpec {
  type: 'triangle' | 'circle' | 'angle' | 'polygon' | 'coordinate' | 'construction';
  params: Record<string, any>;
}

export function GeometryDiagram({ spec }: { spec: GeometryDiagramSpec }) {
  if (!spec || !spec.type) return null;

  switch (spec.type) {
    case 'triangle':
      return <TriangleDiagram params={spec.params} />;
    case 'circle':
      return <CircleDiagram params={spec.params} />;
    case 'angle':
      return <AngleDiagram params={spec.params} />;
    case 'coordinate':
      return <CoordinateDiagram params={spec.params} />;
    case 'polygon':
      return <PolygonDiagram params={spec.params} />;
    default:
      return <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-500">Diagram: {spec.type}</div>;
  }
}

function TriangleDiagram({ params }: { params: Record<string, any> }) {
  const { sides, angles, labels, rightAngle } = params;
  const w = 200, h = 160;
  const p1: [number, number] = [10, h - 10];
  const p2: [number, number] = [w - 10, h - 10];
  const p3: [number, number] = [w / 2, 10];
  if (rightAngle) {
    const corner = rightAngle === 'bottom-left' ? [10, h - 10] : rightAngle === 'bottom-right' ? [w - 10, h - 10] : [w / 2, 10];
    const size = 16;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[220px] mx-auto">
        <polygon points={`${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`} fill="none" stroke="#f97316" strokeWidth="2" />
        <polyline points={`${corner[0] + size},${corner[1]} ${corner[0] + size},${corner[1] - size} ${corner[0]},${corner[1] - size}`} fill="none" stroke="#6b7280" strokeWidth="1.5" />
        {labels && labels.map((l: any, i: number) => (
          <text key={i} x={l.x} y={l.y} textAnchor="middle" fontSize="12" fill="#374151">{l.text}</text>
        ))}
      </svg>
    );
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[220px] mx-auto">
      <polygon points={`${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`} fill="none" stroke="#f97316" strokeWidth="2" />
      {labels && labels.map((l: any, i: number) => (
        <text key={i} x={l.x} y={l.y} textAnchor="middle" fontSize="12" fill="#374151">{l.text}</text>
      ))}
      {sides && sides.map((s: any, i: number) => (
        <text key={`s${i}`} x={s.x} y={s.y} textAnchor="middle" fontSize="11" fill="#6b7280">{s.label}</text>
      ))}
    </svg>
  );
}

function CircleDiagram({ params }: { params: Record<string, any> }) {
  const { radius, center, labels, showRadius } = params;
  const cx = 110, cy = 110, r = Math.min(radius || 80, 100);
  return (
    <svg viewBox="0 0 220 220" className="w-full max-w-[220px] mx-auto">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f97316" strokeWidth="2" />
      <circle cx={cx} cy={cy} r="2" fill="#f97316" />
      {showRadius && <line x1={cx} y1={cy} x2={cx + r} y2={cy} stroke="#6b7280" strokeWidth="1" strokeDasharray="4 2" />}
      {labels && labels.map((l: any, i: number) => (
        <text key={i} x={l.x} y={l.y} textAnchor="middle" fontSize="12" fill="#374151">{l.text}</text>
      ))}
      {showRadius && <text x={cx + r / 2} y={cy - 5} textAnchor="middle" fontSize="11" fill="#6b7280">r</text>}
    </svg>
  );
}

function AngleDiagram({ params }: { params: Record<string, any> }) {
  const { degrees, labels } = params;
  const w = 200, h = 160;
  const endX = 10 + Math.cos((degrees || 45) * Math.PI / 180) * 120;
  const endY = h - 10 - Math.sin((degrees || 45) * Math.PI / 180) * 120;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[220px] mx-auto">
      <line x1="10" y1={h - 10} x2={w - 10} y2={h - 10} stroke="#f97316" strokeWidth="2" />
      <line x1="10" y1={h - 10} x2={endX} y2={endY} stroke="#f97316" strokeWidth="2" />
      <path d={`M${30} ${h - 10} A${20} ${20} 0 0 0 ${10 + 20 * Math.cos((degrees || 45) * Math.PI / 180)} ${h - 10 - 20 * Math.sin((degrees || 45) * Math.PI / 180)}`} fill="none" stroke="#6b7280" strokeWidth="1" />
      {degrees && <text x={35} y={h - 30} fontSize="12" fill="#6b7280">{degrees}°</text>}
      {labels && labels.map((l: any, i: number) => (
        <text key={i} x={l.x} y={l.y} textAnchor="middle" fontSize="12" fill="#374151">{l.text}</text>
      ))}
    </svg>
  );
}

function PolygonDiagram({ params }: { params: Record<string, any> }) {
  const { vertices, labels } = params;
  if (!vertices || vertices.length < 3) return null;
  const pointsStr = vertices.map((v: [number, number]) => v.join(',')).join(' ');
  return (
    <svg viewBox="0 0 220 180" className="w-full max-w-[220px] mx-auto">
      <polygon points={pointsStr} fill="rgba(249, 115, 22, 0.1)" stroke="#f97316" strokeWidth="2" />
      {labels && labels.map((l: any, i: number) => (
        <text key={i} x={l.x} y={l.y} textAnchor="middle" fontSize="12" fill="#374151">{l.text}</text>
      ))}
    </svg>
  );
}

function CoordinateDiagram({ params }: { params: Record<string, any> }) {
  const { points, lines, labels } = params;
  return (
    <svg viewBox="0 0 220 220" className="w-full max-w-[220px] mx-auto">
      <line x1="10" y1="110" x2="210" y2="110" stroke="#9ca3af" strokeWidth="1" />
      <line x1="110" y1="10" x2="110" y2="210" stroke="#9ca3af" strokeWidth="1" />
      {points && points.map((p: any, i: number) => {
        const px = 110 + (p.x || 0) * 20;
        const py = 110 - (p.y || 0) * 20;
        return (
          <g key={i}>
            <circle cx={px} cy={py} r="3" fill="#f97316" />
            {p.label && <text x={px + 8} y={py - 8} fontSize="11" fill="#374151">{p.label}</text>}
          </g>
        );
      })}
      {labels && labels.map((l: any, i: number) => (
        <text key={i} x={l.x} y={l.y} textAnchor="middle" fontSize="12" fill="#374151">{l.text}</text>
      ))}
    </svg>
  );
}
