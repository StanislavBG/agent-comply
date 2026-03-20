import type { ComplyConfig, PolicyConfig, CheckViolation, PolicyCondition } from '../types/index.js';

function getFieldValue(config: ComplyConfig, field: string): unknown {
  // Support dot notation: "models[].human_oversight", "project.owner"
  if (field.startsWith('models[].')) {
    const subfield = field.slice('models[].'.length);
    return config.models.map(m => (m as unknown as Record<string, unknown>)[subfield]);
  }
  if (field.startsWith('agents[].')) {
    const subfield = field.slice('agents[].'.length);
    return config.agents.map(a => (a as unknown as Record<string, unknown>)[subfield]);
  }
  const parts = field.split('.');
  let val: unknown = config;
  for (const part of parts) {
    val = (val as Record<string, unknown>)?.[part];
  }
  return val;
}

function evalCondition(condition: PolicyCondition, config: ComplyConfig): boolean {
  const val = getFieldValue(config, condition.field);

  switch (condition.operator) {
    case 'required':
      if (Array.isArray(val)) return val.every(v => v !== undefined && v !== null && v !== '');
      return val !== undefined && val !== null && val !== '';

    case 'equals':
      if (Array.isArray(val)) return val.every(v => v === condition.value);
      return val === condition.value;

    case 'not_equals':
      if (Array.isArray(val)) return val.every(v => v !== condition.value);
      return val !== condition.value;

    case 'in':
      if (!Array.isArray(condition.value)) return false;
      if (Array.isArray(val)) return val.every(v => (condition.value as unknown[]).includes(v));
      return (condition.value as unknown[]).includes(val);

    case 'not_in':
      if (!Array.isArray(condition.value)) return true;
      if (Array.isArray(val)) return val.every(v => !(condition.value as unknown[]).includes(v));
      return !(condition.value as unknown[]).includes(val);

    default:
      return true;
  }
}

export function checkCompliance(config: ComplyConfig, policy: PolicyConfig): CheckViolation[] {
  const violations: CheckViolation[] = [];

  for (const rule of policy.rules) {
    const passes = evalCondition(rule.condition, config);
    if (!passes) {
      violations.push({
        rule_id: rule.id,
        severity: rule.severity,
        description: rule.description,
        context: `field: ${rule.condition.field}, operator: ${rule.condition.operator}${rule.condition.value !== undefined ? `, expected: ${JSON.stringify(rule.condition.value)}` : ''}`,
      });
    }
  }

  return violations;
}
