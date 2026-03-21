import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { parseComplyConfig, parsePolicyConfig } from '../parser/index.js';
import { checkCompliance } from '../checker/index.js';
import { buildReport, formatReport, formatSarif, formatJunit } from '../reporter/index.js';
import { guard } from '@bilkobibitkov/preflight-license';

export function runReport(configPath?: string, policyPath?: string, standard?: string, format?: string, output?: string): void {
  // Gate paid formats immediately — before any expensive work
  if (format === 'sarif' || format === 'junit') {
    guard('team', { feature: `--format ${format}` });
  }

  if (standard && standard !== 'eu-ai-act') {
    console.error(`Unknown standard: ${standard}. Supported: eu-ai-act`);
    process.exit(2);
  }
  const resolvedConfig = configPath ? resolve(configPath) : resolve(process.cwd(), 'comply.yaml');

  if (!existsSync(resolvedConfig)) {
    console.error(`Comply config not found: ${resolvedConfig}`);
    console.error('Run `agent-comply init` to create one, or specify --config <path>');
    process.exit(2);
  }

  let config;
  try {
    config = parseComplyConfig(resolvedConfig);
  } catch (err) {
    console.error(`Failed to parse comply config: ${(err as Error).message}`);
    process.exit(2);
  }

  let violations: import('../types/index.js').CheckViolation[] = [];
  if (policyPath) {
    const resolvedPolicy = resolve(policyPath);
    if (!existsSync(resolvedPolicy)) {
      console.error(`Policy file not found: ${resolvedPolicy}`);
      process.exit(2);
    }
    try {
      const policy = parsePolicyConfig(resolvedPolicy);
      violations = checkCompliance(config, policy);
    } catch (err) {
      console.error(`Failed to parse policy: ${(err as Error).message}`);
      process.exit(2);
    }
  }

  const report = buildReport(config, violations);

  if (format === 'sarif' || format === 'junit') {
    const formatted = format === 'sarif' ? formatSarif(report) : formatJunit(report);
    if (output) {
      writeFileSync(resolve(output), formatted, 'utf-8');
    } else {
      process.stdout.write(formatted + '\n');
    }
  } else {
    console.log(formatReport(report));
  }
}
