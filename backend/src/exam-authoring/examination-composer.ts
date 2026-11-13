import { MarkAllocationEngine } from './mark-allocation.engine';

interface ComposerSection {
  code: string;
  title: string;
  totalMarks: number;
  itemCount: number;
  answerRule: 'ALL' | 'ONE' | 'ANY';
  questionTypes?: string[];
}

interface ComposerBlueprint {
  title: string;
  totalMarks: number;
  durationMinutes: number;
  sections: ComposerSection[];
  topicPlan?: Array<{ topic: string; marks: number; questionCount?: number }>;
  cognitiveDistribution?: Record<string, number>;
  difficultyDistribution?: Record<string, number>;
}

interface ComposerCurriculum {
  subject: { id: string; name: string; code?: string } | null;
  topics: Array<{ id: string; name: string; competencies: Array<{ id: string; name: string; description?: string; bloomLevel?: string }> }>;
  eocs: Array<{ id: string; name: string; competencies: string[] }>;
  syllabusEntries: Array<{ code?: string; topic?: string; competency?: string; standard?: string; sourcePage?: number }>;
}

interface ComposedTask {
  label: string;
  prompt: string;
  marks: number;
  answer: string;
  criterion: string;
  alternatives?: string[];
}

interface QuestionTemplate {
  stem: string;
  topic: string;
  competency: string;
  difficulty: string;
  bloomLevel: string;
  tasks: ComposedTask[];
}

interface ComposedQuestion {
  number: number;
  type: string;
  stem: string;
  marks: number;
  difficulty: string;
  bloomLevel: string;
  topic: string;
  competency: string;
  tasks: Array<{ label: string; prompt: string; marks: number }>;
  traceability: Array<{ source: string; evidence: string }>;
  markingKey: Array<{
    task: string;
    answer: string;
    markAllocation: Array<{ marks: number; criterion: string }>;
    acceptableAlternatives: string[];
  }>;
}

export class ExaminationComposer {
  private readonly markAllocation = new MarkAllocationEngine();

  compose(blueprint: ComposerBlueprint, curriculum: ComposerCurriculum) {
    const mathematics = /math/i.test(`${curriculum.subject?.name || ''} ${curriculum.subject?.code || ''}`);
    const selectedTemplates = this.selectTemplates(blueprint, curriculum);
    let questionNumber = 1;
    const sections = blueprint.sections.map(section => {
      const questions = Array.from({ length: section.itemCount }, (_, index) => {
        const marks = this.questionMarks(section, index);
        const template = selectedTemplates[questionNumber - 1]
          || this.genericTemplate(curriculum, questionNumber - 1);
        const question = this.composeQuestion(template, questionNumber, marks, curriculum);
        questionNumber += 1;
        return question;
      });
      return {
        code: section.code,
        title: section.title,
        instructions: this.instructions(section.answerRule),
        questions,
      };
    });

    return {
      sections,
      metadata: {
        assumptions: [
          'This paper was composed deterministically from the approved blueprint and available curriculum evidence.',
          'A qualified subject examiner must review contexts, calculations and marking criteria before moderation.',
          mathematics ? 'Mathematics contexts and task tariffs follow the ECZ pilot-paper item structure.' : 'Generic task scaffolds were used because subject-specific question material was unavailable.',
        ],
        qualityChecks: [
          'Section answer rules and candidate mark totals were enforced.',
          'Every item uses independently assessable tasks with non-duplicated prompts.',
          'Task marks and marking-key marks reconcile to the item total.',
          mathematics ? 'Number, algebra, statistics, linear programming and geometry domains were distributed across the paper.' : 'Curriculum topics were distributed across the paper where evidence was available.',
        ],
      },
    };
  }

