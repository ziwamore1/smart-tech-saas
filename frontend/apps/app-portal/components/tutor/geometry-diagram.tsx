'use client';

interface GeometryDiagramSpec {
  type: string;
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
    case 'biology':
      return <BioDiagram params={spec.params} />;
    default:
      return <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-500">Diagram: {spec.type}</div>;
  }
}

function BioDiagram({ params }: { params: Record<string, any> }) {
  const diagramType = params.diagram_type || 'cell';
  const w = 220;
  const h = 180;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 max-w-[260px] mx-auto">
      <h4 className="text-xs font-bold text-amber-600 uppercase mb-2">
        {params.label || `Biology: ${diagramType}`}
      </h4>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        {diagramType === 'cell' && (
          <>
            <circle cx={w/2} cy={h/2} r="60" fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
            <circle cx={w/2} cy={h/2} r="18" fill="#f59e0b" />
            <circle cx={w/2} cy={h/2} r="14" fill="#d97706" />
            <ellipse cx={w/2 - 20} cy={h/2 - 15} rx="12" ry="6" fill="#fbbf24" opacity="0.7" />
            <ellipse cx={w/2 + 18} cy={h/2 + 12} rx="8" ry="12" fill="#fbbf24" opacity="0.5" />
          </>
        )}
        {diagramType === 'dna' && (
          <>
            {Array.from({ length: 6 }).map((_, i) => {
              const y = 20 + i * 28;
              const offset = i % 2 === 0 ? -25 : 25;
              return (
                <g key={i}>
                  <circle cx={w/2 + offset} cy={y} r="2" fill="#059669" />
                  {i < 5 && <line x1={w/2 + offset} y1={y} x2={w/2 - offset} y2={y + 28} stroke={i % 2 === 0 ? '#ef4444' : '#3b82f6'} strokeWidth="1.5" />}
                </g>
              );
            })}
          </>
        )}
        {diagramType === 'photosynthesis' && (
          <>
            <text x={w/2} y="20" textAnchor="middle" fontSize="10" fill="#15803d">☀️ Sunlight</text>
            <ellipse cx={w/2} cy={h/2 + 5} rx="45" ry="35" fill="#86efac" stroke="#16a34a" strokeWidth="1.5" />
            <rect x={w/2 - 6} y={h/2 + 5} width="12" height="25" rx="2" fill="#166534" />
            <line x1={w/2} y1={h/2 + 30} x2={w/2} y2={h - 15} stroke="#166534" strokeWidth="2" />
            <text x={w/2} y={h/2} textAnchor="middle" fontSize="8" fill="#15803d" fontWeight="bold">Chloroplast</text>
          </>
        )}
      </svg>
      {params.descriptions && (
        <div className="mt-2 text-[10px] text-gray-500 space-y-1">
          {Object.entries(params.descriptions).slice(0, 3).map(([key, val]) => (
            <div key={key} className="flex gap-1">
              <span className="font-semibold text-gray-700">{key}:</span>
              <span>{val as string}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
