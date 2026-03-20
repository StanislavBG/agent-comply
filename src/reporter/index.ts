import type { ComplyConfig, CheckViolation, ComplianceReport, RiskTier } from '../types/index.js';

export function formatSarif(report: ComplianceReport): string {
  const rules = Array.from(
    new Map(report.violations.map(v => [v.rule_id, v])).values()
  ).map(v => ({
    id: v.rule_id,
    name: v.rule_id,
    shortDescription: { text: v.description },
  }));

  const results = report.violations.map(v => ({
    ruleId: v.rule_id,
    level: v.severity === 'error' ? 'error' : 'warning',
    message: { text: `${v.description} ${v.context}` },
  }));

  const sarif = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'agent-comply',
            version: '0.1.0',
            rules,
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

export function formatJunit(report: ComplianceReport): string {
  const projectName = report.project.name;
  const violations = report.violations;
  const failureCount = violations.filter(v => v.severity === 'error').length;

  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let testcases: string;
  if (violations.length === 0) {
    testcases = `    <testcase name="compliance-check" classname="${escape(projectName)}"/>`;
  } else {
    testcases = violations
      .map(v => {
        const msg = escape(`${v.description} ${v.context}`);
        return `    <testcase name="${escape(v.rule_id)}" classname="${escape(projectName)}">\n      <failure message="${msg}">${msg}</failure>\n    </testcase>`;
      })
      .join('\n');
  }

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites name="agent-comply">`,
    `  <testsuite name="${escape(projectName)} compliance" tests="${violations.length || 1}" failures="${failureCount}">`,
    testcases,
    `  </testsuite>`,
    `</testsuites>`,
  ];

  return lines.join('\n');
}

export function buildReport(
  config: ComplyConfig,
  violations: CheckViolation[]
): ComplianceReport {
  const riskTiers: Record<RiskTier, number> = {
    prohibited: 0,
    high: 0,
    limited: 0,
    minimal: 0,
  };

  for (const model of config.models) {
    riskTiers[model.risk_tier]++;
  }

  return {
    generated_at: new Date().toISOString(),
    project: config.project,
    summary: {
      total_models: config.models.length,
      total_agents: config.agents.length,
      risk_tiers: riskTiers,
      human_oversight_required: config.models.filter(m => m.human_oversight).length,
      affects_humans: config.agents.filter(a => a.outputs_affect_humans).length,
    },
    models: config.models,
    agents: config.agents,
    violations,
  };
}

export function formatReport(report: ComplianceReport): string {
  const lines: string[] = [];

  lines.push(`╔══════════════════════════════════════════════════╗`);
  lines.push(`║         AGENT-COMPLY COMPLIANCE REPORT           ║`);
  lines.push(`╚══════════════════════════════════════════════════╝`);
  lines.push('');
  lines.push(`Project:    ${report.project.name} v${report.project.version}`);
  lines.push(`Owner:      ${report.project.owner}`);
  lines.push(`Generated:  ${report.generated_at}`);
  lines.push('');
  lines.push('── SUMMARY ─────────────────────────────────────────');
  lines.push(`Models:              ${report.summary.total_models}`);
  lines.push(`Agents:              ${report.summary.total_agents}`);
  lines.push(`Human oversight:     ${report.summary.human_oversight_required}/${report.summary.total_models} models`);
  lines.push(`Affects humans:      ${report.summary.affects_humans}/${report.summary.total_agents} agents`);
  lines.push('');
  lines.push('── RISK DISTRIBUTION ───────────────────────────────');
  lines.push(`  prohibited: ${report.summary.risk_tiers.prohibited}`);
  lines.push(`  high:       ${report.summary.risk_tiers.high}`);
  lines.push(`  limited:    ${report.summary.risk_tiers.limited}`);
  lines.push(`  minimal:    ${report.summary.risk_tiers.minimal}`);
  lines.push('');

  if (report.violations.length === 0) {
    lines.push('── COMPLIANCE CHECK ────────────────────────────────');
    lines.push('  ✓ No violations found.');
  } else {
    const errors = report.violations.filter(v => v.severity === 'error');
    const warnings = report.violations.filter(v => v.severity === 'warning');

    lines.push(`── VIOLATIONS (${report.violations.length}) ─────────────────────────────`);

    if (errors.length > 0) {
      lines.push(`\n  ERRORS (${errors.length}):`);
      for (const v of errors) {
        lines.push(`  ✗ [${v.rule_id}] ${v.description}`);
        lines.push(`    ${v.context}`);
      }
    }

    if (warnings.length > 0) {
      lines.push(`\n  WARNINGS (${warnings.length}):`);
      for (const v of warnings) {
        lines.push(`  ⚠ [${v.rule_id}] ${v.description}`);
        lines.push(`    ${v.context}`);
      }
    }
  }

  lines.push('');
  lines.push('────────────────────────────────────────────────────');

  const hasProhibited = report.summary.risk_tiers.prohibited > 0;
  const hasErrors = report.violations.some(v => v.severity === 'error');

  if (hasProhibited) {
    lines.push('STATUS: ✗ PROHIBITED — contains prohibited AI use cases');
  } else if (hasErrors) {
    lines.push('STATUS: ✗ NON-COMPLIANT — policy violations must be resolved');
  } else if (report.violations.length > 0) {
    lines.push('STATUS: ⚠ WARNINGS — review warnings before deployment');
  } else {
    lines.push('STATUS: ✓ COMPLIANT');
  }

  lines.push('');
  return lines.join('\n');
}
