import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AiTutorService {
  constructor(private prisma: PrismaService) {}

  async startSession(studentId: string, schoolId: string, options?: { subjectId?: string; topic?: string }) {
    const session = await this.prisma.aiTutorSession.create({
      data: {
        studentId,
        schoolId,
        subjectId: options?.subjectId,
        topic: options?.topic,
      },
    });

    const greeting = this.generateGreeting(options?.topic, options?.subjectId);

    await this.prisma.aiTutorMessage.create({
      data: {
        sessionId: session.id,
        role: 'tutor',
        content: greeting,
      },
    });

    return { sessionId: session.id, message: greeting };
  }

  async sendMessage(sessionId: string, studentId: string, message: string, schoolId: string) {
    const session = await this.prisma.aiTutorSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!session || session.schoolId !== schoolId || session.studentId !== studentId) {
      return { error: 'Session not found' };
    }

    await this.prisma.aiTutorMessage.create({
      data: { sessionId, role: 'student', content: message },
    });

    const response = await this.generateResponse(message, session);

    await this.prisma.aiTutorMessage.create({
      data: { sessionId, role: 'tutor', content: response },
    });

    return { response };
  }

  async getSessionHistory(sessionId: string, schoolId: string) {
    const session = await this.prisma.aiTutorSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!session || session.schoolId !== schoolId) return { error: 'Session not found' };

    return {
      sessionId: session.id,
      subjectId: session.subjectId,
      topic: session.topic,
      status: session.status,
      messages: session.messages.map(m => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  }

  async getStudentSessions(studentId: string, schoolId: string) {
    const sessions = await this.prisma.aiTutorSession.findMany({
      where: { studentId, schoolId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    return sessions.map(s => ({
      sessionId: s.id,
      subjectId: s.subjectId,
      topic: s.topic,
      status: s.status,
      createdAt: s.createdAt,
      lastActive: s.updatedAt,
    }));
  }

  async endSession(sessionId: string, schoolId: string, feedback?: { rating?: number; helpful?: boolean; comment?: string }) {
    const session = await this.prisma.aiTutorSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.schoolId !== schoolId) return { error: 'Session not found' };

    await this.prisma.aiTutorSession.update({
      where: { id: sessionId },
      data: { status: 'completed' },
    });

    if (feedback) {
      await this.prisma.aiTutorFeedback.upsert({
        where: { sessionId },
        update: feedback,
        create: { sessionId, ...feedback },
      });
    }

    return { message: 'Session ended', sessionId };
  }

  async askQuestion(studentId: string, schoolId: string, question: string, subjectId?: string) {
    if (!studentId) {
      const response = this.generateGeneralTutoringResponse(question, {});
      return { response };
    }

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true },
    });

    if (!student) {
      const response = this.generateGeneralTutoringResponse(question, {});
      return { response };
    }

    const sessions = await this.prisma.aiTutorSession.findMany({
      where: { studentId, schoolId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    });

    let sessionId: string;

    if (sessions.length > 0) {
      sessionId = sessions[0].id;
    } else {
      const result = await this.startSession(studentId, schoolId, { subjectId });
      sessionId = result.sessionId;
    }

    return this.sendMessage(sessionId, studentId, question, schoolId);
  }

  async getTutorInsights(studentId: string, schoolId: string) {
    const sessions = await this.prisma.aiTutorSession.findMany({
      where: { studentId, schoolId },
      include: { messages: true, feedback: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    if (!sessions.length) return { error: 'No tutoring sessions found' };

    const totalMessages = sessions.reduce((s, sess) => s + sess.messages.length, 0);
    const tutorMessages = sessions.reduce((s, sess) => s + sess.messages.filter(m => m.role === 'tutor').length, 0);
    const avgRating = sessions.filter(s => s.feedback?.rating).reduce((sum, s) => sum + (s.feedback?.rating || 0), 0) /
      Math.max(1, sessions.filter(s => s.feedback?.rating).length);

    const topics = sessions.filter(s => s.topic).map(s => s.topic);
    const uniqueTopics = [...new Set(topics)];

    const messages = sessions.flatMap(s => s.messages);
    const keywords = this.extractKeywords(messages.filter(m => m.role === 'student').map(m => m.content));

    return {
      totalSessions: sessions.length,
      totalMessages,
      tutorMessageRatio: totalMessages > 0 ? Number((tutorMessages / totalMessages * 100).toFixed(2)) : 0,
      averageRating: avgRating > 0 ? Number(avgRating.toFixed(2)) : null,
      topicsExplored: uniqueTopics,
      commonQuestionKeywords: keywords.slice(0, 10),
      recommendations: keywords.length > 0
        ? [`Student frequently asks about: ${keywords.slice(0, 5).join(', ')}. Consider providing additional resources in these areas.`]
        : ['No specific patterns detected yet. Continue tutoring sessions for more insights.'],
    };
  }

  private generateGreeting(topic?: string, subjectId?: string): string {
    if (topic && subjectId) {
      return `Hello! I'm your AI tutor. Let's explore ${topic} together. What would you like to learn about this topic?`;
    }
    if (subjectId) {
      return `Hi there! I'm your AI tutor. I see you're studying this subject. What topic would you like help with?`;
    }
    return `Welcome! I'm your AI tutor. I can help you understand concepts, solve problems, and practice for exams. What would you like to learn today?`;
  }

  private async generateResponse(message: string, session: any): Promise<string> {
    const lower = message.toLowerCase();

    if (this.isGreeting(lower)) {
      return this.respondToGreeting(session);
    }

    if (this.isHelpRequest(lower)) {
      return this.respondToHelp(session);
    }

    if (this.isPracticeRequest(lower)) {
      return this.generatePracticeQuestion(session);
    }

    if (this.isExplanationRequest(lower)) {
      return this.generateExplanation(message, session);
    }

    if (this.isMotivational(lower)) {
      return this.respondToMotivation();
    }

    return this.generateGeneralTutoringResponse(message, session);
  }

  private isGreeting(text: string): boolean {
    return /^(hi|hello|hey|greetings|good\s(morning|afternoon|evening))/.test(text);
  }

  private isHelpRequest(text: string): boolean {
    return /help|struggling|confused|don't understand|difficult/.test(text);
  }

  private isPracticeRequest(text: string): boolean {
    return /practice|exercise|problem|question|test me|quiz/.test(text);
  }

  private isExplanationRequest(text: string): boolean {
    return /explain|what is|how does|why does|mean|define|tell me about/.test(text);
  }

  private isMotivational(text: string): boolean {
    return /tired|bored|demotivated|give up|hard|frustrated/.test(text);
  }

  private respondToGreeting(session: any): string {
    const topic = session.topic || 'your studies';
    return `Hello again! Ready to dive deeper into ${topic}? Feel free to ask me anything, or I can give you a practice question to test your understanding.`;
  }

  private respondToHelp(session: any): string {
    const subjectHint = session.subjectId ? 'this subject' : 'this topic';
    return `I'm here to help! Let's break down what you're finding difficult about ${subjectHint}. Can you tell me specifically which concept or problem you're working on? Try asking me a specific question like "Explain [concept]" or "How do I solve [problem type]?"`;
  }

  private generateExplanation(question: string, session: any): string {
    const topic = this.extractTopic(question);
    if (topic) {
      return `Great question about ${topic}! Here's a structured explanation:\n\n` +
        `1. **Definition**: ${topic} is a key concept in ${session.subjectId || 'this subject'}.\n` +
        `2. **Key Points**: Understanding ${topic} requires focusing on its core principles and applications.\n` +
        `3. **Example**: Consider how ${topic} applies in different contexts.\n` +
        `4. **Practice**: Try working through related problems to reinforce your understanding.\n\n` +
        `Would you like me to go deeper into any specific aspect of ${topic}, or would you like a practice question?`;
    }
    return `That's an interesting question! Let me break it down for you:\n\n` +
      `The key to understanding this concept is to start with the fundamentals and build up gradually. Think about how it connects to what you've already learned.\n\n` +
      `Would you like me to explain a specific example? That often helps make abstract concepts more concrete.`;
  }

  private generatePracticeQuestion(session: any): string {
    return `Here's a practice question for you:\n\n` +
      `**Question**: Based on what you've been studying, can you explain the relationship between the key concepts and provide a real-world example?\n\n` +
      `Try answering in your own words, and I'll give you feedback on your response!`;
  }

  private respondToMotivation(): string {
    return `I understand that learning can be challenging sometimes. Remember that every expert was once a beginner! Here are a few tips:\n\n` +
      `1. **Break it down**: Focus on one small concept at a time\n` +
      `2. **Take breaks**: Short breaks actually help your brain learn better\n` +
      `3. **Ask questions**: There are no silly questions - every question helps you learn\n` +
      `4. **Practice**: Regular practice makes things easier over time\n\n` +
      `What's one small thing we can work on together right now?`;
  }

  private generateGeneralTutoringResponse(message: string, session: any): string {
    const hasContent = message.length > 20;
    if (hasContent) {
      return `That's a good point! Based on what you've shared, here's my guidance:\n\n` +
        `The key here is to approach this systematically. Make sure you understand the foundational concepts before moving to more complex applications.\n\n` +
        `Would you like me to:\n` +
        `1. Explain a specific concept in more detail?\n` +
        `2. Give you a practice problem?\n` +
        `3. Provide study tips for this topic?`;
    }
    return `I'd love to help you learn! Could you tell me more about what you're working on? You can ask me to:\n\n` +
      `- Explain a concept (e.g., "Explain photosynthesis")\n` +
      `- Give a practice question (e.g., "Give me a math problem")\n` +
      `- Help with a topic (e.g., "Help me with algebra")\n\n` +
      `What sounds most helpful to you right now?`;
  }

  private extractTopic(question: string): string {
    const patterns = [
      /explain\s+(.+?)(?:\?|$)/i,
      /what\s+is\s+(.+?)(?:\?|$)/i,
      /how\s+does\s+(.+?)(?:\?|$)/i,
      /tell\s+me\s+about\s+(.+?)(?:\?|$)/i,
      /define\s+(.+?)(?:\?|$)/i,
    ];
    for (const pattern of patterns) {
      const match = question.match(pattern);
      if (match) return match[1].trim();
    }
    return '';
  }

  private extractKeywords(messages: string[]): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'my', 'your', 'this', 'that', 'these', 'those',
      'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about',
      'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off',
      'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
      'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
      'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'because', 'as',
      'until', 'while', 'if', 'can', 'get', 'got', 'like', 'know', 'think', 'want', 'need']);

    const words = messages
      .join(' ')
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));

    const freq = new Map<string, number>();
    for (const w of words) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }

    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([w]) => w);
  }
}
