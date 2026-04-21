export type RuleType = 'hard' | 'soft';

export interface Rule {
  id: string;
  name: string;
  type: RuleType;
  validate: (context: any) => boolean;
  priority: number;
}

export interface RuleSet {
  id: string;
  name: string;
  rules: Rule[];
}

export function createRule(
  id: string,
  name: string,
  type: RuleType,
  validate: (context: any) => boolean,
  priority: number = 0
): Rule {
  return { id, name, type, validate, priority };
}

export function evaluateRules(rules: Rule[], context: any): { passed: Rule[]; failed: Rule[] } {
  const passed: Rule[] = [];
  const failed: Rule[] = [];

  for (const rule of rules) {
    if (rule.validate(context)) {
      passed.push(rule);
    } else {
      failed.push(rule);
    }
  }

  return { passed, failed };
}
