#!/usr/bin/env node
import { Command } from 'commander';
import { runClassify } from './commands/classify.js';
import { runCheck } from './commands/check.js';
import { runReport } from './commands/report.js';
import { runScan } from './commands/scan.js';
import { runInit } from './commands/init.js';

const program = new Command();

program
  .name('agent-comply')
  .description('EU AI Act compliance CLI — classify, check, and report AI system compliance')
  .version('0.1.0');

program
  .command('init')
  .description('Generate a comply.yaml scaffold (auto-detects AI providers in current directory)')
  .option('--output <path>', 'Output path (default: ./comply.yaml)')
  .action((opts: { output?: string }) => {
    runInit(opts.output);
  });

program
  .command('scan <path>')
  .description('Detect AI provider usage in a codebase (raw scan, no classification)')
  .action((targetPath: string) => {
    runScan(targetPath);
  });

program
  .command('classify <path>')
  .description('Scan a codebase for AI model usage and classify risk tier (EU AI Act Annex III)')
  .action((targetPath: string) => {
    runClassify(targetPath);
  });

program
  .command('check <policy>')
  .description('Validate a project against a YAML compliance policy')
  .option('--config <path>', 'Path to comply.yaml (default: ./comply.yaml)')
  .action((policyPath: string, opts: { config?: string }) => {
    runCheck(policyPath, opts.config);
  });

program
  .command('report')
  .description('Generate a compliance summary report')
  .option('--config <path>', 'Path to comply.yaml (default: ./comply.yaml)')
  .option('--policy <path>', 'Path to policy.yaml (optional, adds violation checks)')
  .option('--standard <name>', 'Compliance standard to reference (e.g. eu-ai-act)', 'eu-ai-act')
  .option('--format <format>', 'Output format: sarif, junit (for CI integration)')
  .action((opts: { config?: string; policy?: string; standard?: string; format?: string }) => {
    runReport(opts.config, opts.policy, opts.standard, opts.format);
  });

program.parse();
