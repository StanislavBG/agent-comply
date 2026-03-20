import { describe, it, expect } from 'vitest';
import { checkCompliance } from '../../src/checker/index.js';
import type { ComplyConfig, PolicyConfig } from '../../src/types/index.js';

const baseConfig: ComplyConfig = {
  project: { name: 'test-app', version: '1.0.0', owner: 'owner@test.com' },
  models: [
    {
      id: 'model-1',
      provider: 'openai',
      use_case: 'chatbot',
      risk_tier: 'limited',
      human_oversight: true,
      data_categories: ['user_messages'],
    },
  ],
  agents: [
    {
      id: 'agent-1',
      model: 'model-1',
      tools: ['search'],
      outputs_affect_humans: true,
    },
  ],
};

const requiredOwnerPolicy: PolicyConfig = {
  name: 'Test Policy',
  version: '1.0',
  rules: [
    {
      id: 'OWNER_REQUIRED',
      description: 'Owner must be set',
      severity: 'error',
      condition: { field: 'project.owner', operator: 'required' },
    },
  ],
};

const noProhibitedPolicy: PolicyConfig = {
  name: 'No Prohibited',
  version: '1.0',
  rules: [
    {
      id: 'NO_PROHIBITED',
      description: 'No prohibited tiers',
      severity: 'error',
      condition: { field: 'models[].risk_tier', operator: 'not_in', value: ['prohibited'] },
    },
  ],
};

describe('checkCompliance', () => {
  it('returns no violations for compliant config', () => {
    const violations = checkCompliance(baseConfig, requiredOwnerPolicy);
    expect(violations).toHaveLength(0);
  });

  it('returns violation when required field is missing', () => {
    const config = { ...baseConfig, project: { ...baseConfig.project, owner: '' } };
    const violations = checkCompliance(config, requiredOwnerPolicy);
    expect(violations).toHaveLength(1);
    expect(violations[0].rule_id).toBe('OWNER_REQUIRED');
    expect(violations[0].severity).toBe('error');
  });

  it('detects prohibited risk tier violation', () => {
    const config: ComplyConfig = {
      ...baseConfig,
      models: [{ ...baseConfig.models[0], risk_tier: 'prohibited' }],
    };
    const violations = checkCompliance(config, noProhibitedPolicy);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].rule_id).toBe('NO_PROHIBITED');
  });

  it('passes no_prohibited check for limited tier', () => {
    const violations = checkCompliance(baseConfig, noProhibitedPolicy);
    expect(violations).toHaveLength(0);
  });

  it('evaluates equals operator correctly', () => {
    const policy: PolicyConfig = {
      name: 'Oversight Required',
      version: '1.0',
      rules: [
        {
          id: 'OVERSIGHT_ON',
          description: 'Human oversight must be true',
          severity: 'error',
          condition: { field: 'models[].human_oversight', operator: 'equals', value: true },
        },
      ],
    };
    const violations = checkCompliance(baseConfig, policy);
    expect(violations).toHaveLength(0);
  });

  it('flags violation when oversight is false and policy requires true', () => {
    const config: ComplyConfig = {
      ...baseConfig,
      models: [{ ...baseConfig.models[0], human_oversight: false }],
    };
    const policy: PolicyConfig = {
      name: 'Oversight Required',
      version: '1.0',
      rules: [
        {
          id: 'OVERSIGHT_ON',
          description: 'Human oversight must be true',
          severity: 'error',
          condition: { field: 'models[].human_oversight', operator: 'equals', value: true },
        },
      ],
    };
    const violations = checkCompliance(config, policy);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('counts multiple violations from multiple rules', () => {
    const config = { ...baseConfig, project: { ...baseConfig.project, owner: '' } };
    const policy: PolicyConfig = {
      name: 'Multi Rule',
      version: '1.0',
      rules: [
        { id: 'R1', description: 'Owner required', severity: 'error', condition: { field: 'project.owner', operator: 'required' } },
        { id: 'R2', description: 'Name required', severity: 'warning', condition: { field: 'project.name', operator: 'required' } },
      ],
    };
    const violations = checkCompliance(config, policy);
    // owner is missing → 1 violation; name is present → 0
    expect(violations.length).toBe(1);
    expect(violations[0].rule_id).toBe('R1');
  });
});
