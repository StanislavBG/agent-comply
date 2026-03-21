import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { parseComplyConfig, parsePolicyConfig } from '../../src/parser/index.js';

const TMP = '/tmp/agent-comply-test-parser';

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });

  writeFileSync(join(TMP, 'valid-comply.yaml'), `
project:
  name: test-app
  version: "1.0.0"
  owner: owner@test.com
models:
  - id: gpt-4
    provider: openai
    use_case: chatbot
    risk_tier: limited
    human_oversight: true
    data_categories:
      - user_messages
agents:
  - id: bot
    model: gpt-4
    tools:
      - search
    outputs_affect_humans: true
`);

  writeFileSync(join(TMP, 'invalid-comply.yaml'), `
project:
  name: test-app
models: []
`);

  writeFileSync(join(TMP, 'valid-policy.yaml'), `
name: Test Policy
version: "1.0"
rules:
  - id: R1
    description: Owner required
    severity: error
    condition:
      field: project.owner
      operator: required
`);
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('parseComplyConfig', () => {
  it('parses valid comply.yaml', () => {
    const config = parseComplyConfig(join(TMP, 'valid-comply.yaml'));
    expect(config.project.name).toBe('test-app');
    expect(config.models).toHaveLength(1);
    expect(config.models[0].risk_tier).toBe('limited');
    expect(config.agents).toHaveLength(1);
  });

  it('throws on empty models array', () => {
    expect(() => parseComplyConfig(join(TMP, 'invalid-comply.yaml'))).toThrow();
  });
});

describe('parsePolicyConfig', () => {
  it('parses valid policy.yaml', () => {
    const policy = parsePolicyConfig(join(TMP, 'valid-policy.yaml'));
    expect(policy.name).toBe('Test Policy');
    expect(policy.rules).toHaveLength(1);
    expect(policy.rules[0].id).toBe('R1');
  });

  it('throws when policy.name is missing', () => {
    writeFileSync(join(TMP, 'no-name-policy.yaml'), 'rules:\n  - id: R1\n    description: x\n    severity: error\n    condition:\n      field: x\n      operator: required\n');
    expect(() => parsePolicyConfig(join(TMP, 'no-name-policy.yaml'))).toThrow('policy.name');
  });

  it('throws when policy.rules is not an array', () => {
    writeFileSync(join(TMP, 'no-rules-policy.yaml'), 'name: Bad\nrules: not-an-array\n');
    expect(() => parsePolicyConfig(join(TMP, 'no-rules-policy.yaml'))).toThrow('policy.rules');
  });

  it('throws when file does not exist', () => {
    expect(() => parsePolicyConfig(join(TMP, 'nonexistent-policy.yaml'))).toThrow();
  });
});

describe('parseComplyConfig — validation edge cases', () => {
  it('throws when project.owner is missing', () => {
    writeFileSync(join(TMP, 'no-owner.yaml'), `
project:
  name: test-app
  version: "1.0.0"
models:
  - id: m1
    provider: openai
    use_case: chatbot
    risk_tier: limited
    human_oversight: true
    data_categories:
      - user_messages
`);
    expect(() => parseComplyConfig(join(TMP, 'no-owner.yaml'))).toThrow('owner');
  });

  it('throws when model risk_tier is invalid', () => {
    writeFileSync(join(TMP, 'bad-tier.yaml'), `
project:
  name: test-app
  version: "1.0.0"
  owner: owner@test.com
models:
  - id: m1
    provider: openai
    use_case: chatbot
    risk_tier: extreme
    human_oversight: true
    data_categories:
      - user_messages
`);
    expect(() => parseComplyConfig(join(TMP, 'bad-tier.yaml'))).toThrow('risk_tier');
  });

  it('throws when model human_oversight is not boolean', () => {
    writeFileSync(join(TMP, 'bad-oversight.yaml'), `
project:
  name: test-app
  version: "1.0.0"
  owner: owner@test.com
models:
  - id: m1
    provider: openai
    use_case: chatbot
    risk_tier: limited
    human_oversight: "yes"
    data_categories:
      - user_messages
`);
    expect(() => parseComplyConfig(join(TMP, 'bad-oversight.yaml'))).toThrow('human_oversight');
  });

  it('throws when agent tools is not an array', () => {
    writeFileSync(join(TMP, 'bad-tools.yaml'), `
project:
  name: test-app
  version: "1.0.0"
  owner: owner@test.com
models:
  - id: m1
    provider: openai
    use_case: chatbot
    risk_tier: limited
    human_oversight: true
    data_categories:
      - user_messages
agents:
  - id: bot
    model: m1
    tools: search
    outputs_affect_humans: true
`);
    expect(() => parseComplyConfig(join(TMP, 'bad-tools.yaml'))).toThrow('tools');
  });

  it('throws when agent outputs_affect_humans is not boolean', () => {
    writeFileSync(join(TMP, 'bad-outputs.yaml'), `
project:
  name: test-app
  version: "1.0.0"
  owner: owner@test.com
models:
  - id: m1
    provider: openai
    use_case: chatbot
    risk_tier: limited
    human_oversight: true
    data_categories:
      - user_messages
agents:
  - id: bot
    model: m1
    tools:
      - search
    outputs_affect_humans: "yes"
`);
    expect(() => parseComplyConfig(join(TMP, 'bad-outputs.yaml'))).toThrow('outputs_affect_humans');
  });

  it('accepts all four valid risk_tiers', () => {
    for (const tier of ['prohibited', 'high', 'limited', 'minimal'] as const) {
      writeFileSync(join(TMP, `tier-${tier}.yaml`), `
project:
  name: test-app
  version: "1.0.0"
  owner: owner@test.com
models:
  - id: m1
    provider: openai
    use_case: chatbot
    risk_tier: ${tier}
    human_oversight: true
    data_categories:
      - user_messages
`);
      expect(() => parseComplyConfig(join(TMP, `tier-${tier}.yaml`))).not.toThrow();
    }
  });
});
