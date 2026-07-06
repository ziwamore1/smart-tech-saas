import { BaseSubjectEngine, EngineResponse } from './base-engine';

interface StructuredMathResult {
  type: 'math_solution' | 'explanation' | 'practice' | 'general';
  explanation: string;
  rendered_math?: Array<{ latex: string; display: 'block' | 'inline' }>;
  steps?: Array<{
    number: number;
    title: string;
    content: string;
    math?: Array<{ latex: string; display: 'block' | 'inline' }>;
  }>;
  graphs?: Array<{
    type: string;
    function: string;
    xLabel?: string;
    yLabel?: string;
    showIntercepts?: boolean;
    showTurningPoint?: boolean;
    showAsymptotes?: boolean;
    domain?: number[];
    shadedRegion?: { start: number; end: number; color: string };
  }>;
  tables?: Array<{
    title: string;
    headers: string[];
    rows: string[][];
  }>;
  diagrams?: Array<{
    type: string;
    params: Record<string, any>;
  }>;
  answer?: {
    latex: string;
    text: string;
  };
  practice_question?: {
    question: string;
    math?: Array<{ latex: string; display: 'block' | 'inline' }>;
    difficulty: string;
  };
  common_mistakes?: string[];
  interactive?: {
    showNextStep?: boolean;
    revealFullSolution?: boolean;
    explainThisStep?: string;
    whyThisMethod?: string;
    alternativeMethod?: string;
  };
}

export class MathEngine extends BaseSubjectEngine {
  private mathjs: any = null;
  private fraction: any = null;

  constructor() {
    super('mathematics', ['math', 'algebra', 'calculus', 'geometry', 'trigonometry', 'arithmetic', 'statistics', 'probability', 'mathematics']);
    this.loadMathJs();
    this.loadFractionJs();
  }

  private loadMathJs() {
    try {
      this.mathjs = require('mathjs');
    } catch {
      // mathjs not installed, use fallback computation
    }
  }

  private loadFractionJs() {
    try {
      this.fraction = require('fraction.js');
    } catch {
      // fraction.js not installed
    }
  }

  async preprocessQuery(query: string, context?: any): Promise<string> {
    if (!this.mathjs) return query;

    // Detect equation solving and pre-compute
    const equationMatch = query.match(/solve\s+([\w\s+\-*/^=()]+)/i);
    if (equationMatch) {
      const equation = equationMatch[1].trim();
      try {
        const result = this.computeExpression(equation);
        if (result !== null) {
          return `${query}\n\n[SYSTEM: Computed result: ${JSON.stringify(result)}]`;
        }
      } catch {}
    }

    // Detect derivative/integral requests
    const derivMatch = query.match(/differentiate\s+([\w\s+\-*/^()]+)/i);
    if (derivMatch) {
      try {
        const expr = derivMatch[1].trim();
        const derivative = this.mathjs.derivative(expr, 'x');
        return `${query}\n\n[SYSTEM: Computed derivative: ${derivative.toString()}]`;
      } catch {}
    }

    return query;
  }

  async postprocessResponse(response: string, query: string): Promise<EngineResponse> {
    const topic = this.detectTopic(query);

    // If response is JSON, wrap it
    let finalContent = response;
    try {
      const parsed = JSON.parse(response);
      if (parsed && typeof parsed === 'object' && parsed.type) {
        finalContent = JSON.stringify(parsed);
      }
    } catch {}

    return {
      content: finalContent,
      subject: 'Mathematics',
      topic,
      suggestions: this.getStudySuggestions(topic),
      practiceQuestions: [this.getRandomPracticeQuestion(topic)],
    };
  }

  async generatePracticeQuestion(topic: string, difficulty: number = 1): Promise<string> {
    return this.getRandomPracticeQuestion(topic, difficulty);
  }

