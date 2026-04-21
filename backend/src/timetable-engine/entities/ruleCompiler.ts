import { Rule, RuleContext, RuleEngine, RuleConfig } from './rules';
import { UserRule } from '../ui/types/rules';
import { ExpandedLesson, TimeslotEntity, ScheduleEntry } from './index';
import { parseTimeslotKey } from './index';

export interface CompiledRule extends Rule {
  userRuleId: string;
}

export function compileUserRule(userRule: UserRule): CompiledRule {
  const baseRule: Rule = {
    type: userRule.type,
    name: userRule.name,
    weight: userRule.weight,
    enabled: userRule.enabled,
    validate: () => true,
  };

  const conditionEvaluator = buildConditionEvaluator(userRule.conditions);
  const actionEvaluator = buildActionEvaluator(userRule.action);

  if (userRule.type === 'HARD') {
    return {
      ...baseRule,
      userRuleId: userRule.id,
      validate: (context: RuleContext) => {
        if (!conditionEvaluator(context)) return true;
        return actionEvaluator(context);
      },
    };
  }

  return {
    ...baseRule,
    userRuleId: userRule.id,
    validate: (context: RuleContext) => {
      if (!conditionEvaluator(context)) return 0;
      const penalty = actionEvaluator(context);
      return penalty;
    },
  };
}

function buildConditionEvaluator(conditions: UserRule['conditions']) {
  return (context: RuleContext): boolean => {
    if (conditions.length === 0) return true;

    return conditions.every(condition => {
      const { entity, operator, value } = condition;

      if (!value) return true;

      switch (entity) {
        case 'teacher': {
          const teacherId = context.lesson?.teacherId;
          return evaluateOperator(operator, teacherId, value);
        }
        case 'subject': {
          const subjectId = context.lesson?.subjectId;
          return evaluateOperator(operator, subjectId, value);
        }
        case 'class': {
          const classId = context.lesson?.classId;
          return evaluateOperator(operator, classId, value);
        }
        case 'room': {
          const roomId = context.lesson?.classId;
          return evaluateOperator(operator, roomId, value);
        }
        case 'timeslot': {
          const ts = context.timeslot;
          if (!ts) return true;
          return evaluateTimeslotCondition(operator, ts, value);
        }
        default:
          return true;
      }
    });
  };
}

function evaluateOperator(
  operator: string,
  actual: string | undefined,
  expected: string
): boolean {
  if (!actual) return false;

  switch (operator) {
    case 'is':
      return actual === expected;
    case 'isNot':
      return actual !== expected;
    case 'includes':
      return actual.includes(expected);
    case 'excludes':
      return !actual.includes(expected);
    default:
      return true;
  }
}

function evaluateTimeslotCondition(
  operator: string,
  timeslot: TimeslotEntity,
  value: string
): boolean {
  const parsed = parseTimeslotKey(value);

  if (!parsed) {
    return value.toLowerCase().includes('morning')
      ? timeslot.period <= 3
      : value.toLowerCase().includes('afternoon')
      ? timeslot.period >= 4
      : true;
  }

  switch (operator) {
    case 'is':
      return timeslot.day === parsed.day && timeslot.period === parsed.period;
    case 'isNot':
      return !(timeslot.day === parsed.day && timeslot.period === parsed.period);
    case 'before':
      return (
        timeslot.day < parsed.day ||
        (timeslot.day === parsed.day && timeslot.period < parsed.period)
      );
    case 'after':
      return (
        timeslot.day > parsed.day ||
        (timeslot.day === parsed.day && timeslot.period > parsed.period)
      );
    default:
      return true;
  }
}

function buildActionEvaluator(action: UserRule['action']) {
  return (context: RuleContext): boolean | number => {
    const { schedule, timeslot, timeslots } = context;

    switch (action.type) {
      case 'avoid':
        return evaluateAvoid(schedule, timeslot, timeslots, action);
      case 'prefer':
        return evaluatePrefer(schedule, timeslot, timeslots, action);
      case 'require':
        return evaluateRequire(schedule, timeslot, timeslots, action);
      default:
        return action.type === 'HARD' ? false : 0;
    }
  };
}

