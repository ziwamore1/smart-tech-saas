import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import { AiContextService } from './ai-context.service';
import { AiMemoryService } from './ai-memory.service';
import { SubjectEngineService } from './subject-engine.service';
import { buildSystemPrompt, buildUserPrompt, AiContext, Role } from './prompt-templates';
import { CompositeSubjectService } from '../../composite-subject/composite-subject.service';

@Injectable()
export class AiTutorService {
  private readonly logger = new Logger(AiTutorService.name);
  private openai: OpenAI;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private aiContext: AiContextService,
    private aiMemory: AiMemoryService,
    private subjectEngine: SubjectEngineService,
    private compositeSubjectService: CompositeSubjectService,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.logger.warn('OPENAI_API_KEY not configured. AI Tutor will use fallback responses.');
    }
  }

  async startSession(
    studentId: string,
    schoolId: string,
    options?: { subjectId?: string; topic?: string; context?: Partial<AiContext> },
  ) {
    const session = await this.prisma.aiTutorSession.create({
      data: {
        studentId,
        schoolId,
        subjectId: options?.subjectId,
        topic: options?.topic,
      },
    });

    const context = await this.buildFullContext(schoolId, {
      ...options?.context,
      subjectId: options?.subjectId || options?.context?.subjectId,
      topic: options?.topic || options?.context?.topic,
    });
    const greeting = await this.generateGreeting(context, options);

    await this.prisma.aiTutorMessage.create({
      data: { sessionId: session.id, role: 'tutor', content: greeting },
    });

    await this.aiMemory.update(studentId, {
      subject: options?.subjectId,
      topic: options?.topic,
      role: context.role,
      className: context.className,
      grade: context.grade,
      performanceSnapshot: context.currentPerformance
        ? { average: context.currentPerformance.average, weakAreas: context.currentPerformance.weakAreas }
        : undefined,
      recentMessages: [{ role: 'tutor', content: greeting }],
    }, session.id);

    return { sessionId: session.id, message: greeting };
  }

  async sendMessage(
    sessionId: string,
    studentId: string,
    message: string,
    schoolId: string,
    context?: Partial<AiContext>,
  ) {
    const session = await this.prisma.aiTutorSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } },
    });

    if (!session || session.schoolId !== schoolId) {
      return { error: 'Session not found' };
    }
    if (session.studentId && session.studentId !== studentId) {
      return { error: 'Session not found' };
    }

    await this.prisma.aiTutorMessage.create({
      data: { sessionId, role: 'student', content: message },
    });

    const memory = await this.aiMemory.pushMessage(studentId, 'user', message, sessionId);
    const previousMessages = memory.recentMessages.slice(-10).map(m => ({
      role: m.role === 'tutor' ? 'assistant' : 'user',
      content: m.content,
    }));

    const fullContext = await this.buildFullContext(schoolId, {
      ...context,
      studentId,
      message,
      subject: context?.subject || session.subjectId || memory.subject || undefined,
      subjectId: context?.subjectId || session.subjectId || undefined,
      topic: context?.topic || session.topic || memory.topic || undefined,
      previousMessages,
    });

    const response = await this.generateLLMResponse(fullContext);

    await this.prisma.aiTutorMessage.create({
      data: { sessionId, role: 'tutor', content: response },
    });

    await this.aiMemory.pushMessage(studentId, 'tutor', response, sessionId);

    return { response };
  }

  async askQuestion(
    studentId: string,
    schoolId: string,
    question: string,
    subjectId?: string,
    context?: Partial<AiContext>,
  ) {
    if (!studentId) {
      const genericCtx: AiContext = {
        role: 'student',
        message: question,
        subject: context?.subject || subjectId,
        subjectId: context?.subjectId || subjectId,
      };
      const response = await this.generateLLMResponse(genericCtx);
      return { response, isGeneral: true };
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
      const result = await this.startSession(studentId, schoolId, { subjectId, context });
      sessionId = result.sessionId;
    }

    return this.sendMessage(sessionId, studentId, question, schoolId, context);
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

  async endSession(
    sessionId: string,
    schoolId: string,
    feedback?: { rating?: number; helpful?: boolean; comment?: string },
  ) {
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

    const keywords = this.extractKeywords(
      sessions.flatMap(s => s.messages).filter(m => m.role === 'student').map(m => m.content),
    );

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

  private async buildFullContext(schoolId: string, partial?: Partial<AiContext>): Promise<AiContext> {
    const context: AiContext = {
      role: partial?.role || 'student',
      subject: partial?.subject,
      subjectId: partial?.subjectId,
      topic: partial?.topic,
      screen: partial?.screen,
      message: partial?.message,
      previousMessages: partial?.previousMessages,
    };

    if (partial?.studentId) {
      const studentCtx = await this.aiContext.getStudentContext(partial.studentId, schoolId);
      if (studentCtx) {
        context.name = studentCtx.name;
        context.grade = studentCtx.grade;
        context.className = studentCtx.className;
        context.currentPerformance = studentCtx.currentPerformance;
        context.attendance = studentCtx.attendance;
        context.recentResults = studentCtx.recentResults;
        context.competency = studentCtx.competency;
        context.growth = studentCtx.growth;
      }
    }

    if (partial?.role === 'teacher' || partial?.role === 'class_teacher') {
      const teacherCtx = await this.aiContext.getTeacherContext(partial.userId || '', schoolId);
      if (teacherCtx) {
        context.name = partial?.name;
        context.classPerformance = teacherCtx.classes;
      }
    }

    if (partial?.role === 'director') {
      const directorCtx = await this.aiContext.getDirectorContext(schoolId);
      if (directorCtx) {
        context.schoolStats = directorCtx.schoolStats;
        context.classPerformance = directorCtx.classPerformance;
        context.className = directorCtx.currentTerm || undefined;
      }
    }

    if (partial?.role === 'parent') {
      const parentCtx = await this.aiContext.getParentContext(partial.userId || '', schoolId);
      if (parentCtx) {
        context.children = parentCtx.children;
      }
    }

    // Fetch curriculum context when subjectId is available
    const subjectId = partial?.subjectId || context.subjectId;
    if (subjectId && schoolId) {
      try {
        context.curriculumContext = await this.fetchCurriculumContext(schoolId, subjectId, partial?.topic);
      } catch (err) {
        this.logger.warn(`Failed to fetch curriculum context for subject ${subjectId}: ${err}`);
      }

      // Check if this subject is a component of a composite subject
      try {
        const composites = await this.prisma.compositeSubject.findMany({
          where: {
            isActive: true,
            components: { some: { subjectId } },
          },
          include: { components: { include: { subject: true } } },
        });

        if (composites.length > 0) {
          const composite = composites[0];
          const studentId = partial?.studentId || context.studentId;
          const term = studentId
            ? await this.prisma.term.findFirst({
                where: { schoolId, isCurrent: true },
                orderBy: { startDate: 'desc' },
              })
            : null;

          const components = [];
          for (const component of composite.components) {
            let percentage: number | null = null;
            if (studentId && term) {
              const computed = await this.prisma.computedResult.findUnique({
                where: {
                  studentId_subjectId_termId: {
                    studentId,
                    subjectId: component.subjectId,
                    termId: term.id,
                  },
                },
              }).catch(() => null);
              percentage = computed?.finalPercentage ?? null;
            }
            components.push({
              subjectName: component.subject.name,
              percentage,
              weight: component.weight,
            });
          }

          context.compositeContext = {
            isComposite: true,
            compositeName: composite.name,
            components,
          };
        }
      } catch (err) {
        this.logger.warn(`Failed to fetch composite context: ${err}`);
      }
    }

    return context;
  }

  private async fetchCurriculumContext(schoolId: string, subjectId: string, topicId?: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      include: {
        topics: {
          include: { subtopics: true, competencies: true, learningOutcomes: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!subject) return null;

    const eocs = await this.prisma.elementOfConstruct.findMany({
      where: { subjectId },
      include: { competencies: true },
      orderBy: { sortOrder: 'asc' },
    });

    const assessmentObjectives = await this.prisma.assessmentObjective.findMany({
      where: { subjectId },
    });

    let currentTopic = null;
    if (topicId) {
      currentTopic = await this.prisma.topic.findUnique({
        where: { id: topicId },
        include: { subtopics: true, competencies: true, learningOutcomes: true },
      });
    }

    return {
      subjectName: subject.name,
      subjectCode: subject.code || '',
      elementsOfConstruct: eocs.map(e => ({
        name: e.name,
        competencies: e.competencies.map(c => c.name),
      })),
      assessmentObjectives: assessmentObjectives.map(a => ({ name: a.name, weight: a.weight })),
      topics: subject.topics.map(t => ({
        name: t.name,
        subtopics: t.subtopics.map(s => s.name),
        competencies: t.competencies.map(c => c.name),
        outcomes: t.learningOutcomes.map(o => o.name),
      })),
      currentTopic: currentTopic ? {
        name: currentTopic.name,
        subtopics: currentTopic.subtopics.map(s => ({ name: s.name, description: s.description })),
        competencies: currentTopic.competencies.map(c => ({ name: c.name, description: c.description, bloomLevel: c.bloomLevel })),
        outcomes: currentTopic.learningOutcomes.map(o => ({ name: o.name, bloomLevel: o.bloomLevel })),
      } : null,
    };
  }

  private async generateLLMResponse(context: AiContext): Promise<string> {
    if (!this.openai) {
      return this.fallbackResponse(context);
    }

    try {
      const subject = context.subject || this.subjectEngine.detectSubjectFromQuery(context.message || '');
      const subjectPrompt = this.subjectEngine.getSystemPromptForSubject(subject);
      const rolePrompt = buildSystemPrompt(context);
      const systemPrompt = subjectPrompt
        ? `${rolePrompt}\n\n=== SUBJECT-SPECIFIC INSTRUCTIONS ===\n${subjectPrompt}\n\nRemember: You are teaching ${subject}. Follow the subject-specific methodology above while also adapting to the user's role and context.`
        : rolePrompt;

      const preprocessedQuery = await this.subjectEngine.preprocessQuery(subject, context.message || '', context);
      const userPrompt = buildUserPrompt({ ...context, message: preprocessedQuery });

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...(context.previousMessages?.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[]) || [],
        { role: 'user', content: userPrompt },
      ];

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      });

      return response.choices[0]?.message?.content || this.fallbackResponse(context);
    } catch (error) {
      this.logger.error('OpenAI API error:', error);
      return this.fallbackResponse(context);
    }
  }

  private async generateGreeting(context: AiContext, options?: { subjectId?: string; topic?: string }): Promise<string> {
    if (this.openai) {
      try {
        const systemPrompt = buildSystemPrompt(context);
        const introPrompt = `Generate a warm, personalized greeting for a ${context.role}${options?.topic ? ` who wants to learn about ${options.topic}` : ''}${options?.subjectId ? ` in ${context.subject || 'this subject'}` : ''}. Be specific and reference their performance context. Keep it under 3 sentences.`;

        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: introPrompt },
          ],
          max_tokens: 200,
          temperature: 0.8,
        });

        return response.choices[0]?.message?.content || this.staticGreeting(options?.topic, options?.subjectId);
      } catch {
        return this.staticGreeting(options?.topic, options?.subjectId);
      }
    }
    return this.staticGreeting(options?.topic, options?.subjectId);
  }

  private staticGreeting(topic?: string, subjectId?: string): string {
    if (topic && subjectId) {
      return `Hello! I'm your AI tutor. Let's explore ${topic} together. What would you like to learn about this topic?`;
    }
    if (subjectId) {
      return `Hi there! I'm your AI tutor. I see you're studying this subject. What topic would you like help with?`;
    }
    return `Welcome! I'm your AI tutor. I can help you understand concepts, solve problems, and practice for exams. What would you like to learn today?`;
  }

  private fallbackResponse(context: AiContext): string {
    const message = context.message || '';
    const lower = message.toLowerCase();
    const weakAreas = context.currentPerformance?.weakAreas;

    if (/^(hi|hello|hey|greetings)/.test(lower)) {
      return `Hello${context.name ? ` ${context.name.split(' ')[0]}` : ''}! Ready to learn? I can see ${context.currentPerformance?.weakAreas?.length ? `we should focus on ${weakAreas?.join(', ')}` : 'you\'re making progress'}. What would you like to work on?`;
    }

    if (/help|struggling|confused|don't understand|difficult/.test(lower)) {
      if (weakAreas?.length) {
        return `I see you've been finding ${weakAreas.slice(0, 2).join(' and ')} challenging. Let's break it down together. Can you tell me specifically what's confusing you?`;
      }
      return `I'm here to help! Tell me which concept or problem you're working on.`;
    }

    if (/practice|exercise|problem|question|test me|quiz/.test(lower)) {
      const subject = context.subject || 'this subject';
      if (weakAreas?.length) {
        return `Let's practice ${weakAreas[0]} to strengthen your understanding. Here's a question:\n\n**Question**: Can you explain the key concept in ${weakAreas[0]} and provide an example?\n\nTry answering and I'll give you feedback!`;
      }
      return `Here's a practice question for ${subject}:\n\n**Question**: Based on what you've studied, explain the main concepts and provide a real-world example.\n\nTry answering in your own words!`;
    }

    if (/explain|what is|how does|why does|mean|define|tell me about/.test(lower)) {
      const topicMatch = message.match(/(?:explain|what is|how does|why does|define|tell me about)\s+(.+?)(?:\?|$)/i);
      const topic = topicMatch ? topicMatch[1].trim() : 'this concept';
      const performanceNote = context.currentPerformance?.average !== null && context.currentPerformance?.average !== undefined && context.currentPerformance.average < 50
        ? `\n\nSince you're working to improve, let me explain this in a simple, clear way.`
        : '';
      return `Great question about ${topic}!${performanceNote}\n\n1. **Definition**: ${topic} is an important concept.\n2. **Key Points**: Focus on the core ideas and how they connect.\n3. **Example**: Think about how this applies in practice.\n4. **Practice**: Try working through related problems.\n\nWould you like me to go deeper or give you a practice question?`;
    }

    if (/tired|bored|demotivated|give up|hard|frustrated/.test(lower)) {
      const encouragement = context.currentPerformance?.average !== null && context.currentPerformance?.average !== undefined && context.currentPerformance.average > 50
        ? `Remember, your current average is ${context.currentPerformance.average}% - you're doing well! Keep pushing forward.`
        : `Every expert was once a beginner. Let's take it step by step.`;
      return `${encouragement}\n\n1. **Break it down**: Focus on one small concept at a time\n2. **Take breaks**: Short breaks help learning\n3. **Ask questions**: Every question helps\n\nWhat's one small thing we can work on together?`;
    }

    if (context.currentPerformance?.average !== null && context.currentPerformance?.average !== undefined && context.currentPerformance.average < 50 && weakAreas?.length) {
      return `I can help you improve in ${weakAreas.slice(0, 2).join(' and ')}. Let's start with the basics and build up. Would you like me to:\n1. Explain a concept from ${weakAreas[0]}?\n2. Give you a practice problem?\n3. Create a study plan to improve your ${context.currentPerformance.average}% average?`;
    }

    return `Based on what you've shared, here's my guidance:\n\nApproach this systematically. ${weakAreas?.length ? `Pay extra attention to ${weakAreas[0]} as it's an area for growth.` : 'Start with the fundamentals and build up gradually.'}\n\nWould you like me to:\n1. Explain a specific concept?\n2. Give you a practice problem?\n3. Create a study plan tailored to you?`;
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
