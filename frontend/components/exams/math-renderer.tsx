'use client';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface MathRendererProps {
  expression: string;
  display?: 'inline' | 'block';
  style?: React.CSSProperties;
}

export function MathRenderer({ expression, display = 'inline', style }: MathRendererProps) {
  try {
    return display === 'block' ? (
      <div style={{ overflowX: 'auto', padding: '8px 0', ...style }}>
        <BlockMath math={expression} />
      </div>
    ) : (
      <span style={{ overflowX: 'auto', ...style }}>
        <InlineMath math={expression} />
      </span>
    );
  } catch {
    return <span style={{ color: '#ef4444', fontSize: '13px' }}>Invalid expression</span>;
  }
}

export function extractMathFromText(text: string): { segments: { text: string; isMath: boolean }[] } {
  const segments: { text: string; isMath: boolean }[] = [];
  const regex = /(\$\$[^$]*\$\$|\$[^$]*\$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), isMath: false });
    const inner = match[0];
    const isBlock = inner.startsWith('$$');
    segments.push({ text: inner.slice(isBlock ? 2 : 1, isBlock ? -2 : -1), isMath: true, ...(isBlock ? { display: 'block' as const } : {}) });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), isMath: false });
  return { segments };
}

export function RichMathText({ text }: { text: string }) {
  const { segments } = extractMathFromText(text);
  return (
    <span>
      {segments.map((seg, i) =>
        seg.isMath ? <MathRenderer key={i} expression={seg.text} display={(seg as any).display} />
          : <span key={i}>{seg.text}</span>
      )}
    </span>
  );
}
