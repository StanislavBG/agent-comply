import { describe, it, expect } from 'vitest';
import { formatSarif, formatJunit, buildReport } from '../../src/reporter/index.js';
import type { ComplianceReport, CheckViolation } from '../../src/types/index.js';

const baseReport: ComplianceReport = {
  generated_at: '2026-01-01T00:00:00.000Z',
  project: { name: 'test-project', version: '1.0.0', owner: 'owner@test.com' },
  summary: {
    total_models: 1,
    total_agents: 1,
    risk_tiers: { prohibited: 0, high: 0, limited: 1, minimal: 0 },
    human_oversight_required: 1,
    affects_humans: 1,
  },
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
  violations: [],
};

const errorViolation: CheckViolation = {
  rule_id: 'RULE_001',
  severity: 'error',
  description: 'Human oversight missing',
  context: 'model-1 requires oversight',
};

const warningViolation: CheckViolation = {
  rule_id: 'RULE_002',
  severity: 'warning',
  description: 'Data category undeclared',
  context: 'agent-1 data categories',
};

describe('formatSarif', () => {
  it('produces valid SARIF 2.1.0 structure', () => {
    const output = formatSarif(baseReport);
    const sarif = JSON.parse(output);
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0].tool.driver.name).toBe('agent-comply');
    expect(sarif.runs[0].tool.driver.version).toBe('0.1.0');
  });

  it('produces empty results array when no violations', () => {
    const output = formatSarif(baseReport);
    const sarif = JSON.parse(output);
    expect(sarif.runs[0].results).toHaveLength(0);
    expect(sarif.runs[0].tool.driver.rules).toHaveLength(0);
  });

  it('maps error violation to SARIF result with level "error"', () => {
    const report = { ...baseReport, violations: [errorViolation] };
    const output = formatSarif(report);
    const sarif = JSON.parse(output);
    expect(sarif.runs[0].results).toHaveLength(1);
    const result = sarif.runs[0].results[0];
    expect(result.ruleId).toBe('RULE_001');
    expect(result.level).toBe('error');
    expect(result.message.text).toContain('Human oversight missing');
    expect(result.message.text).toContain('model-1 requires oversight');
  });

  it('maps warning violation to SARIF result with level "warning"', () => {
    const report = { ...baseReport, violations: [warningViolation] };
    const output = formatSarif(report);
    const sarif = JSON.parse(output);
    const result = sarif.runs[0].results[0];
    expect(result.level).toBe('warning');
  });

  it('deduplicates rules when multiple violations share the same rule_id', () => {
    const dup: CheckViolation = { ...errorViolation, context: 'model-2 also missing' };
    const report = { ...baseReport, violations: [errorViolation, dup] };
    const output = formatSarif(report);
    const sarif = JSON.parse(output);
    expect(sarif.runs[0].tool.driver.rules).toHaveLength(1);
    expect(sarif.runs[0].results).toHaveLength(2);
  });

  it('includes one rule entry per unique rule_id', () => {
    const report = { ...baseReport, violations: [errorViolation, warningViolation] };
    const output = formatSarif(report);
    const sarif = JSON.parse(output);
    expect(sarif.runs[0].tool.driver.rules).toHaveLength(2);
    const ruleIds = sarif.runs[0].tool.driver.rules.map((r: { id: string }) => r.id);
    expect(ruleIds).toContain('RULE_001');
    expect(ruleIds).toContain('RULE_002');
  });
});

describe('formatJunit', () => {
  it('produces XML with testsuites root element named "agent-comply"', () => {
    const output = formatJunit(baseReport);
    expect(output).toContain('<testsuites name="agent-comply">');
    expect(output).toContain('</testsuites>');
  });

  it('includes testsuite with project name', () => {
    const output = formatJunit(baseReport);
    expect(output).toContain('test-project compliance');
  });

  it('outputs single passing testcase when no violations', () => {
    const output = formatJunit(baseReport);
    expect(output).toContain('<testcase name="compliance-check"');
    expect(output).not.toContain('<failure');
  });

  it('maps violation to testcase with failure element', () => {
    const report = { ...baseReport, violations: [errorViolation] };
    const output = formatJunit(report);
    expect(output).toContain('<testcase name="RULE_001"');
    expect(output).toContain('<failure message=');
    expect(output).toContain('Human oversight missing');
    expect(output).toContain('model-1 requires oversight');
  });

  it('sets tests count to violation count when violations exist', () => {
    const report = { ...baseReport, violations: [errorViolation, warningViolation] };
    const output = formatJunit(report);
    expect(output).toContain('tests="2"');
  });

  it('sets failures count to error-severity violation count only', () => {
    const report = { ...baseReport, violations: [errorViolation, warningViolation] };
    const output = formatJunit(report);
    expect(output).toContain('failures="1"');
  });

  it('sets tests="1" and failures="0" for clean report', () => {
    const output = formatJunit(baseReport);
    expect(output).toContain('tests="1"');
    expect(output).toContain('failures="0"');
  });

  it('escapes XML special characters in violation description', () => {
    const violationWithSpecialChars: CheckViolation = {
      rule_id: 'RULE_003',
      severity: 'warning',
      description: 'Value < threshold & > limit',
      context: '"quoted" context',
    };
    const report = { ...baseReport, violations: [violationWithSpecialChars] };
    const output = formatJunit(report);
    expect(output).toContain('&lt;');
    expect(output).toContain('&amp;');
    expect(output).toContain('&gt;');
    expect(output).toContain('&quot;');
  });
});
