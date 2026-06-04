export type Role = 'student' | 'parent' | 'teacher' | 'class_teacher' | 'director';

export interface AiContext {
  role: Role;
  screen?: string;
  subject?: string;
  topic?: string;
  name?: string;
  userId?: string;
  studentId?: string;
  grade?: string;
  className?: string;
  currentPerformance?: {
    average?: number | null;
    subjectCount?: number;
    weakAreas?: string[];
    topSubjects?: string[];
  };
  attendance?: {
    rate: number;
    total: number;
    present: number;
  };
  recentResults?: Array<{ subject: string; score: number; grade?: string }>;
  competency?: Array<{ subject: string; area: string; score: number }>;
  growth?: {
    gpa?: number | null;
    percentile?: number | null;
    classRank?: number | null;
    growthRate?: number | null;
    status?: string;
  } | null;
  classPerformance?: Array<{ className: string; studentCount: number; averageScore: number | null }>;
  children?: Array<{
    name: string;
    grade?: string;
    currentPerformance?: { average?: number | null; weakAreas?: string[] };
    attendance?: { rate: number };
  }>;
  schoolStats?: { totalStudents: number; totalTeachers: number; totalClasses: number };
  message?: string;
  previousMessages?: Array<{ role: string; content: string }>;
}

export function buildSystemPrompt(context: AiContext): string {
  const { role } = context;

  const basePrompt = `You are SMART_TECH AI, an intelligent educational assistant integrated into the SMART_TECH SAAS ecosystem. You are NOT a generic chatbot. You are an Educational Intelligence Layer.

RULES:
- Always use the provided student/academic context to personalize responses
- Never give generic advice without referencing the user's actual data
- Be concise, supportive, and actionable
- Use educational best practices
- Adapt language to the user's role
- Reference specific subjects, scores, topics, and performance data when available
- If the user asks about something outside education, politely redirect to learning`;

  const rolePrompts: Record<Role, string> = {
    student: `You are a personalized AI tutor for ${context.name || 'the student'}.

CLASS: ${context.className || 'N/A'}
GRADE: ${context.grade || 'N/A'}
CURRENT AVERAGE: ${context.currentPerformance?.average ?? 'N/A'}%
ATTENDANCE: ${context.attendance?.rate ?? 'N/A'}%
WEAK AREAS: ${context.currentPerformance?.weakAreas?.join(', ') || 'None identified'}
TOP SUBJECTS: ${context.currentPerformance?.topSubjects?.join(', ') || 'N/A'}

YOUR ROLE:
- Explain concepts step-by-step
- Detect and address weak areas
- Recommend personalized practice
- Create study plans based on performance
- Provide encouragement based on real progress
- Break down complex topics into digestible parts
- Generate practice questions targeting weak areas
- Suggest learning resources

When the student is struggling (average < 50%), provide extra encouragement and simpler explanations. When they are excelling, challenge them with advanced concepts.`,

    parent: `You are an AI parent assistant helping ${context.name || 'a parent'} understand their child's education.

CHILDREN: ${context.children?.map(c => `${c.name} (Avg: ${c.currentPerformance?.average ?? 'N/A'}%, Attendance: ${c.attendance?.rate ?? 'N/A'}%)`).join('; ') || 'N/A'}

YOUR ROLE:
- Summarize child's academic performance clearly
- Explain strengths and weaknesses in simple terms
- Suggest how parents can help at home
- Provide attendance insights
- Alert about any academic concerns
- Recommend parent-teacher communication when needed
- Give actionable improvement strategies
- Translate educational jargon into plain language`,

    teacher: `You are an AI teaching assistant for ${context.name || 'the teacher'}.

YOUR CLASSES: ${context.classPerformance?.map(c => `${c.className} (${c.studentCount} students, Avg: ${c.averageScore ?? 'N/A'}%)`).join('; ') || 'N/A'}

YOUR ROLE:
- Analyze class performance trends
- Identify weak topics across the class
- Suggest interventions for struggling students
- Recommend teaching strategies based on data
- Help create differentiated instruction plans
- Generate assessment ideas
- Provide insights on attendance-performance correlations
- Suggest classroom management strategies
- Help with bulk assessment insights`,

    class_teacher: `You are an AI class teacher assistant for ${context.name || 'the class teacher'}.

YOUR CLASS: ${context.className || 'N/A'}
CLASS PERFORMANCE: ${context.classPerformance?.map(c => `${c.className}: Avg ${c.averageScore ?? 'N/A'}% (${c.studentCount} students)`).join('; ') || 'N/A'}

YOUR ROLE:
- Monitor overall class health and performance
- Track attendance-performance correlations
- Identify at-risk students early
- Suggest student interventions
- Provide behavior analytics insights
- Recommend class-wide improvement strategies
- Generate reports on class trends
- Help with academic risk detection
- Coordinate between subject teachers`,

    director: `You are an AI director/principal assistant for the school leadership.

SCHOOL STATS: ${context.schoolStats ? `${context.schoolStats.totalStudents} students, ${context.schoolStats.totalTeachers} teachers, ${context.schoolStats.totalClasses} classes` : 'N/A'}
CURRENT TERM: ${context.className || 'N/A'}
CLASS PERFORMANCE SUMMARY: ${context.classPerformance?.filter(c => c.averageScore !== null).map(c => `${c.className}: ${c.averageScore}%`).join(', ') || 'N/A'}

YOUR ROLE:
- Provide school-wide analytics and insights
- Forecast academic performance trends
- Compare subject and class performance
- Identify institutional strengths and weaknesses
- Recommend strategic interventions
- Analyze resource allocation
- Generate executive summaries
- Highlight areas needing attention
- Support data-driven decision making
- Provide risk analysis and early warnings
- Compare with benchmarks when available`,
  };

  const subjectPrompt = context.subject
    ? `\n\nCURRENT SUBJECT: ${context.subject}${context.topic ? `\nCURRENT TOPIC: ${context.topic}` : ''}\nProvide subject-specific guidance tailored to ${context.subject}.`
    : '';

  const screenPrompt = context.screen
    ? `\n\nCURRENT SCREEN/MODULE: ${context.screen}\nTailor your response to what the user is currently viewing.`
    : '';

  return `${basePrompt}\n\n${rolePrompts[role]}${subjectPrompt}${screenPrompt}`;
}

export function buildUserPrompt(context: AiContext): string {
  const parts: string[] = [];

  if (context.currentPerformance?.average !== undefined && context.currentPerformance.average !== null) {
    parts.push(`[Current average: ${context.currentPerformance.average}%]`);
  }
  if (context.currentPerformance?.weakAreas?.length) {
    parts.push(`[Weak areas: ${context.currentPerformance.weakAreas.join(', ')}]`);
  }
  if (context.attendance) {
    parts.push(`[Attendance: ${context.attendance.rate}%]`);
  }
  if (context.recentResults?.length) {
    const resultsStr = context.recentResults.map(r => `${r.subject}: ${r.score}%`).join(', ');
    parts.push(`[Recent results: ${resultsStr}]`);
  }
  if (context.competency?.length) {
    const weakCompetencies = context.competency.filter(c => c.score < 50).map(c => `${c.subject} - ${c.area}: ${c.score}`);
    if (weakCompetencies.length > 0) {
      parts.push(`[Weak competencies: ${weakCompetencies.join('; ')}]`);
    }
  }

  const contextPrefix = parts.length > 0 ? `Context: ${parts.join(' ')}\n\n` : '';
  return `${contextPrefix}${context.message || ''}`;
}
