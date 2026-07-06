'use client';

import { useState, useMemo } from 'react';
import { MathRenderer, RichMathText, MathBlock } from './math-renderer';
import { StepSolution } from './step-solution';
import { MathGraph } from './math-graph';
import { GeometryDiagram } from './geometry-diagram';
import { AlertTriangle, Lightbulb, Target, ChevronDown, ChevronUp } from 'lucide-react';

interface MathExpression {
  latex: string;
  display: 'block' | 'inline';
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
  showNextStep?: boolean;
  revealFullSolution?: boolean;
  explainThisStep?: string | null;
  whyThisMethod?: string;
  alternativeMethod?: string;
}

export interface StructuredTutorResponse {
  type: 'math_solution' | 'explanation' | 'practice' | 'general';
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

interface TutorResponseProps {
  content: string;
  structured?: StructuredTutorResponse;
}

export function TutorResponse({ content, structured }: TutorResponseProps) {
  const [showMistakes, setShowMistakes] = useState(false);
  const [showPractice, setShowPractice] = useState(false);

  const parsed = useMemo<StructuredTutorResponse | null>(() => {
    if (structured) return structured;
    try {
      const p = JSON.parse(content);
      if (p && typeof p === 'object' && p.type) return p as StructuredTutorResponse;
    } catch {}
    return null;
  }, [content, structured]);

  if (!parsed) {
    return <RichMathText text={content} className="text-sm whitespace-pre-wrap" />;
  }

  const {
    explanation,
    rendered_math,
    steps,
    graphs,
    tables,
    diagrams,
    answer,
    practice_question,
    common_mistakes,
    interactive,
  } = parsed;

  return (
    <div className="space-y-4 text-sm">
      {/* Explanation */}
      {explanation && (
        <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
          {rendered_math && rendered_math.length > 0 ? (
            <MathBlock expressions={rendered_math} />
          ) : (
            <RichMathText text={explanation} />
          )}
        </div>
      )}

      {/* Rendered math at top level */}
      {rendered_math && rendered_math.length > 0 && !explanation && (
        <MathBlock expressions={rendered_math} />
      )}

      {/* Step-by-step solution */}
      {steps && steps.length > 0 && (
        <StepSolution steps={steps} interactive={interactive} />
      )}

      {/* Final Answer */}
      {answer && (answer.latex || answer.text) && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-green-700">Final Answer</span>
          </div>
          {answer.latex && (
            <MathRenderer expression={answer.latex} display="block" />
          )}
          {answer.text && !answer.latex && (
            <p className="text-sm text-green-800 font-medium">{answer.text}</p>
          )}
        </div>
      )}

      {/* Graphs */}
      {graphs && graphs.length > 0 && (
        <div className="space-y-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Graph</span>
          {graphs.map((graph, i) => (
            <MathGraph key={i} spec={graph as any} />
          ))}
        </div>
      )}

      {/* Diagrams */}
      {diagrams && diagrams.length > 0 && (
        <div className="space-y-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Diagram</span>
          {diagrams.map((diagram, i) => (
            <GeometryDiagram key={i} spec={diagram as any} />
          ))}
        </div>
      )}

      {/* Tables */}
      {tables && tables.length > 0 && (
        <div className="space-y-3">
          {tables.map((table, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {table.title && (
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600">
                  {table.title}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      {table.headers.map((header, hi) => (
                        <th key={hi} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {table.rows.map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-2 text-sm text-gray-700 whitespace-nowrap">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Common Mistakes */}
      {common_mistakes && common_mistakes.length > 0 && (
        <div>
          <button
            onClick={() => setShowMistakes(!showMistakes)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Common Mistakes ({common_mistakes.length})
            {showMistakes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showMistakes && (
            <div className="mt-2 space-y-1.5">
              {common_mistakes.map((mistake, i) => (
                <div key={i} className="flex items-start gap-2 p-2 bg-red-50/50 rounded border border-red-100">
                  <span className="text-red-400 mt-0.5">!</span>
                  <p className="text-xs text-gray-700">{mistake}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Practice Question */}
      {practice_question && (
        <div>
          <button
            onClick={() => setShowPractice(!showPractice)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Practice Question
            {practice_question.difficulty && (
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                practice_question.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                practice_question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {practice_question.difficulty}
              </span>
            )}
            {showPractice ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {showPractice && (
            <div className="mt-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <p className="text-sm text-gray-700">{practice_question.question}</p>
              {practice_question.math && practice_question.math.length > 0 && (
                <MathBlock expressions={practice_question.math} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
