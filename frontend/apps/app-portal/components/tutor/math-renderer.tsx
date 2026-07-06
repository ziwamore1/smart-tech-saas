'use client';

import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface MathExpression {
  latex: string;
  display?: 'block' | 'inline';
}

interface MathRendererProps {
  expression: string;
  display?: 'block' | 'inline';
  style?: React.CSSProperties;
}

export function MathRenderer({ expression, display = 'inline', style }: MathRendererProps) {
  try {
    if (!expression || expression.trim() === '') return null;
    return display === 'block' ? (
      <div className="math-block" style={{ overflowX: 'auto', padding: '12px 0', textAlign: 'center', ...style }}>
        <BlockMath math={expression} />
      </div>
    ) : (
      <span className="math-inline" style={{ overflowX: 'auto', ...style }}>
        <InlineMath math={expression} />
      </span>
    );
  } catch {
    return <span className="text-red-500 text-sm">Invalid expression</span>;
  }
}

export function extractMathFromText(text: string): { segments: { text: string; isMath: boolean; display?: 'block' | 'inline' }[] } {
  const segments: { text: string; isMath: boolean; display?: 'block' | 'inline' }[] = [];
  const regex = /(\$\$[^$]*\$\$|\$[^$]*\$|\\\([^)]*\\\)|\\\[[^\]]*\\\])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), isMath: false });
    const inner = match[0];
    let latex: string;
    let isBlock: boolean;
    if (inner.startsWith('$$')) {
      latex = inner.slice(2, -2);
      isBlock = true;
    } else if (inner.startsWith('\\[')) {
      latex = inner.slice(2, -2);
      isBlock = true;
    } else if (inner.startsWith('\\(')) {
      latex = inner.slice(2, -2);
      isBlock = false;
    } else {
      latex = inner.slice(1, -1);
      isBlock = false;
    }
    segments.push({ text: latex, isMath: true, display: isBlock ? 'block' : 'inline' });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), isMath: false });
  return { segments };
}

export function RichMathText({ text, className }: { text: string; className?: string }) {
  const { segments } = extractMathFromText(text);
  if (!segments.length) return <span className={className}>{text}</span>;
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.isMath ? (
          <MathRenderer key={i} expression={seg.text} display={seg.display || 'inline'} />
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  );
}

export function MathBlock({ expressions }: { expressions: MathExpression[] }) {
  if (!expressions || expressions.length === 0) return null;
  return (
    <div className="space-y-2">
      {expressions.map((expr, i) => (
        <MathRenderer key={i} expression={expr.latex} display={expr.display || 'block'} />
      ))}
    </div>
  );
}
