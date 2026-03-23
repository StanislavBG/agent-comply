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

/* ── Usage-based monetization (Preflight Suite — shared) ────────────── */

const CLI_VERSION = '0.2.11';
const TOOL_NAME = 'agent-comply' as const;
const FREE_MONTHLY_LIMIT = 50;
const UPGRADE_URL = 'https://buy.stripe.com/28E00l73Ccu9ePH1S08k802';

// Shared suite directory
const SUITE_DIR = path.join(os.homedir(), '.preflight-suite');
const SUITE_USAGE_FILE = path.join(SUITE_DIR, 'usage.json');
const SUITE_LICENSE_FILE = path.join(SUITE_DIR, 'license.json');

// Legacy per-tool config dir (kept for backwards-compat reads)
const CONFIG_DIR = path.join(os.homedir(), '.config', 'agent-comply');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface SharedUsage {
  month: string; // YYYY-MM
  total: number;
  tools: {
    stepproof: number;
    'agent-comply': number;
    'agent-gate': number;
  };
}

/** Read license key: env var → shared suite → legacy tool config */
function getLicenseKey(): string | undefined {
  const envKey = process.env.COMPLY_KEY;
  if (envKey?.trim()) return envKey.trim();
  try {
    if (fs.existsSync(SUITE_LICENSE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SUITE_LICENSE_FILE, 'utf8')) as { key?: string };
      if (parsed.key?.trim()) return parsed.key.trim();
    }
  } catch { /* ignore */ }
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) as { key?: string };
      if (parsed.key?.trim()) return parsed.key.trim();
    }
  } catch { /* ignore */ }
  return undefined;
}

function isProUser(): boolean {
  const key = getLicenseKey();
  if (!key) return false;
  const result = validate(key);
  return result.valid && result.tier !== 'free';
}

function readSharedUsage(): SharedUsage {
  const currentMonth = new Date().toISOString().slice(0, 7);
  try {
    if (fs.existsSync(SUITE_USAGE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SUITE_USAGE_FILE, 'utf8')) as SharedUsage;
      if (parsed.month === currentMonth) return parsed;
    }
  } catch { /* corrupted — reset */ }
  return { month: currentMonth, total: 0, tools: { stepproof: 0, 'agent-comply': 0, 'agent-gate': 0 } };
}

function writeSharedUsage(record: SharedUsage): void {
  try {
    fs.mkdirSync(SUITE_DIR, { recursive: true });
    fs.writeFileSync(SUITE_USAGE_FILE, JSON.stringify(record, null, 2), 'utf8');
  } catch { /* degrade gracefully */ }
}

function checkUsageLimit(): boolean {
  if (isProUser()) return true;
  const usage = readSharedUsage();
  if (usage.total >= FREE_MONTHLY_LIMIT) {
    process.stderr.write(
      `\n  You've used ${FREE_MONTHLY_LIMIT}/${FREE_MONTHLY_LIMIT} free runs this month.\n` +
      `  Upgrade to Team for unlimited runs: ${UPGRADE_URL}\n` +
      `  Already have a key? agent-comply activate <key>\n\n`
    );
    return false;
  }
  return true;
}

function trackUsageAfterRun(): void {
  if (isProUser()) return;
  const usage = readSharedUsage();
  usage.total += 1;
  usage.tools[TOOL_NAME] = (usage.tools[TOOL_NAME] ?? 0) + 1;
  writeSharedUsage(usage);

  const used = usage.total;
  const remaining = FREE_MONTHLY_LIMIT - used;

  let msg: string;
  if (remaining === 0) {
    msg = `\n  ${used}/${FREE_MONTHLY_LIMIT} free Preflight runs used — cap reached.\n` +
          `  Upgrade to Team for unlimited runs: ${UPGRADE_URL}\n\n`;
  } else if (remaining <= 5) {
    msg = `\n  ${used}/${FREE_MONTHLY_LIMIT} free Preflight runs used — ${remaining} left this month.\n` +
          `  Team tier removes the cap · $49/mo → ${UPGRADE_URL}\n\n`;
  } else {
    msg = `\n  Run ${used} of ${FREE_MONTHLY_LIMIT} free Preflight runs this month.\n\n`;
  }
  process.stderr.write(msg);
}

const program = new Command();

program
  .name('agent-comply')
  .description('EU AI Act compliance CLI — classify, check, and report AI system compliance')
  .version('0.2.11')
  .addHelpText('after', `
Examples:
  agent-comply init                                  scaffold comply.yaml
  agent-comply classify .                            detect AI usage + classify risk tier
  agent-comply check ./policies/eu-ai-act.yaml       validate against EU AI Act policy
  agent-comply report --policy ./policies/eu-ai-act.yaml  full compliance report`);

program
  .command('activate <key>')
  .description('Store a license key for unlimited runs (applies to all Preflight Suite tools)')
  .action((key: string) => {
    const result = validate(key);
    if (!result.valid) {
      process.stderr.write(`\nInvalid license key: ${result.reason}\n\n`);
      process.exit(1);
    }
    try {
      fs.mkdirSync(SUITE_DIR, { recursive: true });
      fs.writeFileSync(SUITE_LICENSE_FILE, JSON.stringify({ key }), 'utf8');
      console.log(`\nLicense activated (${result.tier} — ${result.org}). Unlimited runs enabled across all Preflight Suite tools.\n`);
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
