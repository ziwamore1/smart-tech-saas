import { Intent, ParsedCommand, ActionConstraints } from './types';

const DAY_MAP: Record<string, number> = {
  monday: 0, mon: 0,
  tuesday: 1, tue: 1,
  wednesday: 2, wed: 2,
  thursday: 3, thu: 3,
  friday: 4, fri: 4,
  saturday: 5, sat: 5,
  sunday: 6, sun: 6,
};

const PERIOD_PATTERNS: Record<string, number> = {
  'first': 0, '1st': 0,
  'second': 1, '2nd': 1,
  'third': 2, '3rd': 2,
  'fourth': 3, '4th': 3,
  'fifth': 4, '5th': 4,
  'sixth': 5, '6th': 5,
  'seventh': 6, '7th': 6,
  'last': 7, 'final': 7,
};

export function parseIntent(input: string): ParsedCommand {
  const text = input.toLowerCase().trim();

  if (text.includes('conflict') || text.includes('clash')) {
    return { action: 'FIX_CONFLICTS' };
  }

  if (text.includes('gap')) {
    if (text.includes('teacher')) {
      return { action: 'REDUCE_GAPS', targetType: 'teacher' };
    }
    return { action: 'REDUCE_GAPS' };
  }

  if (text.includes('balance')) {
    if (text.includes('subject')) {
      return { action: 'BALANCE_SUBJECTS' };
    }
    if (text.includes('day')) {
      return { action: 'BALANCE_DAYS' };
    }
    return { action: 'BALANCE_SUBJECTS' };
  }

  if (text.includes('move')) {
    return parseMoveCommand(text);
  }

  if (text.includes('avoid')) {
    return parseAvoidCommand(text);
  }

  if (text.includes('distribute') || text.includes('spread')) {
    return { action: 'DISTRIBUTE_EVENLY' };
  }

  if (text.includes('group') || text.includes('consecutive')) {
    return { action: 'GROUP_CONSECUTIVE' };
  }

  if (text.includes('optimize') || text.includes('improve') || text.includes('fix')) {
    if (text.includes('teacher')) {
      return { action: 'OPTIMIZE_TEACHER' };
    }
    return { action: 'OPTIMIZE_FULL' };
  }

  if (text.includes('morning')) {
    return { action: 'AVOID_LATE' };
  }

  if (text.includes('late') || text.includes('last period')) {
    return { action: 'AVOID_LATE' };
  }

  if (text.includes('default') || text.includes('reset')) {
    return { action: 'SET_DEFAULT' };
  }

  return { action: 'OPTIMIZE_FULL' };
}

function parseMoveCommand(text: string): ParsedCommand {
  const constraints: ActionConstraints = {};

  let target: string | undefined;
  let targetType: 'subject' | 'teacher' | 'class' | 'room' | undefined;

  const subjectMatch = text.match(/(math|english|science|history|geography|physics|chemistry|biology|art|music|pe|french|spanish|german)/i);
  if (subjectMatch) {
    target = subjectMatch[1].toLowerCase();
    targetType = 'subject';
  }

  const teacherMatch = text.match(/(mr\.|mrs\.|ms\.|dr\.)\s*(\w+)/i);
  if (teacherMatch) {
    target = teacherMatch[2].toLowerCase();
    targetType = 'teacher';
  }

  if (text.includes('friday') || text.includes('monday') || text.includes('tuesday') ||
      text.includes('wednesday') || text.includes('thursday') || text.includes('saturday')) {
    const dayMatch = Object.keys(DAY_MAP).find(d => text.includes(d));
    if (dayMatch) {
      constraints.avoid = { dayName: dayMatch };
    }
  }

  if (text.includes('last') || text.includes('final') || text.includes('6th') || text.includes('7th')) {
    constraints.avoid = { ...constraints.avoid, period: 6 };
  }

  if (text.includes('morning')) {
    constraints.avoid = { ...constraints.avoid, timeOfDay: 'afternoon' };
  }

  if (text.includes('afternoon')) {
    constraints.prefer = { timeOfDay: 'morning' };
  }

  if (target) {
    return { action: 'MOVE_SUBJECT', target, targetType, constraints };
  }

  return { action: 'OPTIMIZE_FULL', constraints };
}

function parseAvoidCommand(text: string): ParsedCommand {
  const constraints: ActionConstraints = { avoid: {} };

  if (text.includes('friday') || text.includes('monday') || text.includes('tuesday') ||
      text.includes('wednesday') || text.includes('thursday')) {
    const dayMatch = Object.keys(DAY_MAP).find(d => text.includes(d));
    if (dayMatch) {
      constraints.avoid!.dayName = dayMatch;
    }
  }

  if (text.includes('last') || text.includes('late')) {
    constraints.avoid!.period = 6;
  }

  if (text.includes('morning')) {
    constraints.avoid!.timeOfDay = 'morning';
  }

  if (text.includes('afternoon')) {
    constraints.avoid!.timeOfDay = 'afternoon';
  }

  return { action: 'AVOID_LATE', constraints };
}

export function parseConstraintFromNLP(input: string): ActionConstraints {
  const constraints: ActionConstraints = {};
  const text = input.toLowerCase();

  if (text.includes('avoid') || text.includes('not on') || text.includes('no')) {
    constraints.avoid = {};

    const dayMatch = Object.keys(DAY_MAP).find(d => text.includes(d));
    if (dayMatch) {
      constraints.avoid.dayName = dayMatch;
      constraints.avoid.day = DAY_MAP[dayMatch];
    }

    const periodMatch = Object.keys(PERIOD_PATTERNS).find(p => text.includes(p));
    if (periodMatch) {
      constraints.avoid.period = PERIOD_PATTERNS[periodMatch];
    }

    if (text.includes('morning')) {
      constraints.avoid.timeOfDay = 'morning';
    } else if (text.includes('afternoon')) {
      constraints.avoid.timeOfDay = 'afternoon';
    } else if (text.includes('late') || text.includes('end of day')) {
      constraints.avoid.period = 5;
    }
  }

  if (text.includes('prefer') || text.includes('like') || text.includes('want')) {
    constraints.prefer = {};

    const dayMatch = Object.keys(DAY_MAP).find(d => text.includes(d));
    if (dayMatch) {
      constraints.prefer.dayName = dayMatch;
      constraints.prefer.day = DAY_MAP[dayMatch];
    }
  }

  const gapMatch = text.match(/(\d+)\s*gap/i);
  if (gapMatch) {
    constraints.maxGaps = parseInt(gapMatch[1], 10);
  }

  return constraints;
}