  async checkAnswer(question: string, studentAnswer: string): Promise<{ correct: boolean; feedback: string }> {
    if (!this.mathjs) {
      return { correct: false, feedback: 'Math engine not available. Please install mathjs.' };
    }

    try {
      const eqMatch = question.match(/solve\s+for\s+([xyz]):?\s*(.+)/i);
      if (eqMatch) {
        const expr = eqMatch[2].trim();
        const expected = this.mathjs.evaluate(expr.replace('=', '-(') + ')');
        const student = this.mathjs.evaluate(studentAnswer);
        return {
          correct: Math.abs(student - expected) < 0.01,
          feedback: Math.abs(student - expected) < 0.01
            ? 'Correct! Well done.'
            : `Not quite. The expected result was ${expected}. Let me help you work through this step by step.`,
        };
      }
    } catch {
      return { correct: false, feedback: 'Could not evaluate. Please check your answer format.' };
    }

    return { correct: false, feedback: 'Answer checking available for equation-solving questions.' };
  }

  private computeExpression(expr: string): number | string | null {
    if (!this.mathjs) return null;
    try {
      if (expr.includes('=')) {
        const parts = expr.split('=');
        const scope: Record<string, number> = {};
        return this.mathjs.evaluate(parts[0], scope);
      }
      return this.mathjs.evaluate(expr);
    } catch {
      return null;
    }
  }

  private isNumber(val: any): val is number {
    return typeof val === 'number' && !isNaN(val);
  }

  private detectTopic(query: string): string | undefined {
    const topics = ['algebra', 'calculus', 'geometry', 'trigonometry', 'statistics', 'probability', 'arithmetic', 'matrices', 'vectors', 'sequences', 'series'];
    const lower = query.toLowerCase();
    return topics.find(t => lower.includes(t));
  }

  private getRandomPracticeQuestion(topic: string | undefined, difficulty: number = 1): string {
    const questions: Record<string, string[]> = {
      algebra: [
        'Solve: 3(x + 2) = 15',
        'Factor: x² - 9',
        'Solve for x: 2x + 5 = 13',
        'Factorize: x² + 5x + 6',
        'Solve simultaneous: 2x + y = 7, x - y = 2',
        'Simplify: (3x²y³)(2xy⁴)',
      ],
      calculus: [
        'Differentiate: f(x) = 4x³ - 2x² + x - 7',
        'Find the derivative of f(x) = 3x² + 2x - 5',
        'Evaluate ∫(2x + 3)dx',
        'Find lim(x→2) (x² - 4)/(x - 2)',
      ],
      geometry: [
        'A rectangle has length 12cm and width 5cm. Find its area and perimeter.',
        'Find the area of a triangle with base 8cm and height 5cm',
        'Calculate volume of a cylinder with radius 3cm and height 7cm',
      ],
      statistics: [
        'Find mean, median, mode of: 4, 7, 2, 9, 7, 5, 8',
        'A bag has 3 red balls and 5 blue balls. Probability of picking red?',
      ],
    };

    if (topic) {
      for (const [key, qs] of Object.entries(questions)) {
        if (topic.toLowerCase().includes(key) || key.includes(topic.toLowerCase())) {
          return qs[difficulty % qs.length];
        }
      }
    }
    return questions.algebra[Math.floor(Math.random() * questions.algebra.length)];
  }

  private getStudySuggestions(topic?: string): string[] {
    const suggestions: Record<string, string[]> = {
      algebra: ['Review expansion and factorization rules', 'Practice solving linear equations daily'],
      calculus: ['Master differentiation rules (power, product, quotient, chain)', 'Practice integration by substitution'],
      geometry: ['Memorize key formulas (area, volume, Pythagoras)', 'Practice drawing diagrams for word problems'],
      statistics: ['Understand mean, median, mode differences', 'Practice probability tree diagrams'],
    };

    if (topic) {
      for (const [key, vals] of Object.entries(suggestions)) {
        if (topic.includes(key) || key.includes(topic)) return vals;
      }
    }
    return ['Review fundamental concepts', 'Practice with past exam papers'];
  }
}
