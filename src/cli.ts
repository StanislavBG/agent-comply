#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { runClassify } from './commands/classify.js';
import { runCheck } from './commands/check.js';
import { runReport } from './commands/report.js';
import { runScan } from './commands/scan.js';
import { runInit } from './commands/init.js';
import { sendTelemetry } from './telemetry.js';
import { validate } from '@bilkobibitkov/preflight-license';

/* ── Usage-based monetization ───────────────────────────────────────── */

const CLI_VERSION = '0.2.9';
const FREE_MONTHLY_LIMIT = 10;
const UPGRADE_URL = 'https://buy.stripe.com/28E00l73Ccu9ePH1S08k802';
const CONFIG_DIR = path.join(os.homedir(), '.config', 'agent-comply');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const USAGE_FILE = path.join(CONFIG_DIR, 'usage.json');

interface UsageRecord {
  month: string; // YYYY-MM
  count: number;
}

function getComplyKey(): string | undefined {
  const envKey = process.env.COMPLY_KEY;
  if (envKey && envKey.trim()) return envKey.trim();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      const parsed = JSON.parse(raw) as { key?: string };
      if (parsed.key && parsed.key.trim()) return parsed.key.trim();
    }
  } catch { /* corrupted config — ignore */ }
  return undefined;
}

function isProUser(): boolean {
  const key = getComplyKey();
  if (!key) return false;
  const result = validate(key);
  return result.valid && result.tier !== 'free';
}

function readUsage(): UsageRecord {
  const currentMonth = new Date().toISOString().slice(0, 7);
  try {
    if (fs.existsSync(USAGE_FILE)) {
      const raw = fs.readFileSync(USAGE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as UsageRecord;
      if (parsed.month === currentMonth) return parsed;
    }
  } catch { /* corrupted — reset */ }
  return { month: currentMonth, count: 0 };
}

function writeUsage(record: UsageRecord): void {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(USAGE_FILE, JSON.stringify(record), 'utf8');
  } catch { /* degrade gracefully */ }
}

function checkUsageLimit(): boolean {
  if (isProUser()) return true;
  const usage = readUsage();
  if (usage.count >= FREE_MONTHLY_LIMIT) {
    process.stderr.write(
      `\n─────────────────────────────────────────────────────────────\n` +
      `  You've used all ${FREE_MONTHLY_LIMIT} free runs this month.\n\n` +
      `  Preflight Team ($49/mo) unlocks:\n` +
      `    · Unlimited runs          · Compliance dashboard\n` +
      `    · PDF reports             · Slack alerts\n` +
      `    · Full run history        · SARIF/JUnit CI output\n\n` +
      `  Upgrade → ${UPGRADE_URL}\n` +
      `─────────────────────────────────────────────────────────────\n\n`
    );
    return false;
  }
  return true;
}

function trackUsageAfterRun(): void {
  if (isProUser()) return;
  const usage = readUsage();
  usage.count += 1;
  writeUsage(usage);
  const remaining = FREE_MONTHLY_LIMIT - usage.count;
  process.stderr.write(
    `\n─────────────────────────────────────────────────────────────\n` +
    `  ${remaining} of ${FREE_MONTHLY_LIMIT} free runs remaining this month.\n` +
    `  Team unlocks: unlimited runs · PDF reports · Slack alerts · run history\n` +
    `  Upgrade → ${UPGRADE_URL}\n` +
    `─────────────────────────────────────────────────────────────\n`
  );
}

const program = new Command();

program
  .name('agent-comply')
  .description('EU AI Act compliance CLI — classify, check, and report AI system compliance')
  .version('0.2.8')
  .addHelpText('after', `
Examples:
  agent-comply init                                  scaffold comply.yaml
  agent-comply classify .                            detect AI usage + classify risk tier
  agent-comply check ./policies/eu-ai-act.yaml       validate against EU AI Act policy
  agent-comply report --policy ./policies/eu-ai-act.yaml  full compliance report`);

