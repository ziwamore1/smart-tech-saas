import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MathJax from 'react-native-mathjax-svg';
import Svg, { Polygon, Circle, Line, Path, G, Rect, Ellipse, Text as SvgText, Defs, LinearGradient, Stop, Polyline as SvgPolyline } from 'react-native-svg';
import { colors, spacing, borderRadius } from '../../theme';
import { MobileMathGraph } from './MobileMathGraph';
import { MobileInteractiveContainer, DraggablePoint, AnimatedLabel } from './MobileInteractiveContainer';
import { MobileTimeline } from './MobileTimeline';
import { MobileMapView } from './MobileMapView';
import { MobilePortraitCard } from './MobilePortraitCard';
import { MobileFlowChart } from './MobileFlowChart';
import { MobileComparisonTable } from './MobileComparisonTable';
import { MobileMindMap } from './MobileMindMap';

interface MathExpression {
  latex: string;
  display?: 'block' | 'inline';
}

interface Step {
  number: number;
  title: string;
  content: string;
  math?: MathExpression[];
}

interface GraphSpec {
  type: string;
  function: string;
  xLabel?: string;
  yLabel?: string;
  showIntercepts?: boolean;
  showTurningPoint?: boolean;
  showAsymptotes?: boolean;
  domain?: [number, number];
  shadedRegion?: { start: number; end: number; color: string };
}

interface TableData {
  title: string;
  headers: string[];
  rows: string[][];
}

interface DiagramSpec {
  type: string;
  params: Record<string, any>;
}

interface AnswerData {
  latex?: string;
  text?: string;
}

interface PracticeQuestion {
  question: string;
  math?: MathExpression[];
  difficulty?: string;
}

interface InteractiveOptions {
  whyThisMethod?: string;
  alternativeMethod?: string;
}

export interface StructuredTutorResponse {
  type: string;
  explanation?: string;
  rendered_math?: MathExpression[];
  steps?: Step[];
  graphs?: GraphSpec[];
  tables?: TableData[];
  diagrams?: DiagramSpec[];
  answer?: AnswerData;
  practice_question?: PracticeQuestion;
  common_mistakes?: string[];
  interactive?: InteractiveOptions;
}

export function MobileMathRenderer({ latex, display = 'inline' }: { latex: string; display?: 'block' | 'inline' }) {
  if (!latex || latex.trim() === '') return null;
  // Block math renders centered with padding
  return (
    <View style={display === 'block' ? styles.mathBlock : styles.mathInline}>
      <MathJax color={colors.text} fontSize={display === 'block' ? 18 : 15}>
        {display === 'block' ? `\\[${latex}\\]` : `\\(${latex}\\)`}
      </MathJax>
    </View>
  );
}

export function MobileMathBlock({ expressions }: { expressions: MathExpression[] }) {
  if (!expressions || expressions.length === 0) return null;
  return (
    <View style={styles.mathBlockContainer}>
      {expressions.map((expr, i) => (
        <MobileMathRenderer key={i} latex={expr.latex} display={expr.display || 'block'} />
      ))}
    </View>
  );
}

function extractMathFromText(text: string): { segments: { text: string; isMath: boolean; display?: 'block' | 'inline' }[] } {
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
  return segments;
}

function RichMathText({ text, style }: { text: string; style?: any }) {
  const segments = useMemo(() => extractMathFromText(text), [text]);
  const hasMath = useMemo(() => segments.some(s => s.isMath), [segments]);
  if (!hasMath) return <Text style={style}>{text}</Text>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' }}>
      {segments.map((seg, i) =>
        seg.isMath ? (
          <View key={i} style={seg.display === 'block' ? { width: '100%', alignItems: 'center', marginVertical: 4 } : { marginHorizontal: 1, alignSelf: 'center' }}>
            <MathJax color={colors.text} fontSize={seg.display === 'block' ? 18 : 15}>
              {seg.display === 'block' ? `\\[${seg.text}\\]` : `\\(${seg.text}\\)`}
            </MathJax>
          </View>
        ) : (
          <Text key={i} style={[style, seg.display === 'block' ? { width: '100%' } : {}]}>{seg.text}</Text>
        )
      )}
    </View>
  );
}