function evaluateAvoid(
  schedule: ScheduleEntry[] | undefined,
  timeslot: TimeslotEntity | undefined,
  timeslots: TimeslotEntity[] | undefined,
  action: UserRule['action']
): boolean | number {
  if (!timeslot) return action.type === 'HARD' ? false : 0;

  if (action.day && timeslot.day !== action.day) {
    return action.type === 'HARD' ? true : 0;
  }

  if (action.period && timeslot.period !== action.period) {
    return action.type === 'HARD' ? true : 0;
  }

  if (action.time) {
    const isMorning = timeslot.period <= 3;
    const wantsMorning = action.time === 'morning';

    if (isMorning !== wantsMorning) {
      return action.type === 'HARD' ? false : 1;
    }
  }

  return action.type === 'HARD' ? true : 0;
}

function evaluatePrefer(
  schedule: ScheduleEntry[] | undefined,
  timeslot: TimeslotEntity | undefined,
  timeslots: TimeslotEntity[] | undefined,
  action: UserRule['action']
): boolean | number {
  if (!timeslot || !schedule) return 0;

  let penalty = 0;

  if (action.time === 'morning' && timeslot.period > 3) {
    penalty += 2;
  } else if (action.time === 'afternoon' && timeslot.period <= 3) {
    penalty += 2;
  }

  return penalty;
}

function evaluateRequire(
  schedule: ScheduleEntry[] | undefined,
  timeslot: TimeslotEntity | undefined,
  timeslots: TimeslotEntity[] | undefined,
  action: UserRule['action']
): boolean | number {
  if (!timeslot || !schedule) return action.type === 'HARD' ? false : 0;

  if (action.consecutive) {
    const lessonId = schedule[0]?.lessonId;
    if (!lessonId) return action.type === 'HARD' ? false : 0;

    const consecutiveCount = countConsecutiveLessons(schedule, lessonId, timeslot.day);
    const isConsecutive =
      consecutiveCount > 0 && Math.abs(timeslot.period - consecutiveCount) === 1;

    if (!isConsecutive) {
      return action.type === 'HARD' ? false : 3;
    }
  }

  if (action.lessonCount) {
    const lessonId = schedule[0]?.lessonId;
    if (!lessonId) return action.type === 'HARD' ? false : 0;

    const dayLessons = countDayLessons(schedule, lessonId, timeslot.day);
    if (dayLessons >= action.lessonCount) {
      return action.type === 'HARD' ? false : 2;
    }
  }

  return action.type === 'HARD' ? true : 0;
}

function countConsecutiveLessons(
  schedule: ScheduleEntry[],
  lessonId: string,
  day: number
): number {
  const lesson = schedule.find(e => {
    const ts = parseTimeslotKey(e.timeslotId);
    return e.lessonId === lessonId && ts?.day === day;
  });

  return lesson ? (parseTimeslotKey(lesson.timeslotId)?.period || 0) : 0;
}

function countDayLessons(
  schedule: ScheduleEntry[],
  lessonId: string,
  day: number
): number {
  return schedule.filter(e => {
    const ts = parseTimeslotKey(e.timeslotId);
    return e.lessonId.includes(lessonId) && ts?.day === day;
  }).length;
}

export function compileRulesToEngine(
  userRules: UserRule[],
  existingEngine?: RuleEngine
): RuleEngine {
  const engine = existingEngine || new RuleEngine();

  for (const userRule of userRules) {
    if (!userRule.enabled) continue;

    const compiled = compileUserRule(userRule);
    engine.addRule(compiled);
  }

  return engine;
}

export function convertUserRulesToConfig(userRules: UserRule[]): RuleConfig[] {
  return userRules
    .filter(r => r.enabled)
    .map(r => ({
      type: r.type,
      name: r.name,
      weight: r.weight,
      enabled: r.enabled,
    }));
}
