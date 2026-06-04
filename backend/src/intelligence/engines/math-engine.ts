import { BaseSubjectEngine, EngineResponse } from './base-engine';

export class MathEngine extends BaseSubjectEngine {
  private mathjs: any = null;

  constructor() {
    super('mathematics', ['math', 'algebra', 'calculus', 'geometry', 'trigonometry', 'arithmetic', 'statistics', 'probability', 'mathematics']);
    this.loadMathJs();
  }

  private loadMathJs() {
    try {
      this.mathjs = require('mathjs');
    } catch {
      // mathjs not installed, use fallback computation
    }
  }

  async preprocessQuery(query: string, context?: any): Promise<string> {
    const equationMatch = query.match(/solve\s+([\w\s+\-*/^=()]+)/i);
    if (equationMatch && this.mathjs) {
      const equation = equationMatch[1].trim();
      try {
        const solution = this.evaluateExpression(equation);
        return `${query}\n\n[SYSTEM: Computed intermediate result: ${JSON.stringify(solution)}]`;
      } catch {}
    }
    return query;
  }

  async postprocessResponse(response: string, query: string): Promise<EngineResponse> {
    const practiceQuestions = await this.generatePracticeQuestions(query);
    const topic = this.detectTopic(query);
    return {
      content: response,
      subject: 'Mathematics',
      topic,
      suggestions: this.getStudySuggestions(topic),
      practiceQuestions: practiceQuestions.slice(0, 2),
    };
  }

  async generatePracticeQuestion(topic: string, difficulty: number = 1): Promise<string> {
    const questions: Record<string, string[]> = {
      algebra: [
        'Solve for x: 2x + 5 = 13',
        'Factorize: x² + 5x + 6',
        'Solve the simultaneous equations: 2x + y = 7 and x - y = 2',
        'Simplify: (3x²y³)(2xy⁴)',
      ],
      calculus: [
        'Find the derivative of f(x) = 3x² + 2x - 5',
        'Evaluate ∫(2x + 3)dx',
        'Find the limit: lim(x→2) (x² - 4)/(x - 2)',
      ],
      geometry: [
        'Find the area of a triangle with base 8cm and height 5cm',
        'Calculate the volume of a cylinder with radius 3cm and height 7cm',
        'In a right-angled triangle, if the hypotenuse is 13cm and one side is 5cm, find the other side',
      ],
      statistics: [
        'Find the mean, median, and mode of: 4, 7, 2, 9, 7, 5, 8',
        'A bag contains 3 red balls and 5 blue balls. What is the probability of picking a red ball?',
      ],
    };

    for (const [key, qs] of Object.entries(questions)) {
      if (topic.toLowerCase().includes(key) || key.includes(topic.toLowerCase())) {
        return qs[difficulty % qs.length];
      }
    }
    return questions.algebra[0];
  }

  async checkAnswer(question: string, studentAnswer: string): Promise<{ correct: boolean; feedback: string }> {
    if (!this.mathjs) {
      return { correct: false, feedback: 'Math engine not available. Please install mathjs.' };
    }

    try {
      const eqMatch = question.match(/solve\s+for\s+([xyz]):?\s*(.+)/i);
      if (eqMatch) {
        const result = this.evaluateExpression(eqMatch[2]);
        if (typeof result !== 'number') {
          return { correct: false, feedback: 'Could not compute expected result.' };
        }
        const expected = result;
        const student = this.mathjs.evaluate(studentAnswer);
        return {
          correct: Math.abs(student - expected) < 0.01,
          feedback: `The expected solution was ${expected}. ${studentAnswer === String(expected) ? 'Correct!' : 'Let me help you work through this.'}`,
        };
      }
    } catch {
      return { correct: false, feedback: 'Could not evaluate. Please check your answer format.' };
    }

    return { correct: false, feedback: 'Answer checking available for equation-solving questions.' };
  }

  private evaluateExpression(expr: string): number | string {
    if (!this.mathjs) return 'Math engine unavailable';
    try {
      if (expr.includes('=')) {
        const parts = expr.split('=');
        const result = this.mathjs.evaluate(parts[0]);
        return result;
      }
      return this.mathjs.evaluate(expr);
    } catch {
      return 'Could not evaluate expression';
    }
  }

  private isNumber(val: number | string): val is number {
    return typeof val === 'number' && !isNaN(val);
  }

  private detectTopic(query: string): string | undefined {
    const topics = ['algebra', 'calculus', 'geometry', 'trigonometry', 'statistics', 'probability', 'arithmetic', 'matrices', 'vectors', 'sequences', 'series'];
    const lower = query.toLowerCase();
    return topics.find(t => lower.includes(t));
  }

  private async generatePracticeQuestions(query: string): Promise<string[]> {
    const questions: string[] = [];
    const lower = query.toLowerCase();

    if (lower.includes('algebra') || lower.includes('equation')) {
      questions.push('Solve: 3(x + 2) = 15');
      questions.push('Factor: x² - 9');
    }
    if (lower.includes('calculus') || lower.includes('derivative')) {
      questions.push('Differentiate: f(x) = 4x³ - 2x² + x - 7');
    }
    if (lower.includes('geometry') || lower.includes('area') || lower.includes('volume')) {
      questions.push('A rectangle has length 12cm and width 5cm. Find its area and perimeter.');
    }

    return questions;
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
