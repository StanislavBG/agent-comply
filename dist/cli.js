#!/usr/bin/env node
import { Command } from 'commander';
import { runClassify } from './commands/classify.js';
import { runCheck } from './commands/check.js';
import { runReport } from './commands/report.js';
import { runScan } from './commands/scan.js';
import { runInit } from './commands/init.js';
import { sendTelemetry } from './telemetry.js';
const program = new Command();
program
    .name('agent-comply')
    .description('EU AI Act compliance CLI — classify, check, and report AI system compliance')
    .version('0.2.6')
    .addHelpText('after', `
Examples:
  agent-comply init                                  scaffold comply.yaml
  agent-comply classify .                            detect AI usage + classify risk tier
  agent-comply check ./policies/eu-ai-act.yaml       validate against EU AI Act policy
  agent-comply report --policy ./policies/eu-ai-act.yaml  full compliance report`);
program
    .command('init')
    .description('Generate a comply.yaml scaffold (auto-detects AI providers in current directory)')
    .option('--output <path>', 'Output path (default: ./comply.yaml)')
    .action((opts) => {
    sendTelemetry({ command: 'init', version: '0.2.6' });
    if (opts.output && opts.output.includes('\0')) {
        process.stderr.write('\nError: Invalid output path — null bytes are not allowed\n');
        process.exit(2);
    }
    runInit(opts.output);
});
program
    .command('scan <path>')
    .description('Detect AI provider usage in a codebase (raw scan, no classification)')
    .addHelpText('after', `
Examples:
  agent-comply scan .                scan current directory
  agent-comply scan ./src            scan src/ only`)
    .action((targetPath) => {
    sendTelemetry({ command: 'scan', version: '0.2.6' });
    if (targetPath.includes('\0')) {
        process.stderr.write('\nError: Invalid path — null bytes are not allowed\n');
        process.exit(2);
    }
    runScan(targetPath);
});
program
    .command('classify <path>')
    .description('Scan a codebase for AI model usage and classify risk tier (EU AI Act Annex III)')
    .action((targetPath) => {
    sendTelemetry({ command: 'classify', version: '0.2.6' });
    if (targetPath.includes('\0')) {
        process.stderr.write('\nError: Invalid path — null bytes are not allowed\n');
        process.exit(2);
    }
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
    .action((policyPath, opts) => {
    sendTelemetry({ command: 'check', version: '0.2.6' });
    if (policyPath.includes('\0')) {
        process.stderr.write('\nError: Invalid path — null bytes are not allowed\n');
        process.exit(2);
    }
    if (opts.config && opts.config.includes('\0')) {
        process.stderr.write('\nError: Invalid --config path — null bytes are not allowed\n');
        process.exit(2);
    }
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
    .action((opts) => {
    sendTelemetry({ command: 'report', version: '0.2.6' });
    for (const [flag, val] of [['--config', opts.config], ['--policy', opts.policy], ['--output', opts.output]]) {
        if (val && val.includes('\0')) {
            process.stderr.write(`\nError: Invalid ${flag} path — null bytes are not allowed\n`);
            process.exit(2);
        }
    }
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
//# sourceMappingURL=cli.js.map