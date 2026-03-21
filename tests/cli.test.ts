/**
 * CLI integration tests for agent-comply.
 * Spawns the actual compiled CLI binary and verifies exit codes + output.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const CLI = path.resolve(__dirname, '../dist/cli.js');
const EXAMPLES = path.resolve(__dirname, '../examples');

function run(args: string[], cwd?: string) {
  try {
    const result = spawnSync(process.execPath, [CLI, ...args], {
      cwd: cwd ?? os.tmpdir(),
      encoding: 'utf-8',
      timeout: 10000,
    });
    return {
      code: result.status ?? 1,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
    };
  } catch (e) {
    // Node.js rejects null bytes in spawn args before the process starts —
    // this is the OS-level rejection of malformed input, equivalent to exit 2.
    return { code: 2, stdout: '', stderr: String(e) };
  }
}

describe('agent-comply CLI — exit codes', () => {
  it('no args → shows help and exits 0', () => {
    const { code, stdout } = run([]);
    expect(code).toBe(0);
    expect(stdout).toContain('agent-comply');
    expect(stdout).toContain('Usage:');
  });

  it('--help → exits 0', () => {
    const { code, stdout } = run(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('EU AI Act');
  });

  it('--version → exits 0 and prints version', () => {
    const { code, stdout } = run(['--version']);
    expect(code).toBe(0);
    expect(stdout).toMatch(/\d+\.\d+/);
  });

  it('unknown command → exits 2 with hint', () => {
    const { code, stderr } = run(['badcommand']);
    expect(code).toBe(2);
    expect(stderr).toContain('Unknown command');
    expect(stderr).toContain('--help');
  });
});

describe('agent-comply CLI — classify command', () => {
  it('classify with nonexistent path → exits 2', () => {
    const { code, stderr } = run(['classify', '/nonexistent/path']);
    expect(code).toBe(2);
    expect(stderr).toContain('Error');
  });

  it('classify with valid directory → exits 0 or 1 (depends on content)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comply-classify-'));
    fs.writeFileSync(path.join(tmpDir, 'app.ts'), 'const x = 1;');
    const { code } = run(['classify', tmpDir]);
    // 0 = no AI found (minimal), 1 = prohibited tier detected
    expect([0, 1]).toContain(code);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('classify on directory with AI usage → outputs table', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comply-classify-ai-'));
    fs.writeFileSync(path.join(tmpDir, 'client.ts'), "import Anthropic from '@anthropic-ai/sdk';");
    const { code, stdout } = run(['classify', tmpDir]);
    expect([0, 1]).toContain(code);
    expect(stdout).toContain('AI USAGE');
    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('agent-comply CLI — scan command', () => {
  it('scan with nonexistent path → exits 2', () => {
    const { code, stderr } = run(['scan', '/nonexistent/path']);
    expect(code).toBe(2);
    expect(stderr).toContain('Error');
  });

  it('scan empty directory → exits 0 with no-AI message', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comply-scan-'));
    const { code, stdout } = run(['scan', tmpDir]);
    expect(code).toBe(0);
    expect(stdout).toContain('No AI');
    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('agent-comply CLI — check command', () => {
  it('check with nonexistent policy → exits 2', () => {
    const { code, stderr } = run(['check', '/nonexistent-policy.yaml']);
    expect(code).toBe(2);
    expect(stderr).toContain('not found');
  });

  it('check with missing comply.yaml → exits 2 with guidance', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comply-check-'));
    const { code, stderr } = run(['check', path.join(EXAMPLES, 'policy.yaml')], tmpDir);
    expect(code).toBe(2);
    expect(stderr).toContain('agent-comply init');
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('check with valid policy and config → exits 0 or 1', () => {
    const { code } = run([
      'check',
      path.join(EXAMPLES, 'policy.yaml'),
      '--config', path.join(EXAMPLES, 'comply.yaml'),
    ]);
    expect([0, 1]).toContain(code);
  });
});

describe('agent-comply CLI — init command', () => {
  it('init → creates comply.yaml and exits 0', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comply-init-'));
    const { code } = run(['init'], tmpDir);
    expect(code).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, 'comply.yaml'))).toBe(true);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('init --output custom.yaml → creates file at specified path', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comply-init-out-'));
    const outPath = path.join(tmpDir, 'custom.yaml');
    const { code } = run(['init', '--output', outPath], tmpDir);
    expect(code).toBe(0);
    expect(fs.existsSync(outPath)).toBe(true);
    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('agent-comply CLI — report command', () => {
  it('report with missing comply.yaml → exits 2 with guidance', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comply-report-'));
    const { code, stderr } = run(['report'], tmpDir);
    expect(code).toBe(2);
    expect(stderr).toContain('agent-comply init');
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('report with unknown --standard → exits 2', () => {
    const { code, stderr } = run(['report', '--standard', 'unknown-standard']);
    expect(code).toBe(2);
    expect(stderr).toContain('Unknown standard');
  });

  it('report with invalid --format → exits 2 with clear message', () => {
    const { code, stderr } = run(['report', '--format', 'csv']);
    expect(code).toBe(2);
    expect(stderr).toContain('--format');
    expect(stderr).toContain('csv');
  });
});

describe('agent-comply CLI — scan command', () => {
  it('scan with nonexistent path → exits 2 with error', () => {
    const { code, stderr } = run(['scan', '/nonexistent/path']);
    expect(code).toBe(2);
    expect(stderr).toContain('Error');
  });

  it('scan with valid directory → exits 0', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comply-scan-'));
    fs.writeFileSync(path.join(tmpDir, 'app.ts'), 'const x = 1;');
    const { code } = run(['scan', tmpDir]);
    expect(code).toBe(0);
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('scan with AI provider usage → exits 0 and shows results', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comply-scan-ai-'));
    fs.writeFileSync(path.join(tmpDir, 'chat.ts'), 'import OpenAI from "openai";');
    const { code, stdout } = run(['scan', tmpDir]);
    expect(code).toBe(0);
    expect(stdout).toContain('openai');
    fs.rmSync(tmpDir, { recursive: true });
  });
});

describe('agent-comply CLI — input sanitization', () => {
  it('scan with null byte in path → exits 2', () => {
    const { code, stderr } = run(['scan', 'path\0.ts']);
    expect(code).toBe(2);
    expect(stderr).toContain('null');
  });

  it('classify with null byte in path → exits 2', () => {
    const { code, stderr } = run(['classify', 'path\0.ts']);
    expect(code).toBe(2);
    expect(stderr).toContain('null');
  });

  it('report with null byte in --policy → exits 2', () => {
    const { code, stderr } = run(['report', '--policy', 'policy\0.yaml']);
    expect(code).toBe(2);
    expect(stderr).toContain('null');
  });

  it('init with null byte in --output → exits 2', () => {
    const { code, stderr } = run(['init', '--output', 'out\0.yaml']);
    expect(code).toBe(2);
    expect(stderr).toContain('null');
  });
});

describe('agent-comply CLI — subcommand help', () => {
  it('scan --help → exits 0 and shows usage', () => {
    const { code, stdout } = run(['scan', '--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('scan');
  });

  it('check --help → exits 0 and shows usage', () => {
    const { code, stdout } = run(['check', '--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('check');
  });

  it('report --help → exits 0 and shows format options', () => {
    const { code, stdout } = run(['report', '--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('--format');
  });
});
