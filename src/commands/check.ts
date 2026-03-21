import { existsSync } from 'fs';
import { resolve } from 'path';
import { parseComplyConfig, parsePolicyConfig } from '../parser/index.js';
import { checkCompliance } from '../checker/index.js';

export function runCheck(policyPath: string, configPath?: string): void {
  const resolvedPolicy = resolve(policyPath);
  const resolvedConfig = configPath ? resolve(configPath) : resolve(process.cwd(), 'comply.yaml');

  if (!existsSync(resolvedPolicy)) {
    console.error(`Policy file not found: ${resolvedPolicy}`);
    process.exit(2);
  }
  if (!existsSync(resolvedConfig)) {
    console.error(`Comply config not found: ${resolvedConfig}`);
    console.error('comply.yaml is your AI model inventory. Generate one with:');
    console.error('  agent-comply init         # scaffold comply.yaml');
    console.error('  agent-comply classify .   # detect AI usage from your codebase');
    if (!configPath) {
      console.error('Or specify a different path: --config <path>');
    }
    process.exit(2);
  }

  let config, policy;

  try {
    config = parseComplyConfig(resolvedConfig);
  } catch (err) {
    console.error(`Failed to parse comply config: ${(err as Error).message}`);
    process.exit(2);
  }

  try {
    policy = parsePolicyConfig(resolvedPolicy);
  } catch (err) {
    console.error(`Failed to parse policy: ${(err as Error).message}`);
    process.exit(2);
  }

  console.log(`\nChecking: ${resolvedConfig}`);
  console.log(`Policy:   ${policy.name} v${policy.version ?? 'unknown'}`);
  console.log(`Rules:    ${policy.rules.length}\n`);

  const violations = checkCompliance(config, policy);

  if (violations.length === 0) {
    console.log('✓ All policy checks passed.\n');
    process.exit(0);
  }

  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

  if (errors.length > 0) {
    console.log(`ERRORS (${errors.length}):`);
    for (const v of errors) {
      console.log(`  ✗ [${v.rule_id}] ${v.description}`);
      console.log(`    ${v.context}`);
    }
    console.log('');
  }

  if (warnings.length > 0) {
    console.log(`WARNINGS (${warnings.length}):`);
    for (const v of warnings) {
      console.log(`  ⚠ [${v.rule_id}] ${v.description}`);
      console.log(`    ${v.context}`);
    }
    console.log('');
  }

  console.log(`Result: ${errors.length} error(s), ${warnings.length} warning(s)`);

  if (errors.length > 0) process.exit(1);
}