function MobileStepSolution({ steps, interactive }: { steps: Step[]; interactive?: InteractiveOptions }) {
  const [visibleCount, setVisibleCount] = useState(1);
  const [showFull, setShowFull] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [showAlt, setShowAlt] = useState(false);
  const [activeHint, setActiveHint] = useState<number | null>(null);
  const [checkResponses, setCheckResponses] = useState<Record<number, string>>({});
  const [showTryIt, setShowTryIt] = useState(false);

  const displaySteps = showFull ? steps : steps.slice(0, visibleCount);
  const hasMore = visibleCount < steps.length;

  const handleCheckIn = useCallback((stepNum: number, response: string) => {
    setCheckResponses(prev => ({ ...prev, [stepNum]: response }));
  }, []);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Step-by-Step Solution</Text>
      </View>
      <View style={styles.stepsContainer}>
        {displaySteps.map((step) => (
          <View key={step.number}>
            <View style={styles.stepCard}>
              <View style={styles.stepNumberContainer}>
                <Text style={styles.stepNumber}>{step.number}</Text>
              </View>
              <View style={styles.stepContent}>
                <RichMathText text={step.title} style={styles.stepTitle} />
                <RichMathText text={step.content} style={styles.stepText} />
                {step.math && step.math.length > 0 && (
                  <View style={styles.stepMathContainer}>
                    {step.math.map((expr, i) => (
                      <View key={i} style={styles.stepMathBox}>
                        <MobileMathRenderer latex={expr.latex} display={expr.display || 'block'} />
                      </View>
                    ))}
                  </View>
                )}
                {step.number > 1 && !checkResponses[step.number] && (
                  <View style={styles.checkinContainer}>
                    <Text style={styles.checkinLabel}>Think about it:</Text>
                    <Text style={styles.checkinQuestion}>
                      Why do you think we take this approach instead of the previous step?
                    </Text>
                    <View style={styles.checkinOptions}>
                      {['Simplify the problem', 'Apply a known formula', 'Use a different property'].map((opt) => (
                        <TouchableOpacity
                          key={opt}
                          style={styles.checkinOption}
                          onPress={() => handleCheckIn(step.number, opt)}
                        >
                          <Text style={styles.checkinOptionText}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
                {checkResponses[step.number] && (
                  <View style={styles.checkinFeedback}>
                    <Text style={styles.checkinFeedbackText}>
                      Great! {checkResponses[step.number]} is a key insight here.
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.hintTrigger}
                  onPress={() => setActiveHint(activeHint === step.number ? null : step.number)}
                >
                  <Text style={styles.hintTriggerText}>
                    {activeHint === step.number ? 'Hide hint ▲' : 'Need a hint? ▼'}
                  </Text>
                </TouchableOpacity>
                {activeHint === step.number && (
                  <View style={styles.hintContent}>
                    <Text style={styles.hintText}>
                      Think about what operation or formula connects the known values to what you're solving for.
                    </Text>
                  </View>
                )}
              </View>
            </View>
            {!showFull && step.number < visibleCount && step.number < steps.length && (
              <View style={styles.nextPrompt}>
                <Text style={styles.nextPromptText}>
                  Before moving on, try to work out the next step yourself!
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
      {!showFull && hasMore && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setVisibleCount(prev => Math.min(prev + 1, steps.length));
            }}
          >
            <Text style={styles.primaryButtonText}>Show Next Step</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => { setShowFull(true); setVisibleCount(steps.length); }}
          >
            <Text style={styles.secondaryButtonText}>Reveal Full Solution</Text>
          </TouchableOpacity>
        </View>
      )}
      {!showTryIt && visibleCount >= 2 && (
        <TouchableOpacity
          style={styles.tryItButton}
          onPress={() => setShowTryIt(true)}
        >
          <Text style={styles.tryItButtonText}>Try It Yourself</Text>
        </TouchableOpacity>
      )}
      {showTryIt && (
        <View style={styles.tryItContainer}>
          <Text style={styles.tryItTitle}>✏ Your Turn</Text>
          <Text style={styles.tryItText}>
            Try solving a similar problem on your own. Change one of the numbers and work through
            the same steps. Check your answer by revealing the full solution.
          </Text>
          <TouchableOpacity
            style={styles.tryItDone}
            onPress={() => setShowTryIt(false)}
          >
            <Text style={styles.tryItDoneText}>Got it, continue</Text>
          </TouchableOpacity>
        </View>
      )}
      {interactive?.whyThisMethod && (
        <View style={styles.interactiveSection}>
          <TouchableOpacity style={styles.whyButton} onPress={() => setShowWhy(!showWhy)}>
            <Text style={styles.whyButtonText}>💡 Why This Method? {showWhy ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showWhy && (
            <View style={styles.whyContent}>
              <Text style={styles.whyText}>{interactive.whyThisMethod}</Text>
            </View>
          )}
        </View>
      )}
      {interactive?.alternativeMethod && (
        <View style={styles.interactiveSection}>
          <TouchableOpacity style={styles.altButton} onPress={() => setShowAlt(!showAlt)}>
            <Text style={styles.altButtonText}>🔄 Alternative Method {showAlt ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showAlt && (
            <View style={styles.altContent}>
              <Text style={styles.altText}>{interactive.alternativeMethod}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function MobileAnswerBlock({ answer }: { answer: AnswerData }) {
  if (!answer || (!answer.latex && !answer.text)) return null;
  return (
    <View style={[styles.section, styles.answerSection]}>
      <View style={styles.answerHeader}>
        <Text style={styles.answerTitle}>✓ Final Answer</Text>
      </View>
      {answer.latex && <MobileMathRenderer latex={answer.latex} display="block" />}
      {answer.text && !answer.latex && (
        <Text style={styles.answerText}>{answer.text}</Text>
      )}
    </View>
  );
}

function MobileCommonMistakes({ mistakes }: { mistakes: string[] }) {
  const [visible, setVisible] = useState(false);
  if (!mistakes || mistakes.length === 0) return null;
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.mistakeToggle} onPress={() => setVisible(!visible)}>
        <Text style={styles.mistakeToggleText}>⚠ Common Mistakes ({mistakes.length}) {visible ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {visible && (
        <View style={styles.mistakeContainer}>
          {mistakes.map((m, i) => (
            <View key={i} style={styles.mistakeItem}>
              <Text style={styles.mistakeBullet}>!</Text>
              <Text style={styles.mistakeText}>{m}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function MobilePracticeQuestion({ pq }: { pq: PracticeQuestion }) {
  const [visible, setVisible] = useState(false);
  if (!pq) return null;
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.practiceToggle} onPress={() => setVisible(!visible)}>
        <Text style={styles.practiceToggleText}>✏ Practice Question {visible ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {visible && (
        <View style={styles.practiceContainer}>
          <Text style={styles.practiceText}>{pq.question}</Text>
          {pq.math && pq.math.length > 0 && <MobileMathBlock expressions={pq.math} />}
        </View>
      )}
    </View>
  );
}

export function MobileTutorResponse({
  content,
  structured,
}: {
  content: string;
  structured?: StructuredTutorResponse | null;
}) {
  const parsed = useMemo<StructuredTutorResponse | null>(() => {
    if (structured) return structured;
    try {
      const p = JSON.parse(content);
      if (p && typeof p === 'object' && p.type) return p as StructuredTutorResponse;
    } catch {}
    return null;
  }, [content, structured]);

  if (!parsed) {
    return <Text style={styles.plainText}>{content}</Text>;
  }

  const { explanation, rendered_math, steps, graphs, tables, diagrams, answer, common_mistakes, practice_question, interactive } = parsed;

  return (
    <View style={styles.container}>
      {explanation && (
        <RichMathText text={explanation} style={styles.explanationText} />
      )}
      {rendered_math && rendered_math.length > 0 && (
        <MobileMathBlock expressions={rendered_math} />
      )}
      {steps && steps.length > 0 && (
        <MobileStepSolution steps={steps} interactive={interactive} />
      )}
      {graphs && graphs.length > 0 && (
        <View style={styles.graphSection}>
          <Text style={styles.sectionTitle}>Graph</Text>
          {graphs.map((graph, i) => (
            <MobileMathGraph key={i} spec={graph} />
          ))}
        </View>
      )}
      {tables && tables.length > 0 && (
        <View style={styles.tableSection}>
          {tables.map((table, i) => (
            <MobileTableRenderer key={i} table={table} />
          ))}
        </View>
      )}
      {diagrams && diagrams.length > 0 && (
        <View style={styles.diagramSection}>
          {diagrams.map((diagram, i) => {
            switch (diagram.type) {
              case 'biology':
                return <MobileBiologyDiagram key={i} spec={diagram} />;
              case 'timeline':
                return <MobileTimeline key={i} params={diagram.params} />;
              case 'map':
                return <MobileMapView key={i} params={diagram.params} />;
              case 'portrait':
                return <MobilePortraitCard key={i} params={diagram.params} />;
              case 'flowchart':
                return <MobileFlowChart key={i} params={diagram.params} />;
              case 'comparison':
                return <MobileComparisonTable key={i} params={diagram.params} />;
              case 'mindmap':
                return <MobileMindMap key={i} params={diagram.params} />;
              default:
                return <MobileGeometryDiagram key={i} spec={diagram} />;
            }
          })}
        </View>
      )}
      {answer && <MobileAnswerBlock answer={answer} />}
      {common_mistakes && <MobileCommonMistakes mistakes={common_mistakes} />}
      {practice_question && <MobilePracticeQuestion pq={practice_question} />}
    </View>
  );
}

function MobileTableRenderer({ table }: { table: TableData }) {
  if (!table || !table.headers || table.headers.length === 0) return null;
  return (
    <View style={styles.tableCard}>
      {table.title && (
        <View style={styles.tableTitleBar}>
          <Text style={styles.tableTitleText}>{table.title}</Text>
        </View>
      )}
      <View>
        <View style={styles.tableHeaderRow}>
          {table.headers.map((header, hi) => (
            <Text key={hi} style={[styles.tableCell, styles.tableHeaderCell]}>{header}</Text>
          ))}
        </View>
        {table.rows.map((row, ri) => (
          <View key={ri} style={[styles.tableRow, ri % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
            {row.map((cell, ci) => (
              <Text key={ci} style={styles.tableCell}>{cell}</Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function MobileGeometryDiagram({ spec }: { spec: DiagramSpec }) {
  if (!spec || !spec.type) return null;
  const p = spec.params || {};
  const w = 220;
  const h = 180;

  const [vertices, setVertices] = useState<Record<string, [number, number]>>({});

  const handleVertexDrag = useCallback((id: string, x: number, y: number) => {
    setVertices(prev => ({ ...prev, [id]: [x, y] }));
  }, []);

  const getVertex = useCallback((id: string, defaultPos: [number, number]): [number, number] => {
    return vertices[id] || defaultPos;
  }, [vertices]);

  switch (spec.type) {
    case 'triangle': {
      const p1 = getVertex('v1', [10, h - 10]);
      const p2 = getVertex('v2', [w - 10, h - 10]);
      const p3 = getVertex('v3', [w / 2, 10]);
      const pts = `${p1[0]},${p1[1]} ${p2[0]},${p2[1]} ${p3[0]},${p3[1]}`;
      return (
        <MobileInteractiveContainer width={w} height={h} label="Triangle">
          <View style={{ width: w, height: h }}>
            <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
              <Polygon points={pts} fill="rgba(249, 115, 22, 0.08)" stroke="#f97316" strokeWidth="2" />
              {p.rightAngle && (
                <SvgPolyline
                  points={`${p3[0] - 16},${h - 10} ${p3[0] - 16},${h - 26} ${p3[0]},${h - 26}`}
                  fill="none" stroke="#6b7280" strokeWidth="1.5"
                />
              )}
              {p.labels && p.labels.map((l: any, i: number) => (
                <SvgText key={i} x={l.x} y={l.y} textAnchor="middle" fontSize="12" fill="#374151">{l.text}</SvgText>
              ))}
              {p.sides && p.sides.map((s: any, i: number) => (
                <SvgText key={`s${i}`} x={s.x} y={s.y} textAnchor="middle" fontSize="11" fill="#6b7280">{s.label}</SvgText>
              ))}
            </Svg>
            <DraggablePoint cx={p1[0]} cy={p1[1]} onDragEnd={(x, y) => handleVertexDrag('v1', x, y)} />
            <DraggablePoint cx={p2[0]} cy={p2[1]} onDragEnd={(x, y) => handleVertexDrag('v2', x, y)} />
            <DraggablePoint cx={p3[0]} cy={p3[1]} onDragEnd={(x, y) => handleVertexDrag('v3', x, y)} />
          </View>
        </MobileInteractiveContainer>
      );
    }
    case 'circle': {
      const cx = 110, cy = 90, r = Math.min(p.radius || 70, 90);
      return (
        <MobileInteractiveContainer width={w} height={h} label="Circle">
          <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
            <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#f97316" strokeWidth="2" />
            <Circle cx={cx} cy={cy} r="3" fill="#f97316" />
            {p.showRadius && (
              <>
                <Line x1={cx} y1={cy} x2={cx + r} y2={cy} stroke="#6b7280" strokeWidth="1" strokeDasharray="4,2" />
                <SvgText x={cx + r / 2} y={cy - 6} textAnchor="middle" fontSize="11" fill="#6b7280">r</SvgText>
              </>
            )}
            {p.labels && p.labels.map((l: any, i: number) => (
              <SvgText key={i} x={l.x} y={l.y} textAnchor="middle" fontSize="12" fill="#374151">{l.text}</SvgText>
            ))}
          </Svg>
        </MobileInteractiveContainer>
      );
    }
    case 'coordinate': {
      return (
        <MobileInteractiveContainer width={w} height={h} label="Coordinate Plane">
          <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
            <Line x1="10" y1={h / 2} x2={w - 10} y2={h / 2} stroke="#9ca3af" strokeWidth="1" />
            <Line x1={w / 2} y1="10" x2={w / 2} y2={h - 10} stroke="#9ca3af" strokeWidth="1" />
            {p.points && p.points.map((pt: any, i: number) => {
              const px = w / 2 + (pt.x || 0) * 18;
              const py = h / 2 - (pt.y || 0) * 18;
              return (
                <G key={i}>
                  <Circle cx={px} cy={py} r="4" fill="#f97316" />
                  {pt.label && <SvgText x={px + 8} y={py - 8} fontSize="11" fill="#374151">{pt.label}</SvgText>}
                </G>
              );
            })}
            {p.labels && p.labels.map((l: any, i: number) => (
              <SvgText key={i} x={l.x} y={l.y} textAnchor="middle" fontSize="12" fill="#374151">{l.text}</SvgText>
            ))}
          </Svg>
        </MobileInteractiveContainer>
      );
    }
    case 'angle': {
      const deg = p.degrees || 45;
      const rad = deg * Math.PI / 180;
      const endX = 10 + Math.cos(rad) * 130;
      const endY = h - 10 - Math.sin(rad) * 130;
      const arcX = 10 + 25 * Math.cos(rad);
      const arcY = h - 10 - 25 * Math.sin(rad);
      return (
        <MobileInteractiveContainer width={w} height={h} label="Angle">
          <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
            <Line x1="10" y1={h - 10} x2={w - 10} y2={h - 10} stroke="#f97316" strokeWidth="2" />
            <Line x1="10" y1={h - 10} x2={endX} y2={endY} stroke="#f97316" strokeWidth="2" />
            <Path
              d={`M${35} ${h - 10} A25 25 0 0 0 ${arcX} ${arcY}`}
              fill="none" stroke="#6b7280" strokeWidth="1"
            />
            {deg && <SvgText x={38} y={h - 32} fontSize="12" fill="#6b7280">{deg}°</SvgText>}
            {p.labels && p.labels.map((l: any, i: number) => (
              <SvgText key={i} x={l.x} y={l.y} textAnchor="middle" fontSize="12" fill="#374151">{l.text}</SvgText>
            ))}
          </Svg>
        </MobileInteractiveContainer>
      );
    }
    case 'polygon': {
      const verts = p.vertices || [];
      if (verts.length < 3) return null;
      const pts = verts.map((v: [number, number]) => v.join(',')).join(' ');
      return (
        <MobileInteractiveContainer width={w} height={h} label="Polygon">
          <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
            <Polygon points={pts} fill="rgba(249, 115, 22, 0.1)" stroke="#f97316" strokeWidth="2" />
            {p.labels && p.labels.map((l: any, i: number) => (
              <SvgText key={i} x={l.x} y={l.y} textAnchor="middle" fontSize="12" fill="#374151">{l.text}</SvgText>
            ))}
          </Svg>
        </MobileInteractiveContainer>
      );
    }
    default:
      return (
        <View style={styles.diagramPlaceholder}>
          <Text style={styles.diagramPlaceholderText}>Diagram: {spec.type}</Text>
        </View>
      );
  }
}

function MobileBiologyDiagram({ spec }: { spec: DiagramSpec }) {
  if (!spec || !spec.type || spec.type !== 'biology') return null;
  const p = spec.params || {};
  const diagramType = p.diagram_type || 'cell';
  const w = 260;
  const h = 200;
  const cx = w / 2;
  const cy = h / 2;
  const [highlightedLabel, setHighlightedLabel] = useState<string | null>(null);

  const renderLabel = (label: string, x: number, y: number, delay: number) => (
    <AnimatedLabel key={label} delay={delay} onTap={() => setHighlightedLabel(highlightedLabel === label ? null : label)}>
      <View style={[
        styles.bioLabel,
        highlightedLabel === label && styles.bioLabelHighlighted,
      ]}>
        <Text style={[
          styles.bioLabelText,
          highlightedLabel === label && styles.bioLabelTextHighlighted,
        ]}>{label}</Text>
      </View>
    </AnimatedLabel>
  );

  const renderDescription = () => {
    if (!highlightedLabel) return null;
    const descriptions: Record<string, string> = p.descriptions || {};
    const desc = descriptions[highlightedLabel];
    if (!desc) return null;
    return (
      <View style={styles.bioDescription}>
        <Text style={styles.bioDescriptionText}>{desc}</Text>
      </View>
    );
  };

  switch (diagramType) {
    case 'cell': {
      const r = 70;
      return (
        <MobileInteractiveContainer width={w} height={h + 60} label="Cell Structure">
          <View style={{ width: w, height: h + 60, position: 'relative' }}>
            <View style={{ position: 'absolute', top: 0, left: 0, width: w, height: h }}>
              <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
                <Circle cx={cx} cy={cy} r={r} fill="#fef3c7" stroke="#d97706" strokeWidth="2" />
                <Circle cx={cx} cy={cy} r={r * 0.95} fill="none" stroke="#fbbf24" strokeWidth="0.5" strokeDasharray="4,3" />
                <Circle cx={cx} cy={cy} r={22} fill="#f59e0b" />
                <Circle cx={cx} cy={cy} r={18} fill="#d97706" />
                <Ellipse cx={cx - 25} cy={cy - 15} rx={15} ry={8} fill="#fbbf24" opacity="0.7" />
                <Ellipse cx={cx + 22} cy={cy + 10} rx={10} ry={14} fill="#fbbf24" opacity="0.5" />
                <Path d={`M${cx + 30} ${cy - 25} Q${cx + 45} ${cy - 35} ${cx + 40} ${cy - 20}`} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
                <Circle cx={cx + 40} cy={cy - 20} r="3" fill="#f59e0b" />
              </Svg>
            </View>
            {renderLabel('Nucleus', cx, cy + 35, 200)}
            {renderLabel('Mitochondria', cx + 35, cy - 38, 400)}
            {renderLabel('ER', cx - 38, cy + 25, 600)}
            {renderLabel('Golgi', cx + 45, cy + 30, 800)}
            {renderLabel('Cell Membrane', cx, cy + r + 10, 1000)}
          </View>
          {renderDescription()}
        </MobileInteractiveContainer>
      );
    }
    case 'dna': {
      const startY = 20;
      const endY = h - 20;
      const midX = cx;
      const amplitude = 30;
      const segments = 8;
      const dh = (endY - startY) / segments;
      return (
        <MobileInteractiveContainer width={w} height={h + 60} label="DNA Structure">
          <View style={{ width: w, height: h + 60, position: 'relative' }}>
            <View style={{ position: 'absolute', top: 0, left: 0, width: w, height: h }}>
              <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
                <Defs>
                  <LinearGradient id="dnaGrad" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#059669" />
                    <Stop offset="1" stopColor="#10b981" />
                  </LinearGradient>
                </Defs>
                {Array.from({ length: segments + 1 }).map((_, i) => {
                  const y = startY + i * dh;
                  const xOffset = i % 2 === 0 ? -amplitude : amplitude;
                  return (
                    <G key={i}>
                      <Circle cx={midX + xOffset} cy={y} r="3" fill="#059669" />
                    </G>
                  );
                })}
                <Path
                  d={Array.from({ length: segments + 1 }).map((_, i) => {
                    const y = startY + i * dh;
                    const xOffset = i % 2 === 0 ? -amplitude : amplitude;
                    return `${i === 0 ? 'M' : 'L'}${midX + xOffset} ${y}`;
                  }).join(' ')}
                  fill="none" stroke="#059669" strokeWidth="2"
                />
                <Path
                  d={Array.from({ length: segments + 1 }).map((_, i) => {
                    const y = startY + i * dh;
                    const xOffset = i % 2 === 0 ? amplitude : -amplitude;
                    return `${i === 0 ? 'M' : 'L'}${midX + xOffset} ${y}`;
                  }).join(' ')}
                  fill="none" stroke="#059669" strokeWidth="2"
                />
                {Array.from({ length: segments }).map((_, i) => {
                  const y1 = startY + i * dh;
                  const y2 = startY + (i + 1) * dh;
                  const x1 = i % 2 === 0 ? midX - amplitude : midX + amplitude;
                  const x2 = i % 2 === 0 ? midX + amplitude : midX - amplitude;
                  const my = (y1 + y2) / 2;
                  const color = i % 2 === 0 ? '#ef4444' : '#3b82f6';
                  return (
                    <G key={`pair${i}`}>
                      <Line x1={x1} y1={y1} x2={midX} y2={my} stroke={color} strokeWidth="1.5" />
                      <Line x1={midX} y1={my} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" />
                    </G>
                  );
                })}
              </Svg>
            </View>
            {renderLabel('Sugar-Phosphate\nBackbone', cx - amplitude - 30, 30, 200)}
            {renderLabel('Base Pairs', cx + 15, h / 2 - 10, 400)}
            {renderLabel('A-T / G-C', cx + amplitude + 15, h - 30, 600)}
          </View>
          {renderDescription()}
        </MobileInteractiveContainer>
      );
    }
    case 'photosynthesis': {
      return (
        <MobileInteractiveContainer width={w} height={h + 60} label="Photosynthesis">
          <View style={{ width: w, height: h + 60, position: 'relative' }}>
            <View style={{ position: 'absolute', top: 0, left: 0, width: w, height: h }}>
              <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
                <Ellipse cx={cx} cy={cy + 10} rx={55} ry={40} fill="#86efac" stroke="#16a34a" strokeWidth="1.5" />
                <Rect x={cx - 8} y={cy + 10} width="16" height="30" rx="3" fill="#166534" />
                <Line x1={cx} y1={cy + 40} x2={cx} y2={h - 15} stroke="#166534" strokeWidth="3" />
                <Line x1={cx} y1={h - 15} x2={cx - 20} y2={h - 5} stroke="#166534" strokeWidth="2" />
                <Line x1={cx} y1={h - 15} x2={cx + 20} y2={h - 5} stroke="#166534" strokeWidth="2" />
                <SvgText x={cx} y={cy - 5} textAnchor="middle" fontSize="9" fill="#15803d" fontWeight="700">Chloroplast</SvgText>
              </Svg>
            </View>
            {renderLabel('Sunlight ☀️', cx, 15, 200)}
            {renderLabel('CO₂', cx - 60, cy, 400)}
            {renderLabel('H₂O', cx + 60, cy + 20, 600)}
            {renderLabel('Glucose (C₆H₁₂O₆)', cx - 30, h + 5, 800)}
            {renderLabel('O₂', cx + 60, cy - 40, 1000)}
          </View>
          {renderDescription()}
        </MobileInteractiveContainer>
      );
    }
    case 'heart': {
      return (
        <MobileInteractiveContainer width={w} height={h + 60} label="Heart Anatomy">
          <View style={{ width: w, height: h + 60, position: 'relative' }}>
            <View style={{ position: 'absolute', top: 0, left: 0, width: w, height: h }}>
              <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
                <Path
                  d={`M${cx} ${cy + 20} C${cx - 40} ${cy - 30}, ${cx - 70} ${cy + 10}, ${cx} ${cy + 50} C${cx + 70} ${cy + 10}, ${cx + 40} ${cy - 30}, ${cx} ${cy + 20}Z`}
                  fill="#fca5a5" stroke="#ef4444" strokeWidth="2"
                />
                <Line x1={cx} y1={cy - 10} x2={cx} y2={cy + 40} stroke="#ef4444" strokeWidth="1" strokeDasharray="3,2" />
                <Path d={`M${cx - 20} ${cy - 5} Q${cx - 10} ${cy + 5} ${cx} ${cy - 5}`} fill="none" stroke="#b91c1c" strokeWidth="1" />
                <Path d={`M${cx + 20} ${cy + 15} Q${cx + 10} ${cy + 25} ${cx} ${cy + 15}`} fill="none" stroke="#b91c1c" strokeWidth="1" />
              </Svg>
            </View>
            {renderLabel('Right Atrium', cx - 40, cy - 25, 200)}
            {renderLabel('Left Atrium', cx + 40, cy - 25, 400)}
            {renderLabel('Right Ventricle', cx - 35, cy + 40, 600)}
            {renderLabel('Left Ventricle', cx + 35, cy + 40, 800)}
            {renderLabel('Septum', cx + 5, cy + 15, 1000)}
          </View>
          {renderDescription()}
        </MobileInteractiveContainer>
      );
    }
    case 'brain': {
      return (
        <MobileInteractiveContainer width={w} height={h + 60} label="Brain Regions">
          <View style={{ width: w, height: h + 60, position: 'relative' }}>
            <View style={{ position: 'absolute', top: 0, left: 0, width: w, height: h }}>
              <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
                <Ellipse cx={cx} cy={cy + 5} rx={50} ry={60} fill="#fde68a" stroke="#d97706" strokeWidth="2" />
                <Path
                  d={`M${cx} ${cy - 50} Q${cx - 15} ${cy - 30} ${cx - 5} ${cy - 10} Q${cx - 20} ${cy + 10} ${cx - 15} ${cy + 30}`}
                  fill="none" stroke="#f59e0b" strokeWidth="1"
                />
                <Path
                  d={`M${cx} ${cy - 50} Q${cx + 15} ${cy - 30} ${cx + 5} ${cy - 10} Q${cx + 20} ${cy + 10} ${cx + 15} ${cy + 30}`}
                  fill="none" stroke="#f59e0b" strokeWidth="1"
                />
                <Path
                  d={`M${cx - 20} ${cy + 30} Q${cx} ${cy + 50} ${cx + 20} ${cy + 30}`}
                  fill="none" stroke="#d97706" strokeWidth="1.5"
                />
                <Ellipse cx={cx} cy={cy + 35} rx={20} ry={10} fill="#f59e0b" opacity="0.4" />
              </Svg>
            </View>
            {renderLabel('Frontal Lobe', cx, cy - 40, 200)}
            {renderLabel('Parietal Lobe', cx + 40, cy - 10, 400)}
            {renderLabel('Occipital Lobe', cx + 5, cy + 40, 600)}
            {renderLabel('Temporal Lobe', cx - 42, cy + 10, 800)}
            {renderLabel('Cerebellum', cx, cy + 55, 1000)}
          </View>
          {renderDescription()}
        </MobileInteractiveContainer>
      );
    }
    case 'eye': {
      return (
        <MobileInteractiveContainer width={w} height={h + 60} label="Eye Anatomy">
          <View style={{ width: w, height: h + 60, position: 'relative' }}>
            <View style={{ position: 'absolute', top: 0, left: 0, width: w, height: h }}>
              <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
                <Ellipse cx={cx} cy={cy} rx={70} ry={50} fill="none" stroke="#64748b" strokeWidth="2" />
                <Circle cx={cx} cy={cy} r={22} fill="#e2e8f0" stroke="#475569" strokeWidth="1.5" />
                <Circle cx={cx} cy={cy} r={12} fill="#1e293b" />
                <Circle cx={cx} cy={cy} r="5" fill="#0f172a" />
                <Circle cx={cx + 3} cy={cy - 3} r="2" fill="#fff" opacity="0.7" />
                <Rect x={cx - 30} y={cy - 15} width="60" height="30" rx="5" fill="rgba(59,130,246,0.15)" />
              </Svg>
            </View>
            {renderLabel('Cornea', cx, cy - r - 12, 200)}
            {renderLabel('Iris', cx + 40, cy - 8, 400)}
            {renderLabel('Pupil', cx + 40, cy + 15, 600)}
            {renderLabel('Lens', cx - 42, cy, 800)}
            {renderLabel('Retina', cx, cy + r + 12, 1000)}
          </View>
          {renderDescription()}
        </MobileInteractiveContainer>
      );
    }
    default: {
      return (
        <View style={styles.diagramPlaceholder}>
          <Text style={styles.diagramPlaceholderText}>Biology diagram: {diagramType}</Text>
        </View>
      );
    }
  }
}

function Polyline({ points, fill, stroke, strokeWidth }: { points: string; fill?: string; stroke?: string; strokeWidth?: number }) {
  const parsedPoints = points.split(' ').map(p => p.split(',').map(Number));
  if (parsedPoints.length < 2) return null;
  const d = parsedPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  return <Path d={d} fill={fill || 'none'} stroke={stroke || '#000'} strokeWidth={strokeWidth || 1} />;
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  graphSection: { gap: spacing.sm, marginTop: spacing.sm },
  plainText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  explanationText: { fontSize: 15, color: colors.text, lineHeight: 22 },
  mathBlockContainer: { gap: spacing.xs },
  mathBlock: { backgroundColor: colors.white, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginVertical: spacing.xs },
  mathInline: { marginHorizontal: 2 },
  section: { marginTop: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.orange, textTransform: 'uppercase', letterSpacing: 0.5 },
  stepsContainer: { gap: spacing.sm },
  stepCard: { flexDirection: 'row', backgroundColor: colors.orangeLight, borderRadius: borderRadius.md, borderLeftWidth: 4, borderLeftColor: colors.orange, padding: spacing.md },
  stepNumberContainer: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.orange, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm, marginTop: 2 },
  stepNumber: { fontSize: 12, fontWeight: '700', color: colors.white },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 11, fontWeight: '700', color: colors.orange, textTransform: 'uppercase', letterSpacing: 0.5 },
  stepText: { fontSize: 14, color: colors.text, lineHeight: 20, marginTop: 4 },
  stepMathContainer: { gap: spacing.xs, marginTop: spacing.sm },
  stepMathBox: { backgroundColor: colors.white, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.orangeLight, padding: spacing.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  primaryButton: { flex: 1, backgroundColor: colors.orange, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  secondaryButton: { flex: 1, backgroundColor: colors.border, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center' },
  secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  interactiveSection: { marginTop: spacing.sm },
  whyButton: { backgroundColor: colors.purpleLight, padding: spacing.sm, borderRadius: borderRadius.md },
  whyButtonText: { color: colors.purple, fontSize: 13, fontWeight: '600' },
  whyContent: { backgroundColor: colors.purpleLight, padding: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.xs },
  whyText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  altButton: { backgroundColor: colors.tealLight, padding: spacing.sm, borderRadius: borderRadius.md },
  altButtonText: { color: colors.teal, fontSize: 13, fontWeight: '600' },
  altContent: { backgroundColor: colors.tealLight, padding: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.xs },
  altText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  answerSection: { backgroundColor: colors.successLight, borderWidth: 1, borderColor: colors.success, padding: spacing.md, borderRadius: borderRadius.md },
  answerHeader: { marginBottom: spacing.sm },
  answerTitle: { fontSize: 14, fontWeight: '700', color: colors.success },
  answerText: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  mistakeToggle: { backgroundColor: colors.errorLight, padding: spacing.sm, borderRadius: borderRadius.md },
  mistakeToggleText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  mistakeContainer: { gap: spacing.xs, marginTop: spacing.xs },
  mistakeItem: { flexDirection: 'row', backgroundColor: colors.errorLight, padding: spacing.sm, borderRadius: borderRadius.sm, gap: spacing.sm },
  mistakeBullet: { color: colors.error, fontWeight: '700' },
  mistakeText: { fontSize: 13, color: colors.text, flex: 1 },
  practiceToggle: { backgroundColor: colors.infoLight, padding: spacing.sm, borderRadius: borderRadius.md },
  practiceToggleText: { color: colors.info, fontSize: 13, fontWeight: '600' },
  practiceContainer: { backgroundColor: colors.infoLight, padding: spacing.md, borderRadius: borderRadius.md, marginTop: spacing.xs },
  practiceText: { fontSize: 14, color: colors.text, lineHeight: 20 },

  // Table styles
  tableSection: { marginTop: spacing.sm, gap: spacing.sm },
  tableCard: { backgroundColor: colors.white, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tableTitleBar: { padding: spacing.sm, backgroundColor: colors.orangeLight, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableTitleText: { fontSize: 12, fontWeight: '700', color: colors.orange },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#f9fafb', borderBottomWidth: 1, borderBottomColor: colors.border },
  tableHeaderCell: { fontWeight: '700', color: colors.text, fontSize: 12 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: colors.border },
  tableRowEven: { backgroundColor: colors.white },
  tableRowOdd: { backgroundColor: '#f9fafb' },
  tableCell: { flex: 1, padding: spacing.sm, fontSize: 13, color: colors.text },

  // Diagram styles
  diagramSection: { marginTop: spacing.sm, gap: spacing.sm, alignItems: 'center' },
  diagramContainer: { backgroundColor: colors.white, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, alignItems: 'center' },
  diagramPlaceholder: { backgroundColor: '#f9fafb', borderRadius: borderRadius.md, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  diagramPlaceholderText: { fontSize: 13, color: colors.textLight, fontStyle: 'italic' },

  // Biology diagram styles
  bioLabel: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#d1d5db', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  bioLabelHighlighted: { backgroundColor: '#f59e0b', borderColor: '#d97706' },
  bioLabelText: { fontSize: 10, fontWeight: '600', color: '#374151', textAlign: 'center' },
  bioLabelTextHighlighted: { color: '#fff' },
  bioDescription: { backgroundColor: '#fef3c7', padding: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#f59e0b', marginTop: 4, width: '100%' },
  bioDescriptionText: { fontSize: 12, color: '#92400e', lineHeight: 17 },

  // Guided discovery styles
  checkinContainer: { backgroundColor: '#f0f9ff', borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#93c5fd', padding: spacing.sm, marginTop: spacing.sm },
  checkinLabel: { fontSize: 11, fontWeight: '700', color: '#2563eb', marginBottom: 4 },
  checkinQuestion: { fontSize: 13, color: '#1e40af', marginBottom: spacing.sm, lineHeight: 18 },
  checkinOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  checkinOption: { backgroundColor: '#dbeafe', paddingHorizontal: 10, paddingVertical: 6, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: '#93c5fd' },
  checkinOptionText: { fontSize: 12, color: '#1e40af', fontWeight: '500' },
  checkinFeedback: { backgroundColor: '#ecfdf5', borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#6ee7b7', padding: spacing.sm, marginTop: spacing.sm },
  checkinFeedbackText: { fontSize: 12, color: '#065f46', fontWeight: '500' },
  hintTrigger: { marginTop: spacing.xs },
  hintTriggerText: { fontSize: 12, color: '#8b5cf6', fontWeight: '600', textDecorationLine: 'underline' },
  hintContent: { backgroundColor: '#f5f3ff', borderRadius: borderRadius.md, padding: spacing.sm, marginTop: spacing.xs, borderWidth: 1, borderColor: '#c4b5fd' },
  hintText: { fontSize: 13, color: '#5b21b6', lineHeight: 18 },
  nextPrompt: { marginVertical: spacing.xs, alignItems: 'center' },
  nextPromptText: { fontSize: 11, color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' },
  tryItButton: { backgroundColor: '#10b981', paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center', marginTop: spacing.sm },
  tryItButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tryItContainer: { backgroundColor: '#ecfdf5', borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#6ee7b7', padding: spacing.md, marginTop: spacing.sm },
  tryItTitle: { fontSize: 12, fontWeight: '700', color: '#065f46', marginBottom: spacing.xs },
  tryItText: { fontSize: 13, color: '#374151', lineHeight: 18 },
  tryItDone: { backgroundColor: '#10b981', paddingVertical: 8, borderRadius: borderRadius.sm, alignItems: 'center', marginTop: spacing.sm },
  tryItDoneText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