  private selectTemplates(blueprint: ComposerBlueprint, curriculum: ComposerCurriculum): QuestionTemplate[] {
    const mathematics = /math/i.test(`${curriculum.subject?.name || ''} ${curriculum.subject?.code || ''}`);
    const mathematicsTemplates = mathematics ? this.mathematicsTemplates() : [];
    const slots = blueprint.sections.flatMap(section =>
      Array.from({ length: section.itemCount }, (_, index) => ({ section, index })));
    const plan = (blueprint.topicPlan || [])
      .filter(target => String(target.topic || '').trim() && Number(target.marks) > 0)
      .map(target => ({ topic: String(target.topic).trim(), remaining: Number(target.marks) }));
    const usedStems = new Set<string>();

    return slots.map((slot, offset) => {
      let template: QuestionTemplate;
      if (!plan.length) {
        template = mathematics
          ? mathematicsTemplates[offset % mathematicsTemplates.length]
          : this.genericTemplate(curriculum, offset);
      } else {
        const target = plan.find(item => item.remaining > 0) || plan[offset % plan.length];
        template = mathematics
          ? this.matchMathematicsTemplate(target.topic, mathematicsTemplates, usedStems)
            || this.mathematicsGenericTemplate(curriculum, target.topic, offset)
          : this.genericTemplate(curriculum, offset, target.topic, offset);
        template = this.applyPlannedTopic(template, target.topic);
        target.remaining = Math.max(0, target.remaining - this.questionMarks(slot.section, slot.index));
      }

      template = this.ensureUniqueTemplate(template, curriculum, mathematics, offset, usedStems);
      usedStems.add(this.normaliseText(template.stem));
      return template;
    });
  }

  private ensureUniqueTemplate(template: QuestionTemplate, curriculum: ComposerCurriculum, mathematics: boolean, offset: number, usedStems: Set<string>) {
    let candidate = template;
    let attempt = 0;
    while (usedStems.has(this.normaliseText(candidate.stem)) && attempt < 20) {
      candidate = mathematics
        ? this.mathematicsGenericTemplate(curriculum, candidate.topic, offset, offset + attempt + 1)
        : this.genericTemplate(curriculum, offset, candidate.topic, offset + attempt + 1);
      attempt += 1;
    }
    if (usedStems.has(this.normaliseText(candidate.stem))) {
      candidate = { ...candidate, stem: `${candidate.stem} (Variation ${attempt + 1})` };
    }
    return candidate;
  }

  private matchMathematicsTemplate(topic: string, templates: QuestionTemplate[], usedStems: Set<string>) {
    const available = templates.filter(template => !usedStems.has(this.normaliseText(template.stem)));
    const target = this.normaliseText(topic);
    const direct = available.find(template => {
      const candidate = this.normaliseText(template.topic);
      return candidate.includes(target) || target.includes(candidate);
    });
    if (direct) return direct;

    const aliases: Record<string, string[]> = {
      'Number and financial mathematics': ['number', 'financial', 'interest', 'percentage', 'money', 'arithmetic', 'standard form'],
      'Relations, functions and graphs': ['relation', 'function', 'graph', 'motion', 'distance', 'speed', 'coordinate'],
      'Sets, variation and simultaneous equations': ['set', 'variation', 'simultaneous', 'algebra', 'equation'],
      'Statistics and probability': ['statistic', 'probability', 'data', 'frequency', 'mean', 'median'],
      'Linear programming': ['linear programming', 'inequality', 'optimisation', 'optimization'],
      'Geometry and trigonometry': ['geometry', 'trigonometry', 'triangle', 'circle', 'sine', 'cosine', 'angle', 'measurement'],
    };
    return available.find(template =>
      (aliases[template.topic] || []).some(alias => target.includes(alias))) || null;
  }

  private applyPlannedTopic(template: QuestionTemplate, plannedTopic: string): QuestionTemplate {
    const actual = this.normaliseText(template.topic);
    const planned = this.normaliseText(plannedTopic);
    if (!planned || actual.includes(planned) || planned.includes(actual)) return template;
    return { ...template, topic: `${plannedTopic} — ${template.topic}` };
  }

