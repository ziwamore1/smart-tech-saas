# Smart Timetable Engine 🚀

A comprehensive school timetable generation system built with Node.js, designed to rival systems like aSc Timetable.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Core Entities](#core-entities)
4. [Generation API](#generation-api)
5. [Rule Engine](#rule-engine)
6. [Solver Engine](#solver-engine)
7. [Optimization](#optimization)
8. [UI Components](#ui-components)
9. [Multi-tenant Support](#multi-tenant-support)
10. [Onboarding](#onboarding)
11. [Pricing Tiers](#pricing-tiers)

---

## Quick Start

```typescript
import { generateTimetable } from './src/timetable-engine/entities/api';

const result = await generateTimetable({
  classes: [
    { id: 'form2a', name: 'Form 2A', capacity: 40 },
    { id: 'form2b', name: 'Form 2B', capacity: 35 }
  ],
  teachers: [
    { id: 't1', name: 'Mr. John', employeeNo: 'EMP001', subjects: ['math'] },
    { id: 't2', name: 'Mrs. Smith', employeeNo: 'EMP002', subjects: ['eng'] }
  ],
  subjects: [
    { id: 'math', name: 'Mathematics', code: 'MATH' },
    { id: 'eng', name: 'English', code: 'ENG' }
  ],
  rooms: [
    { id: 'r1', name: 'Room 101', capacity: 40 }
  ],
  lessons: [
    { id: 'l1', classId: 'form2a', subjectId: 'math', teacherId: 't1', requiredPerWeek: 5 },
    { id: 'l2', classId: 'form2a', subjectId: 'eng', teacherId: 't2', requiredPerWeek: 4 }
  ]
});

console.log(result.success);        // boolean
console.log(result.schedule);      // ScheduleEntry[]
console.log(result.score);        // number (quality score)
console.log(result.violations);  // ConstraintViolation[]
```

---

## Architecture Overview

```
src/timetable-engine/
├── entities/              # Core business logic
│   ├── api.ts            # Main generation API
│   ├── solver.ts          # CSP solver with O(1) conflicts
│   ├── scoring.ts        # Soft constraint scoring
│   ├── genetic.ts       # Genetic algorithm optimizer
│   ├── rules.ts        # Rule engine
│   ├── conflictDetector.ts # Move + auto-fix
│   ├── fastState.ts     # Bitmask optimization
│   ├── hybridSolver.ts # Smart strategy selection
│   └── cache.ts        # LRU caching
│
├── ui/                   # React components
│   ├── components/       # RuleBuilder, RuleList
│   └── editor/          # TimetableGrid drag-drop
│
└── onboarding/           # Setup wizard
    ├── wizard.ts       # 5-step wizard state
    └── conflictFixer.ts # Guided conflict fixing
```

---

## Core Entities

```typescript
import { 
  ClassEntity, TeacherEntity, SubjectEntity, RoomEntity,
  TimeslotEntity, LessonEntity, ScheduleEntry, ExpandedLesson,
  generateTimeslots 
} from './src/timetable-engine/entities';

// Generate timeslots (5 days × 8 periods = 40 slots)
const timeslots = generateTimeslots({ days: 5, periods: 8 });

// Lesson requires 5 periods per week → expands to 5 individual lessons
import { expandLessons } from './src/timetable-engine/entities/preprocessor';

const lessons = expandLessons([
  { classId: 'form2a', subjectId: 'math', teacherId: 't1', lessonsPerWeek: 5 }
]);
// Result: 5 ExpandedLesson objects
```

---

## Generation API

The main entry point for timetable generation:

```typescript
import { generateTimetable, GenerateTimetableResponse } from './entities/api';

const result = await generateTimetable(input: GenerateTimetableRequest, options?: {
  useBacktracking?: boolean;
  maxIterations?: number;
  maxTime?: number;
}): Promise<GenerateTimetableResponse>

interface GenerateTimetableResponse {
  success: boolean;
  schedule: ScheduleEntry[];
  score: number;
  method: string;       // 'CSP' | 'Genetic' | 'Fallback'
  iterations: number;
  unassigned: string[];
  violations: ConstraintViolation[];
  errors: string[];
  warnings: string[];
  statistics: {
    totalClasses: number;
    totalTeachers: number;
    totalLessons: number;
    totalSlots: number;
  };
}
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `useBacktracking` | `true` | Use CSP backtracking |
| `maxIterations` | `5000` | Max CSP iterations |
| `maxTime` | `60000` | Max solve time (ms) |

---

## Rule Engine

### Built-in Rules

```typescript
import { RuleEngine, RuleConfig } from './entities/rules';

const engine = new RuleEngine();

// Load rules from config
const configs: RuleConfig[] = [
  { type: 'HARD', name: 'NoTeacherClash' },
  { type: 'HARD', name: 'NoClassClash' },
  { type: 'SOFT', name: 'TeacherGaps', weight: 3 },
  { type: 'SOFT', name: 'PreferMorning', weight: 5 }
];

engine.loadRules(configs);

// Evaluate hard constraints
const hardResult = engine.evaluateHard({ 
  state, lesson, timeslot 
});
console.log(hardResult.valid);  // boolean

// Evaluate soft constraints (scoring)
const softResult = engine.evaluateSoft({ schedule });
console.log(softResult.penalty);    // number
console.log(softResult.breakdown); // { ruleName: penalty }
```

### Available Rules

| Rule | Type | Description |
|------|------|-------------|
| `NoTeacherClash` | HARD | Teacher can't be double-booked |
| `NoClassClash` | HARD | Class can't have 2 lessons at once |
| `NoRoomClash` | HARD | Room can't be double-booked |
| `TeacherMaxLessonsPerDay` | HARD | Max 5 lessons/day/teacher |
| `ClassMaxLessonsPerDay` | HARD | Max 6 lessons/day/class |
| `TeacherGaps` | SOFT | Penalize idle periods |
| `SubjectRepetition` | SOFT | Penalize same subject repeated |
| `PreferMorning` | SOFT | Bonus for morning lessons |

---

## Solver Engine

### Features

- **O(1) Conflict Detection**: Using HashMaps for instant lookup
- **MRV Heuristic**: Most Constrained Variable first
- **Forward Checking**: Prune impossible branches early
- **Bitmask Optimization**: 100x faster for large datasets

```typescript
import { 
  solveCSP, 
  SolverState, 
  SolverOptions 
} from './entities/solver';

const result = solveCSP(lessons, timeslots, {
  maxIterations: 5000,
  maxTime: 60000,
  enableForwardCheck: true,
  enableMRV: true,
  enableDomainOrdering: true,
  enableScoring: true,
  findBest: true
});

console.log(result.schedule);
console.log(result.iterations);
console.log(result.backtracks);
```

---

## Optimization

### Genetic Algorithm

```typescript
import { runGeneticAlgorithm, defaultGeneticConfig } from './entities/genetic';

const result = runGeneticAlgorithm(
  lessons,
  timeslots,
  {
    populationSize: 50,
    generations: 200,
    mutationRate: 0.15,
    eliteSize: 5
  },
  weights,  // ScoringWeights
  (gen, score) => console.log(`Gen ${gen}: ${score}`)
);
```

### Simulated Annealing

```typescript
import { createSimulatedAnnealingOptimizer } from './entities/annealing';

const annealing = createSimulatedAnnealingOptimizer(timeslots, context)
  .configure({ initialTemp: 1000, coolingRate: 0.995 });

const optimized = annealing.optimize(initialSchedule);
```

---

## UI Components

### Rule Builder UI

```typescript
import { RuleBuilder, RuleList, RULE_TEMPLATES } from './ui/components';

function RuleManager() {
  const [rules, setRules] = useState<UserRule[]>([]);

  return (
    <RuleList
      rules={rules}
      onSaveRule={saveRule}
      onDeleteRule={deleteRule}
      onToggleRule={toggleRule}
    />
  );
}
```

### Timetable Grid Editor

```typescript
import { TimetableGrid } from './ui/editor';
import { detectConflicts, autoFix } from './entities/conflictDetector';

function TimetableEditor({ schedule, onChange }) {
  const handleAutoFix = () => {
    const fixResult = autoFix(schedule, timeslots);
    onChange(fixResult.schedule);
  };

  return (
    <TimetableGrid
      schedule={schedule}
      lessons={lessons}
      timeslots={timeslots}
      onScheduleChange={onChange}
    />
  );
}
```

---

## Multi-tenant Support

### School Isolation

```typescript
import { SchoolGuard } from './src/auth/guards/school-guard.guard';

// All routes are protected by school context
@Controller('timetable/:schoolId')
@UseGuards(SchoolGuard)
export class TimetableController {
  @Post('generate')
  async generate(@Req() req) {
    const schoolId = req.schoolId;  // Auto-attached
    // ... generation logic
  }
}
```

### Queue Processing

```typescript
import { TimetableQueueService } from './src/timetable/solver/timetable-queue.service';

// Jobs run in background, progress broadcasted via WebSocket
const jobId = await queueService.addGenerationJob({
  schoolId: 'school_123',
  termId: 'term_2024',
  requestedBy: 'user_456'
});
```

---

## Onboarding

### Setup Wizard

```typescript
import { WIZARD_STEPS, getStepProgress } from './onboarding/wizard';

// 5-step wizard
const steps = WIZARD_STEPS.map(s => s.name);
// ['School Structure', 'Classes', 'Teachers', 'Subjects', 'Lesson Requirements']

// Progress tracking
const progress = getStepProgress(3);
// { completed: 2, total: 5, percent: 40 }
```

### Smart Defaults

```typescript
import { getSmartDefaults } from './onboarding/wizard';

const defaults = getSmartDefaults();
// Pre-populates common subjects: Math, English, Biology, etc.
```

---

## Pricing Tiers

| Tier | Price | Lessons | Features |
|------|-------|---------|----------|
| Free | $0 | 200 | Basic generation, watermark |
| Standard | $10-30/mo | 1,000 | Full generation, rules, PDF |
| Pro | $50-100/mo | 5,000 | GA optimization, priority support |
| Enterprise | Custom | Unlimited | Multi-campus, API, dedicated support |

### Example Usage with Pricing Check

```typescript
async function checkPlanLimits(schoolId: string) {
  const school = await prisma.school.findUnique({ where: { id: schoolId }});
  
  const limits = {
    free: 200,
    standard: 1000,
    pro: 5000,
    enterprise: Infinity
  };
  
  const lessonCount = await prisma.lessonRequirement.count({ 
    where: { schoolId } 
  });
  
  if (lessonCount > limits[school.subscriptionTier]) {
    throw new Error('Upgrade required');
  }
}
```

---

## Performance Targets

| Dataset Size | Expected Time |
|--------------|---------------|
| 500 lessons | < 1 second |
| 2,000 lessons | 2-5 seconds |
| 10,000 lessons | 10-30 seconds |

### Optimization Techniques

1. **Bitmask State** - O(1) conflict detection
2. **Constraint Matrix** - Pre-computed availability
3. **Hybrid Solver** - Auto-selects CSP or Genetic
4. **Incremental Solving** - Updates only affected lessons
5. **Caching** - LRU cache for repeated computations

---

## API Reference

### Core Functions

| Function | Purpose |
|----------|---------|
| `generateTimetable()` | Main entry point |
| `solveCSP()` | CSP solver |
| `expandLessons()` | Expand weekly to individual |
| `scoreSchedule()` | Calculate quality score |
| `detectConflicts()` | Find conflicts |
| `autoFix()` | Auto-resolve conflicts |

### Rule Management

| Function | Purpose |
|----------|---------|
| `RuleEngine.evaluateHard()` | Check hard constraints |
| `RuleEngine.evaluateSoft()` | Calculate soft penalties |
| `RuleEngine.loadRules()` | Load from config |

---

## Getting Started

1. **Install dependencies**:
```bash
npm install
```

2. **Set up database**: Configure PostgreSQL with Prisma

3. **Generate timetable**:
```typescript
const result = await generateTimetable(inputData);
if (result.success) {
  console.log('Timetable created!', result.schedule);
}
```

4. **Handle conflicts** (if any):
```typescript
if (result.violations.length > 0) {
  const fixResult = autoFix(result.schedule, timeslots);
  onChange(fixResult.schedule);
}
```

---

## License

MIT License - Feel free to use and modify for your school management system.