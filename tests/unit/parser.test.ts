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
});