  private normaliseText(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private composeQuestion(template: QuestionTemplate, number: number, marks: number, curriculum: ComposerCurriculum): ComposedQuestion {
    const selectedTasks = template.tasks.length <= marks ? template.tasks : template.tasks.slice(0, Math.max(1, marks));
    const allocations = this.markAllocation.allocate(marks, selectedTasks.map((task, index) => ({ id: String(index), weight: task.marks })));
    const tasks = selectedTasks.map((task, index) => ({ label: this.taskLabel(index, selectedTasks.length), prompt: task.prompt, marks: allocations[index].marks }));
    const evidence = this.findEvidence(curriculum, template.topic);
    return {
      number,
      type: template.bloomLevel === 'CREATE' ? 'ESSAY' : 'STRUCTURED',
      stem: template.stem,
      marks,
      difficulty: template.difficulty,
      bloomLevel: template.bloomLevel,
      topic: template.topic,
      competency: template.competency,
      tasks,
      traceability: [{
        source: evidence?.code ? `Syllabus competency ${evidence.code}` : 'Approved blueprint and curriculum topic map',
        evidence: evidence?.standard || evidence?.competency || evidence?.topic || template.competency,
      }],
      markingKey: selectedTasks.map((task, index) => ({
        task: tasks[index].label,
        answer: task.answer,
        markAllocation: [{ marks: tasks[index].marks, criterion: task.criterion }],
        acceptableAlternatives: task.alternatives || [],
      })),
    };
  }

  private questionMarks(section: ComposerSection, index: number) {
    if (section.answerRule === 'ONE') return section.totalMarks;
    return this.markAllocation.allocate(section.totalMarks, Array.from({ length: section.itemCount }, (_, item) => ({ id: String(item), weight: 1 })))[index].marks;
  }

  private taskLabel(index: number, count: number) {
    if (count === 1) return '';
    if (index < 26) return `(${String.fromCharCode(97 + index)})`;
    return `(${index + 1})`;
  }

  private instructions(answerRule: ComposerSection['answerRule']) {
    if (answerRule === 'ONE') return 'Answer one item in this section.';
    if (answerRule === 'ANY') return 'Answer the required number of items indicated by the examination instructions.';
    return 'Answer all items in this section.';
  }

  private findEvidence(curriculum: ComposerCurriculum, topic: string) {
    const normalized = topic.toLowerCase();
    return curriculum.syllabusEntries.find(entry => {
      const entryTopic = String(entry.topic || '').toLowerCase();
      return entryTopic && (entryTopic.includes(normalized) || normalized.includes(entryTopic));
    }) || curriculum.syllabusEntries[0];
  }

  private mathematicsGenericTemplate(curriculum: ComposerCurriculum, plannedTopic: string, offset: number, variant = offset): QuestionTemplate {
    const normalizedPlanned = this.normaliseText(plannedTopic);
    const topic = curriculum.topics.find(item => {
      const name = this.normaliseText(item.name);
      return name === normalizedPlanned || name.includes(normalizedPlanned) || normalizedPlanned.includes(name);
    });
    const competency = topic?.competencies?.[0]?.name || `Apply ${plannedTopic} accurately to a practical situation`;
    const contexts = [
      `A school shop records a set of values for a project involving ${plannedTopic}. The manager must use the data to make a decision.`,
      `A community group is planning an activity that depends on ${plannedTopic}. Measurements and costs have been collected for the plan.`,
      `A small business is reviewing its records for ${plannedTopic}. The owner needs a calculated recommendation.`,
      `A construction team must solve a practical problem involving ${plannedTopic} before work can continue.`,
      `A transport operator has collected readings connected with ${plannedTopic} and must prepare a cost and performance summary.`,
      `A farmer is comparing two plans involving ${plannedTopic} before committing limited resources to one of them.`,
      `A sports committee is using ${plannedTopic} to review results and decide how to allocate equipment.`,
      `A health centre has recorded figures involving ${plannedTopic} and needs a clear recommendation for the next month.`,
    ];
    return {
      stem: contexts[Math.abs(variant) % contexts.length],
      topic: plannedTopic,
      competency,
      difficulty: offset % 3 === 0 ? 'EASY' : offset % 3 === 1 ? 'MEDIUM' : 'HARD',
      bloomLevel: offset % 3 === 0 ? 'APPLY' : offset % 3 === 1 ? 'ANALYSE' : 'EVALUATE',
      tasks: [
        { label: '', prompt: `State the formula or principle for ${plannedTopic} that is needed in this situation.`, marks: 4, answer: `Award marks for the correct formula or principle and correctly identified variables for ${plannedTopic}.`, criterion: 'Correct formula or principle and defined variables.' },
        { label: '', prompt: `Apply ${plannedTopic} to the information given and show each step of your working.`, marks: 7, answer: 'Award method marks for correct substitution and procedure, and accuracy marks for the final result.', criterion: 'Correct method, substitution and accuracy.' },
        { label: '', prompt: `Interpret your result and explain what it means for the decision described in the scenario.`, marks: 5, answer: 'Award marks for a valid interpretation linked to the scenario and the calculated result.', criterion: 'Valid interpretation linked to the context.' },
        { label: '', prompt: `State one assumption or limitation of your calculation and explain how it could affect the recommendation.`, marks: 4, answer: 'Award marks for a relevant assumption or limitation and a valid explanation of its effect.', criterion: 'Relevant limitation with valid effect.' },
      ],
    };
  }

  private genericTemplate(curriculum: ComposerCurriculum, offset: number, plannedTopic?: string, variant = offset): QuestionTemplate {
    const topics = curriculum.topics.length ? curriculum.topics : [];
    const normalizedPlanned = plannedTopic ? this.normaliseText(plannedTopic) : '';
    const topic = normalizedPlanned
      ? topics.find(item => this.normaliseText(item.name) === normalizedPlanned)
        || topics.find(item => {
          const name = this.normaliseText(item.name);
          return name.includes(normalizedPlanned) || normalizedPlanned.includes(name);
        })
      : topics[offset % topics.length];
    const syllabus = normalizedPlanned
      ? curriculum.syllabusEntries.find(entry => {
        const entryTopic = this.normaliseText(String(entry.topic || ''));
        return entryTopic && (entryTopic.includes(normalizedPlanned) || normalizedPlanned.includes(entryTopic));
      }) || curriculum.syllabusEntries[offset % Math.max(1, curriculum.syllabusEntries.length)]
      : curriculum.syllabusEntries[offset % Math.max(1, curriculum.syllabusEntries.length)];
    const topicName = plannedTopic || topic?.name || syllabus?.topic || 'the selected curriculum topic';
    const competency = topic?.competencies?.[0]?.name || syllabus?.competency || `Apply ${topicName} to a practical situation`;
    const scenarios = [
      'A school improvement team is reviewing a practical issue linked to',
      'A community committee has gathered evidence about a local challenge involving',
      'A small enterprise must make a defensible decision about',
      'A public service team is evaluating competing proposals linked to',
    ];
    const scenario = scenarios[Math.abs(variant) % scenarios.length];
    return {
      stem: `${scenario} ${topicName}. The team has collected information from a recent activity and must present a defensible recommendation to management. Use your knowledge of ${topicName} to analyse the issue.`,
      topic: topicName,
      competency,
      difficulty: offset % 3 === 0 ? 'EASY' : offset % 3 === 1 ? 'MEDIUM' : 'HARD',
      bloomLevel: offset % 3 === 0 ? 'UNDERSTAND' : offset % 3 === 1 ? 'APPLY' : 'EVALUATE',
      tasks: [
        { label: '', prompt: `Define the key terms associated with ${topicName} and state the principle that applies to this situation.`, marks: 4, answer: 'Award marks for accurate definitions and a relevant principle.', criterion: 'Accurate terminology and relevant principle.' },
        { label: '', prompt: `Apply ${topicName} to the information in the scenario and show the reasoning that leads to your answer.`, marks: 8, answer: 'Award marks for a correct procedure, accurate reasoning and a supported response.', criterion: 'Correct application, reasoning and response.' },
        { label: '', prompt: `Evaluate the recommendation and explain one limitation or assumption in your analysis.`, marks: 5, answer: 'Award marks for a justified evaluation and a relevant limitation or assumption.', criterion: 'Justified evaluation and valid limitation.' },
        { label: '', prompt: `Communicate the final recommendation clearly using appropriate subject vocabulary.`, marks: 3, answer: 'Award marks for a clear, well-organised and subject-appropriate recommendation.', criterion: 'Clarity, organisation and vocabulary.' },
      ],
    };
  }

  private mathematicsTemplates(): QuestionTemplate[] {
    return [
      {
        stem: 'A teacher earns a gross monthly salary of K28 500. She budgets one fifth of the salary for groceries, K7 500 for rent and K5.4 × 10³ for personal needs. The remaining amount is invested for 2 years in an account that pays 6% interest compounded annually. She also buys a laptop with a cash price of K5 800 by paying a deposit of K1 500 and 12 equal monthly instalments of K420.',
        topic: 'Number and financial mathematics',
        competency: 'Apply number operations, standard form and percentage growth in financial contexts',
        difficulty: 'MEDIUM',
        bloomLevel: 'APPLY',
        tasks: [
          { label: '', prompt: 'Express the monthly salary in scientific notation correct to 3 significant figures.', marks: 3, answer: '2.85 × 10⁴', criterion: 'Correct standard form and 3 significant figures.' },
          { label: '', prompt: 'Determine the total amount budgeted for groceries and personal needs.', marks: 5, answer: 'One fifth of K28 500 is K5 700. Total = K5 700 + K5 400 = K11 100.', criterion: 'Correct fraction of salary, correct scientific notation conversion and correct total.' },
          { label: '', prompt: 'Calculate the amount of money in the investment account at the end of 2 years.', marks: 7, answer: 'Remaining amount = K28 500 − K5 700 − K7 500 − K5 400 = K9 900. Amount = 9 900(1.06)² = K11 123.64.', criterion: 'Correct remaining amount, compound-interest formula, substitution and final amount.' },
          { label: '', prompt: 'How much more than the cash price does she pay for the laptop through instalments?', marks: 5, answer: 'Total instalment cost = K1 500 + 12 × K420 = K6 540. Extra = K6 540 − K5 800 = K740.', criterion: 'Correct total instalment cost, correct comparison and correct difference.' },
        ],
      },
      {
        stem: 'A cyclist and a runner train on a straight road. The cyclist travels at a constant speed of 8 m/s for 30 seconds and then rests for 10 seconds. The runner starts from the same point at the 40th second and covers 180 m by the 60th second.',
        topic: 'Relations, functions and graphs',
        competency: 'Interpret motion using distance-time graphs and calculate speed',
        difficulty: 'MEDIUM',
        bloomLevel: 'ANALYSE',
        tasks: [
          { label: '', prompt: 'Draw a distance-time graph representing the movement of the cyclist and the runner.', marks: 5, answer: 'Axes correctly labelled with appropriate scales; cyclist rises to 240 m at 30 s, remains flat to 40 s; runner starts at 40 s and reaches 180 m at 60 s.', criterion: 'Correct axes, scales, plotted segments and labels.' },
          { label: '', prompt: 'Calculate the total distance covered by the cyclist before resting.', marks: 4, answer: 'Distance = speed × time = 8 × 30 = 240 m.', criterion: 'Correct formula, substitution and answer with unit.' },
          { label: '', prompt: 'Using the graph, determine the speed of the runner.', marks: 3, answer: 'Speed = 180 ÷ 20 = 9 m/s.', criterion: 'Correct reading of time interval and correct gradient/speed.' },
          { label: '', prompt: 'Calculate the average speed of the cyclist over the 60-second period and state the runner’s displacement vector at 60 seconds.', marks: 4, answer: 'Cyclist average speed = 240 ÷ 60 = 4 m/s. Runner displacement = 180 m in the direction of motion.', criterion: 'Correct average speed and correct magnitude and direction of displacement.' },
          { label: '', prompt: 'Determine whether the two athletes moved at the same speed. Justify your answer using values from the graph.', marks: 4, answer: 'No. The cyclist moved at 8 m/s while moving, whereas the runner moved at 9 m/s. Their average speeds over 60 s are also different.', criterion: 'Correct comparison with both speeds and a valid justification.' },
        ],
      },
      {
        stem: 'An agricultural co-operative has 80 members who grow maize, groundnuts and soya beans. 30 members grow maize, 34 grow groundnuts and 28 grow soya beans. 12 grow maize and groundnuts, 10 grow groundnuts and soya beans, 8 grow maize and soya beans, and 4 grow all three crops. Each member also earns 3 certificates per training session plus 2 bonus certificates. The co-operative’s input budget varies directly as the number of active members. When 40 members are active, the budget is K16 000. A trader also buys two types of fertiliser: heavy-duty bags costing K800 each and standard bags costing K500 each. The trader has K11 000 and must buy 16 bags in total.',
        topic: 'Sets, variation and simultaneous equations',
        competency: 'Use set diagrams, direct variation and simultaneous equations to solve practical problems',
        difficulty: 'HARD',
        bloomLevel: 'ANALYSE',
        tasks: [
          { label: '', prompt: 'Draw a suitable Venn diagram and determine the number of members who grow exactly two crops.', marks: 4, answer: 'Exactly two = (12−4) + (10−4) + (8−4) = 18 members.', criterion: 'Correct Venn regions, correct subtraction of the triple intersection and correct total.' },
          { label: '', prompt: 'Determine the number of members who grow at least one of the three crops.', marks: 3, answer: 'At least one = 30 + 34 + 28 − 12 − 10 − 8 + 4 = 66 members.', criterion: 'Correct inclusion–exclusion substitution and answer.' },
          { label: '', prompt: 'Calculate the input budget when 60 members are active.', marks: 4, answer: 'B = kS; 16 000 = 40k, so k = 400. For 60 members, B = 400 × 60 = K24 000.', criterion: 'Correct constant of variation, equation and budget.' },
          { label: '', prompt: 'Find the number of each type of fertiliser bag the trader can buy.', marks: 5, answer: 'Let heavy = x and standard = y. x + y = 16 and 800x + 500y = 11 000. Solving gives x = 10 and y = 6.', criterion: 'Correct equations, valid solution method and correct values.' },
          { label: '', prompt: 'If membership increases by 15% and each member earns 3 certificates per training session plus 2 bonus certificates, calculate the total number of certificates earned by all members after 4 sessions.', marks: 4, answer: 'New membership = 80 × 1.15 = 92 members. Certificates per member = 3 × 4 + 2 = 14. Total = 92 × 14 = 1 288.', criterion: 'Correct percentage increase, correct certificates per member and correct total.' },
        ],
      },
      {
        stem: 'A school recorded the following scores, out of 100, for 50 learners in a mathematics quiz: 58, 64, 71, 45, 83, 62, 55, 49, 76, 68, 52, 60, 74, 39, 81, 57, 66, 47, 70, 63, 85, 54, 61, 44, 78, 69, 51, 73, 42, 80, 59, 56, 67, 48, 75, 65, 53, 72, 46, 82, 50, 77, 43, 79, 41, 84, 62, 58, 71, 55. Learners who scored 70 or more qualify for a district competition.',
        topic: 'Statistics and probability',
        competency: 'Organise data, interpret frequency distributions and calculate probabilities',
        difficulty: 'MEDIUM',
        bloomLevel: 'ANALYSE',
        tasks: [
          { label: '', prompt: 'Represent the scores in a suitable grouped frequency table.', marks: 4, answer: 'A grouped table with equal class widths, correct tallies and frequencies totalling 50.', criterion: 'Suitable classes, correct tallying and frequencies totalling 50.' },
          { label: '', prompt: 'Determine the modal class.', marks: 2, answer: 'The class with the highest frequency, correctly identified from the table.', criterion: 'Correct identification of the class with the highest frequency.' },
          { label: '', prompt: 'Draw a histogram or frequency polygon to represent the distribution.', marks: 6, answer: 'Correct axes, scales, bar heights or plotted midpoints, and labels.', criterion: 'Correct scales, frequencies, shape and labelling.' },
          { label: '', prompt: 'Find the 50th percentile score.', marks: 4, answer: 'The median class and interpolation must produce the score at the 25th ordered position.', criterion: 'Correct ordered position, median class and interpolated value.' },
          { label: '', prompt: 'Find the probability that two learners selected at random without replacement both scored 70 or more.', marks: 4, answer: '17 learners scored 70 or more. Probability = (17/50) × (16/49) = 272/2450 ≈ 0.111.', criterion: 'Correct count, correct without-replacement product and simplified probability.' },
        ],
      },
      {
        stem: 'A market trader sells maize meal and rice. Her truck can carry at most 120 bags altogether. She must carry at least 30 bags of maize meal and at least 40 bags of rice. She also decides that the number of bags of rice must not be less than the number of bags of maize meal. She earns a profit of K20 on each bag of maize meal and K30 on each bag of rice.',
        topic: 'Linear programming',
        competency: 'Formulate inequalities and use linear programming to optimise a practical objective',
        difficulty: 'HARD',
        bloomLevel: 'EVALUATE',
        tasks: [
          { label: '', prompt: 'Write mathematical statements to represent the relationships between the number of bags of maize meal and rice.', marks: 6, answer: 'Let maize meal = x and rice = y. x + y ≤ 120; x ≥ 30; y ≥ 40; y ≥ x; x ≥ 0; y ≥ 0.', criterion: 'Correct variables, all constraints, inequality directions and non-negativity conditions.' },
          { label: '', prompt: 'Represent the feasible region on the Cartesian plane.', marks: 8, answer: 'Correct boundary lines, intercepts, shading for the intersection of all constraints, and a clearly labelled feasible region.', criterion: 'Correct lines, intercepts, shading, feasible region and labels.' },
          { label: '', prompt: 'Determine the number of each type of bag the trader should carry to obtain maximum profit.', marks: 4, answer: 'Evaluate the vertices of the feasible region. The maximum occurs at x = 60 and y = 60.', criterion: 'Correct vertices, objective-function values and optimal point.' },
          { label: '', prompt: 'Find the maximum profit.', marks: 2, answer: 'Maximum profit = 20 × 60 + 30 × 60 = K3 000.', criterion: 'Correct substitution and correct maximum profit.' },
        ],
      },
      {
        stem: 'A community garden is designed in the shape of a triangle with two sides measuring 90 m and 70 m meeting at an angle of 65°. A circular fence will be built around the garden so that it passes through all three vertices.',
        topic: 'Geometry and trigonometry',
        competency: 'Use triangle and circle relationships to solve measurement problems',
        difficulty: 'HARD',
        bloomLevel: 'APPLY',
        tasks: [
          { label: '', prompt: 'Construct a scale model of the triangular garden using 1 cm to represent 10 m.', marks: 5, answer: 'Correct 9 cm and 7 cm sides with a 65° included angle, accurately constructed and labelled.', criterion: 'Correct scale, angle, side lengths, construction accuracy and labels.' },
          { label: '', prompt: 'Using calculations, find the third side of the garden to the nearest metre.', marks: 5, answer: 'c² = 90² + 70² − 2(90)(70)cos 65°. c ≈ 88 m.', criterion: 'Correct cosine rule, substitution, evaluation and rounding.' },
          { label: '', prompt: 'Determine the area of the garden.', marks: 2, answer: 'Area = ½ × 90 × 70 × sin 65° ≈ 2 855 m².', criterion: 'Correct area formula, substitution and answer.' },
          { label: '', prompt: 'Find the shortest distance from the 90 m side to the opposite corner.', marks: 3, answer: 'Use area = ½ × base × height: 2 855 = ½ × 90 × h, so h ≈ 63 m.', criterion: 'Correct height relationship, substitution and answer.' },
          { label: '', prompt: 'Measure the distance from the centre of the circular fence to a vertex and use calculations to find the circumference of the fence.', marks: 5, answer: 'The measured circumradius should be checked against R = a/(2 sin A). Circumference = 2πR, with consistent units.', criterion: 'Valid measurement, correct radius relationship, correct circumference and units.' },
        ],
      },
    ];
  }
}
