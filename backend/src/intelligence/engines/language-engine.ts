import { BaseSubjectEngine, EngineResponse } from './base-engine';

interface StructuredEnglishResult {
  type: 'english_explanation' | 'literature' | 'grammar' | 'comprehension' | 'essay' | 'general';
  explanation: string;
  steps?: Array<{
    number: number;
    title: string;
    content: string;
    math?: Array<{ latex: string; display: 'block' | 'inline' }>;
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
  answer?: { latex: string; text: string };
  practice_question?: { question: string; difficulty: string };
  common_mistakes?: string[];
  interactive?: { whyThisMethod?: string; alternativeMethod?: string };
}

export class LanguageEngine extends BaseSubjectEngine {
  private compromise: any = null;

  constructor() {
    super('english', ['language', 'english', 'literature', 'grammar', 'essay', 'comprehension', 'vocabulary', 'reading', 'writing']);
    this.loadNlp();
  }

  private loadNlp() {
    try {
      this.compromise = require('compromise');
    } catch {
      // NLP library not available
    }
  }

  async postprocessResponse(response: string, query: string): Promise<EngineResponse> {
    const topic = this.detectTopic(query);
    const corrections = this.checkGrammar(response);

    let finalContent = response;
    try {
      const parsed = JSON.parse(response) as StructuredEnglishResult;
      if (parsed && typeof parsed === 'object' && parsed.type) {
        finalContent = JSON.stringify(parsed);
      }
    } catch {}

    let enhanced = finalContent;
    if (corrections.length > 0) {
      enhanced = JSON.stringify({
        ...(JSON.parse(finalContent) || {}),
        common_mistakes: corrections,
      });
    }

    return {
      content: enhanced,
      subject: 'English',
      topic,
      suggestions: this.getStudySuggestions(topic, query),
      practiceQuestions: await this.generatePracticeQuestions(query),
    };
  }

  async generatePracticeQuestion(topic: string, difficulty: number = 1): Promise<string> {
    const questions: Record<string, string[]> = {
      grammar: [
        'Identify and correct the error: "She don\'t like apples."',
        'Fill in the blank with the correct tense: "By next year, I _____ (study) at this school for three years."',
        'Rewrite the sentence in passive voice: "The students completed the project on time."',
      ],
      essay: [
        'Write an introductory paragraph on the topic: "The importance of education in national development."',
        'Create an outline for an argumentative essay on: "Should social media be regulated?"',
      ],
      comprehension: [
        'Read the following paragraph and identify the main idea, two supporting details, and the author\'s purpose.',
        'Explain the difference between literal and inferential comprehension. Provide an example of each.',
      ],
      literature: [
        'Analyze the character of Okonkwo in "Things Fall Apart." Discuss his strengths and weaknesses.',
        'Identify and explain the use of imagery in the poem you are studying.',
        'Compare and contrast the themes of two novels you have read this term.',
      ],
      vocabulary: [
        'Use the word "ubiquitous" in a sentence that demonstrates its meaning.',
        'Provide synonyms and antonyms for the word "benevolent."',
        'Explain the difference between "affect" and "effect" with examples.',
      ],
    };

    for (const [key, qs] of Object.entries(questions)) {
      if (topic.toLowerCase().includes(key) || key.includes(topic.toLowerCase())) {
        return qs[difficulty % qs.length];
      }
    }
    return questions.grammar[0];
  }

  async checkAnswer(question: string, studentAnswer: string): Promise<{ correct: boolean; feedback: string }> {
    if (!this.compromise) {
      return { correct: false, feedback: 'Grammar checking requires the compromise NLP library.' };
    }

    try {
      const errors = this.findGrammarErrors(studentAnswer);
      if (errors.length === 0) {
        return { correct: true, feedback: 'Your answer appears grammatically correct!' };
      }
      return {
        correct: false,
        feedback: `I found ${errors.length} potential issue(s):\n${errors.map(e => `• ${e}`).join('\n')}\n\nTry revising your answer and I'll check again!`,
      };
    } catch {
      return { correct: false, feedback: 'Could not analyze grammar. Please try a simpler sentence.' };
    }
  }

  private checkGrammar(text: string): string[] {
    return [];
  }

  private findGrammarErrors(text: string): string[] {
    const errors: string[] = [];
    if (!this.compromise) return errors;

    try {
      const doc = this.compromise(text);
      const sentences = doc.sentences().out('array');

      for (const sentence of sentences) {
        const sDoc = this.compromise(sentence);
        if (sDoc.has('#Question') && sDoc.has('do')) {
          const verbPhrase = sDoc.match('do #Verb').out('text');
          if (verbPhrase && !sDoc.has('does')) {
            const subject = sDoc.match('#Noun').out('text');
            if (subject) {
              const pronoun = sDoc.match('(he|she|it)').found;
              if (pronoun) errors.push(`"${sentence}" — Use "does" instead of "do" with he/she/it.`);
            }
          }
        }

        const hasPluralSubject = sDoc.match('#Plural #Noun').found;
        const hasSingularVerb = sDoc.match('#Singular #Verb').found;
        if (hasPluralSubject && hasSingularVerb) {
          errors.push(`"${sentence}" — Subject-verb agreement: plural subject needs plural verb.`);
        }
      }
    } catch {}

    return errors;
  }

  private detectTopic(query: string): string | undefined {
    const lower = query.toLowerCase();
    if (lower.includes('grammar') || lower.includes('tense') || lower.includes('punctuation') || lower.includes('sentence')) return 'Grammar';
    if (lower.includes('essay') || lower.includes('writing') || lower.includes('paragraph') || lower.includes('composition')) return 'Essay Writing';
    if (lower.includes('comprehension') || lower.includes('passage') || lower.includes('reading')) return 'Comprehension';
    if (lower.includes('literature') || lower.includes('novel') || lower.includes('poem') || lower.includes('drama') || lower.includes('play') || lower.includes('prose')) return 'Literature';
    if (lower.includes('vocabulary') || lower.includes('word') || lower.includes('meaning') || lower.includes('synonym') || lower.includes('antonym')) return 'Vocabulary';
    return undefined;
  }

  private async generatePracticeQuestions(query: string): Promise<string[]> {
    const lower = query.toLowerCase();
    const questions: string[] = [];

    if (lower.includes('grammar') || lower.includes('tense')) {
      questions.push('Correct the error: "Neither the teacher nor the students was present."');
      questions.push('Fill the blank: "If I _____ (know) earlier, I would have helped."');
    }
    if (lower.includes('essay') || lower.includes('write')) {
      questions.push('Write a topic sentence for a paragraph about the benefits of reading.');
    }
    if (lower.includes('literature') || lower.includes('novel')) {
      questions.push('Identify the narrative technique used in the first chapter of the novel you are studying.');
    }

    return questions;
  }

  private getStudySuggestions(topic?: string, query?: string): string[] {
    if (topic === 'Grammar') return ['Practice identifying parts of speech', 'Review subject-verb agreement rules'];
    if (topic === 'Essay Writing') return ['Use PEEL structure (Point, Evidence, Explanation, Link)', 'Practice writing thesis statements'];
    if (topic === 'Comprehension') return ['Read actively: highlight key points, annotate margins', 'Practice summarizing paragraphs in one sentence'];
    if (topic === 'Literature') return ['Keep a character and theme journal', 'Practice literary device identification'];
    return ['Read widely to improve vocabulary and writing', 'Practice writing daily'];
  }
}