program
  .command('activate <key>')
  .description('Store a license key for unlimited runs')
  .action((key: string) => {
    const result = validate(key);
    if (!result.valid) {
      process.stderr.write(`\nInvalid license key: ${result.reason}\n\n`);
      process.exit(1);
    }
    try {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ key }), 'utf8');
      console.log(`\nLicense activated (${result.tier} — ${result.org}). Unlimited runs enabled.\n`);
    } catch (e) {
      process.stderr.write(`\nFailed to save license: ${(e as Error).message}\n\n`);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Generate a comply.yaml scaffold (auto-detects AI providers in current directory)')
  .option('--output <path>', 'Output path (default: ./comply.yaml)')
  .action((opts: { output?: string }) => {
    sendTelemetry({ command: 'init', version: CLI_VERSION });
    if (opts.output && opts.output.includes('\0')) {
      process.stderr.write('\nError: Invalid output path — null bytes are not allowed\n');
      process.exit(2);
    }
    if (!checkUsageLimit()) process.exit(1);
    process.on('exit', trackUsageAfterRun);
    runInit(opts.output);
  });

program
  .command('scan <path>')
  .description('Detect AI provider usage in a codebase (raw scan, no classification)')
  .addHelpText('after', `
Examples:
  agent-comply scan .                scan current directory
  agent-comply scan ./src            scan src/ only`)
  .action((targetPath: string) => {
    sendTelemetry({ command: 'scan', version: CLI_VERSION });
    if (targetPath.includes('\0')) {
      process.stderr.write('\nError: Invalid path — null bytes are not allowed\n');
      process.exit(2);
    }
    if (!checkUsageLimit()) process.exit(1);
    process.on('exit', trackUsageAfterRun);
    runScan(targetPath);
  });

program
  .command('classify <path>')
  .description('Scan a codebase for AI model usage and classify risk tier (EU AI Act Annex III)')
  .action((targetPath: string) => {
    sendTelemetry({ command: 'classify', version: CLI_VERSION });
    if (targetPath.includes('\0')) {
      process.stderr.write('\nError: Invalid path — null bytes are not allowed\n');
      process.exit(2);
    }
    if (!checkUsageLimit()) process.exit(1);
    process.on('exit', trackUsageAfterRun);
    runClassify(targetPath);
  });

program
  .command('check <policy>')
  .description('Validate a project against a YAML compliance policy')
  .option('--config <path>', 'Path to comply.yaml (default: ./comply.yaml)')
  .addHelpText('after', `
Examples:
  agent-comply check policy.yaml                              validate ./comply.yaml against policy
  agent-comply check policy.yaml --config ./compliance/comply.yaml  use custom comply.yaml path`)
  .action((policyPath: string, opts: { config?: string }) => {
    sendTelemetry({ command: 'check', version: CLI_VERSION });
    if (policyPath.includes('\0')) {
      process.stderr.write('\nError: Invalid path — null bytes are not allowed\n');
      process.exit(2);
    }
    if (opts.config && opts.config.includes('\0')) {
      process.stderr.write('\nError: Invalid --config path — null bytes are not allowed\n');
      process.exit(2);
    }
    if (!checkUsageLimit()) process.exit(1);
    process.on('exit', trackUsageAfterRun);
    runCheck(policyPath, opts.config);
  });

program
  .command('report')
  .description('Generate a compliance summary report')
  .option('--config <path>', 'Path to comply.yaml (default: ./comply.yaml)')
  .option('--policy <path>', 'Path to policy.yaml (optional, adds violation checks)')
  .option('--standard <name>', 'Compliance standard to reference (e.g. eu-ai-act)', 'eu-ai-act')
  .option('--format <format>', 'Output format: sarif, junit (for CI integration)')
  .option('--output <file>', 'Write format output to file instead of stdout')
  .action((opts: { config?: string; policy?: string; standard?: string; format?: string; output?: string }) => {
    sendTelemetry({ command: 'report', version: CLI_VERSION });
    for (const [flag, val] of [['--config', opts.config], ['--policy', opts.policy], ['--output', opts.output]] as [string, string | undefined][]) {
      if (val && val.includes('\0')) {
        process.stderr.write(`\nError: Invalid ${flag} path — null bytes are not allowed\n`);
        process.exit(2);
      }
    }
    if (!checkUsageLimit()) process.exit(1);
    process.on('exit', trackUsageAfterRun);
    runReport(opts.config, opts.policy, opts.standard, opts.format, opts.output);
  });

program.action(() => {
  const extra = process.argv.slice(2).filter(a => !a.startsWith('-'));
  if (extra.length > 0) {
    process.stderr.write(`\nError: Unknown command '${extra[0]}'\nRun 'agent-comply --help' for usage.\n\n`);
    process.exit(2);
  }
  program.help(); // exits 0
});

program.parse();
