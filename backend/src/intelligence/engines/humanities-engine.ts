import { BaseSubjectEngine, EngineResponse } from './base-engine';

export class HumanitiesEngine extends BaseSubjectEngine {
  private readonly domains: Record<string, string[]> = {
    history: ['history', 'historical', 'civilization', 'kingdom', 'colonial', 'independence', 'war', 'revolution'],
    geography: ['geography', 'map', 'climate', 'population', 'landform', 'ecosystem', 'weather', 'region', 'country', 'continent'],
    civic_education: ['civic', 'constitution', 'government', 'democracy', 'rights', 'citizen', 'politics', 'vote', 'election'],
    religious_education: ['religious', 'religion', 'bible', 'faith', 'worship', 'church', 'islam', 'christian', 'moral', 'ethics'],
    ict: ['ict', 'computer', 'programming', 'software', 'hardware', 'internet', 'network', 'data', 'digital'],
    agriculture: ['agriculture', 'farming', 'crop', 'livestock', 'soil', 'farm', 'irrigation', 'harvest', 'agro'],
  };

  constructor() {
    super('humanities', [
      'history', 'geography', 'civic', 'religious', 'ict', 'agriculture',
      'social studies', 'social',
    ]);
  }

  async postprocessResponse(response: string, query: string): Promise<EngineResponse> {
    const domain = this.detectDomain(query);
    const topic = this.detectTopic(query);

    let enhanced = response;
    const questions_result = await this.generatePracticeQuestion(topic || query, 1);
    const questions = questions_result ? [questions_result] : [];

    return {
      content: enhanced,
      subject: this.capitalize(domain),
      topic,
      suggestions: this.getStudySuggestions(domain),
      practiceQuestions: questions.slice(0, 2),
    };
  }

  async generatePracticeQuestion(topic: string, difficulty: number = 1): Promise<string> {
    const questions: Record<string, string[]> = {
      history: [
        'Explain three causes of World War I.',
        'Describe the main features of the trans-Atlantic slave trade and its effects on Africa.',
        'What were the causes and consequences of the scramble for Africa?',
        'Compare and contrast the independence movements of two African countries.',
      ],
      geography: [
        'Explain the differences between weather and climate.',
        'Describe the formation of a rift valley.',
        'What factors influence population distribution in Africa?',
        'Explain the causes and effects of deforestation in the Amazon rainforest.',
      ],
      civic_education: [
        'Explain the three branches of government and their functions.',
        'What are the characteristics of a democratic government?',
        'Describe the importance of the rule of law in a democratic society.',
        'Explain five responsibilities of a citizen.',
      ],
      religious_education: [
        'Explain the concept of the Trinity in Christianity.',
        'What are the Five Pillars of Islam?',
        'Compare the teachings of Christianity and Islam on charity.',
        'Discuss the role of religious leaders in promoting peace.',
      ],
      ict: [
        'Explain the difference between RAM and ROM.',
        'Describe the function of each component in a computer system.',
        'What is the difference between a hub, a switch, and a router?',
        'Write an algorithm to find the largest number in a list of three numbers.',
      ],
      agriculture: [
        'Explain the differences between subsistence and commercial farming.',
        'Describe the process of soil formation.',
        'What are the methods of crop pest control?',
        'Explain the importance of farm records.',
      ],
    };

    const domain = this.detectDomain(topic) || 'history';
    const domainQuestions = questions[domain] || questions.history;
    return domainQuestions[difficulty % domainQuestions.length];
  }

  async checkAnswer(question: string, studentAnswer: string): Promise<{ correct: boolean; feedback: string }> {
    const domain = this.detectDomain(question) || 'history';
    const keywords = this.extractKeywords(question);
    const answerLower = studentAnswer.toLowerCase();

    const keyTermsPresent = keywords.filter(k => answerLower.includes(k.toLowerCase())).length;
    const totalKeyTerms = Math.max(keywords.length, 1);
    const relevance = (keyTermsPresent / totalKeyTerms) * 100;

    const minLength = studentAnswer.split(/\s+/).length >= 10;
    const hasStructure = /(first|second|third|finally|because|therefore|however|in conclusion)/i.test(studentAnswer);

    const score = (relevance * 0.5 + (minLength ? 25 : 0) + (hasStructure ? 25 : 0));
    const passed = score >= 50;

    return {
      correct: passed,
      feedback: passed
        ? `Good answer! Your response covers ${keyTermsPresent} of ${keywords.length} key terms and is well-structured. ${relevance < 80 ? 'Try to include more specific details from the topic.' : 'Excellent detail!'}`
        : `Your answer needs more development. Aim to: (1) Address key terms like ${keywords.slice(0, 3).join(', ')}, (2) Write at least 2-3 complete sentences, (3) Use a clear structure with examples.`,
    };
  }

  private detectDomain(query: string): string {
    const lower = query.toLowerCase();
    for (const [domain, keywords] of Object.entries(this.domains)) {
      if (keywords.some(k => lower.includes(k))) return domain;
    }
    return 'history';
  }

  private detectTopic(query: string): string | undefined {
    const lower = query.toLowerCase();
    if (lower.includes('world war') || lower.includes('independence') || lower.includes('colonial') || lower.includes('kingdom') || lower.includes('civilization') || lower.includes('slave')) return 'History';
    if (lower.includes('map') || lower.includes('climate') || lower.includes('population') || lower.includes('weather') || lower.includes('river') || lower.includes('mountain')) return 'Geography';
    if (lower.includes('constitution') || lower.includes('government') || lower.includes('democracy') || lower.includes('rights') || lower.includes('vote') || lower.includes('citizen') || lower.includes('law')) return 'Civic Education';
    if (lower.includes('religion') || lower.includes('god') || lower.includes('faith') || lower.includes('moral') || lower.includes('ethics') || lower.includes('prayer') || lower.includes('worship')) return 'Religious Education';
    if (lower.includes('computer') || lower.includes('program') || lower.includes('software') || lower.includes('hardware') || lower.includes('internet') || lower.includes('data') || lower.includes('algorithm')) return 'ICT';
    if (lower.includes('farm') || lower.includes('crop') || lower.includes('livestock') || lower.includes('soil') || lower.includes('irrigation') || lower.includes('agriculture')) return 'Agriculture';
    return undefined;
  }

  private extractKeywords(query: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'my', 'your', 'this', 'that', 'these', 'those', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because', 'as', 'until', 'while', 'if']);
    return query.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));
  }

  private getStudySuggestions(domain: string): string[] {
    const suggestions: Record<string, string[]> = {
      history: ['Create timelines of key events', 'Practice essay writing on cause and effect', 'Use mnemonic devices for dates and names'],
      geography: ['Practice map reading skills', 'Create diagrams of geographical processes', 'Study case studies from different regions'],
      civic_education: ['Follow current political news', 'Discuss civic issues with peers', 'Practice writing letters to officials on civic matters'],
      religious_education: ['Create comparison charts of different religions', 'Practice ethical reasoning with case studies', 'Memorize key scriptures and their meanings'],
      ict: ['Practice coding regularly', 'Build small projects to apply concepts', 'Stay updated with technology news'],
      agriculture: ['Visit local farms to observe practices', 'Start a small garden project', 'Study local agricultural challenges and solutions'],
    };
    return suggestions[domain] || ['Review key concepts and practice with past exam papers'];
  }

  private capitalize(s: string): string {
    return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}
