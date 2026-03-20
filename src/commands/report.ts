import { existsSync } from 'fs';
import { resolve } from 'path';
import { parseComplyConfig, parsePolicyConfig } from '../parser/index.js';
import { checkCompliance } from '../checker/index.js';
import { buildReport, formatReport } from '../reporter/index.js';

export function runReport(configPath?: string, policyPath?: string): void {
  const resolvedConfig = configPath ? resolve(configPath) : resolve(process.cwd(), 'comply.yaml');

  if (!existsSync(resolvedConfig)) {
    console.error(`Comply config not found: ${resolvedConfig}`);
    console.error('Run `agent-comply init` to create one, or specify --config <path>');
    process.exit(1);
  }

  let config;
  try {
    config = parseComplyConfig(resolvedConfig);
  } catch (err) {
    console.error(`Failed to parse comply config: ${(err as Error).message}`);
    process.exit(1);
  }

  let violations: import('../types/index.js').CheckViolation[] = [];
  if (policyPath) {
    const resolvedPolicy = resolve(policyPath);
    if (!existsSync(resolvedPolicy)) {
      console.error(`Policy file not found: ${resolvedPolicy}`);
      process.exit(1);
    }
    try {
      const policy = parsePolicyConfig(resolvedPolicy);
      violations = checkCompliance(config, policy);
    } catch (err) {
      console.error(`Failed to parse policy: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  const report = buildReport(config, violations);
  console.log(formatReport(report));
}
