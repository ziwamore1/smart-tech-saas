'use client';

import { useState } from 'react';
import { MathRenderer } from './math-renderer';
import { ChevronDown, ChevronUp, Lightbulb, BookOpen, Repeat } from 'lucide-react';

interface Step {
  number: number;
  title: string;
  content: string;
  math?: Array<{ latex: string; display: 'block' | 'inline' }>;
}

interface InteractiveOptions {
  showNextStep?: boolean;
  revealFullSolution?: boolean;
  explainThisStep?: string | null;
  whyThisMethod?: string;
  alternativeMethod?: string;
}

interface StepSolutionProps {
  steps: Step[];
  interactive?: InteractiveOptions;
}

export function StepSolution({ steps, interactive }: StepSolutionProps) {
  const [visibleSteps, setVisibleSteps] = useState(1);
  const [showFull, setShowFull] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [showAlternative, setShowAlternative] = useState(false);

  if (!steps || steps.length === 0) return null;

  const displaySteps = showFull ? steps : steps.slice(0, visibleSteps);
  const hasMore = visibleSteps < steps.length;

  const handleNextStep = () => {
    setVisibleSteps(prev => Math.min(prev + 1, steps.length));
  };

  const handleRevealFull = () => {
    setShowFull(true);
    setVisibleSteps(steps.length);
  };

  return (
    <div className="space-y-3 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <BookOpen className="w-4 h-4 text-orange-500" />
        <span className="text-sm font-semibold text-gray-700">Step-by-Step Solution</span>
      </div>

      <div className="space-y-3">
        {displaySteps.map((step) => (
          <div
            key={step.number}
            className="border-l-4 border-orange-400 bg-orange-50/50 rounded-r-lg pl-4 pr-3 py-3"
          >
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                {step.number}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-orange-600 uppercase tracking-wide">
                  {step.title}
                </span>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{step.content}</p>
                {step.math && step.math.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {step.math.map((expr, i) => (
                      <div key={i} className="bg-white rounded border border-orange-100 px-3 py-2">
                        <MathRenderer expression={expr.latex} display={expr.display || 'block'} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!showFull && hasMore && interactive?.showNextStep !== false && (
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            onClick={handleNextStep}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
            Show Next Step
          </button>
          <button
            onClick={handleRevealFull}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ChevronsDown className="w-4 h-4" />
            Reveal Full Solution
          </button>
        </div>
      )}

      {interactive?.explainThisStep && (
        <button
          onClick={() => {}}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors"
        >
          <Lightbulb className="w-4 h-4" />
          Explain This Step
        </button>
      )}

      {interactive?.whyThisMethod && (
        <div>
          <button
            onClick={() => setShowWhy(!showWhy)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-50 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-100 transition-colors"
          >
            <Lightbulb className="w-4 h-4" />
            Why This Method?
            {showWhy ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showWhy && (
            <div className="mt-2 p-3 bg-purple-50/50 rounded-lg border border-purple-100">
              <p className="text-sm text-gray-700">{interactive.whyThisMethod}</p>
            </div>
          )}
        </div>
      )}

      {interactive?.alternativeMethod && (
        <div>
          <button
            onClick={() => setShowAlternative(!showAlternative)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors"
          >
            <Repeat className="w-4 h-4" />
            Alternative Method
            {showAlternative ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showAlternative && (
            <div className="mt-2 p-3 bg-green-50/50 rounded-lg border border-green-100">
              <p className="text-sm text-gray-700">{interactive.alternativeMethod}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChevronsDown({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}
