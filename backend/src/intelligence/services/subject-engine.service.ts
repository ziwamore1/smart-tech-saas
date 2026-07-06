import { Injectable, Logger } from '@nestjs/common';
import { getEngineForSubject, getSubjectSystemPrompt, getAllEngines, BaseSubjectEngine } from '../engines';

@Injectable()
export class SubjectEngineService {
  private readonly logger = new Logger(SubjectEngineService.name);

  getSystemPromptForSubject(subject?: string): string {
    if (!subject) return '';
    return getSubjectSystemPrompt(subject);
  }

  getEngineForSubject(subject?: string): BaseSubjectEngine | null {
    if (!subject) return null;
    return getEngineForSubject(subject);
  }

  async preprocessQuery(subject: string | undefined, query: string, context?: any): Promise<string> {
    const engine = this.getEngineForSubject(subject);
    if (engine) {
      try {
        return await engine.preprocessQuery(query, context);
      } catch (e) {
        this.logger.warn(`Preprocessing failed for ${subject}: ${e}`);
      }
    }
    return query;
  }

  detectSubjectFromQuery(query: string): string | undefined {
    const lower = query.toLowerCase();

    // Check for LaTeX math delimiters — strong signal it's a math question
    if (/\\\(|\\\)|\\\[|\\\]|\$\$|\$[^$]+\$/.test(query)) return 'mathematics';

    const subjectMap: Record<string, string[]> = {
      mathematics: [
        'algebra', 'calculus', 'derivative', 'integral', 'geometry', 'trigonometry',
        'theorem', 'matrix', 'vector', 'probability', 'statistics',
        'math', 'mathematics', 'maths', 'solve', 'equation', 'quadratic',
        'polynomial', 'factoring', 'factorize', 'fraction', 'ratio',
        'percentage', 'power', 'exponent', 'root', 'square root',
        'square', 'cube', 'logarithm', 'log', 'graph', 'function',
        'limit', 'differentiation', 'integration', 'definite integral',
        'indefinite integral', 'simultaneous', 'inequality', 'rational',
        'domain', 'range', 'asymptote', 'intercept', 'slope', 'gradient',
        'tangent', 'normal', 'parabola', 'hyperbola', 'ellipse', 'circle',
        'permutation', 'combination', 'binomial', 'variance', 'mean',
        'median', 'mode', 'standard deviation', 'correlation',
        'regression', 'hypothesis', 'normal distribution', 'z-score',
        'pythagoras', 'pythagorean', 'sine', 'cosine', 'tan',
        'sin(', 'cos(', 'tan(', 'arcsin', 'arccos', 'arctan',
        'angle', 'triangle', 'polygon', 'congruent', 'similar',
        'symmetry', 'transformation', 'translation', 'reflection',
        'rotation', 'dilation', 'vector', 'magnitude', 'scalar',
        'complex number', 'imaginary', 'real number', 'integer',
        'prime number', 'factor', 'multiple', 'divisible', 'gcd', 'lcm',
        'sequence', 'series', 'arithmetic progression', 'geometric progression',
        'summation', 'sigma', 'factorial', 'modulo', 'modulus',
      ],
      science: ['physics', 'chemistry', 'biology', 'force', 'energy', 'atom', 'molecule', 'cell', 'dna', 'photosynthesis', 'chemical', 'circuit'],
      english: ['grammar', 'essay', 'paragraph', 'vocabulary', 'noun', 'verb', 'adjective', 'tense', 'comprehension', 'literature', 'novel', 'poem'],
      history: ['history', 'war', 'independence', 'colonial', 'kingdom', 'empire', 'revolution', 'civilization'],
      geography: ['geography', 'map', 'climate', 'population', 'river', 'mountain', 'ocean', 'weather', 'ecosystem'],
      civic_education: ['civic', 'constitution', 'government', 'democracy', 'rights', 'citizen', 'vote', 'parliament'],
      religious_education: ['religious', 'religion', 'bible', 'faith', 'worship', 'moral', 'ethics', 'prayer'],
      ict: ['computer', 'programming', 'software', 'hardware', 'internet', 'network', 'database', 'algorithm'],
      agriculture: ['agriculture', 'farming', 'crop', 'livestock', 'soil', 'irrigation', 'fertilizer'],
    };

    for (const [subject, keywords] of Object.entries(subjectMap)) {
      if (keywords.some(k => lower.includes(k))) return subject;
    }
    return undefined;
  }
}
