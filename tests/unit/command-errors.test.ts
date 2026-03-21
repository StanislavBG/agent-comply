import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { scanDirectory } from '../../src/scanner/index.js';
import { runScan } from '../../src/commands/scan.js';
import { runClassify } from '../../src/commands/classify.js';

// Helper: mock process.exit so it throws instead of killing the test runner
function mockProcessExit() {
  return vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`process.exit:${code}`);
  }) as unknown as typeof process.exit);
}

describe('scanDirectory — edge cases', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-comply-edge-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('throws "Path not found" for non-existent path', () => {
    expect(() => scanDirectory('/nonexistent/path/agent-comply-12345')).toThrow('Path not found');
  });

  it('returns empty array for directory with no AI usage', () => {
    fs.writeFileSync(path.join(tmpDir, 'plain.ts'), 'const x = 1;\nexport default x;\n');
    const results = scanDirectory(tmpDir);
    expect(results).toHaveLength(0);
  });

  it('returns empty array for completely empty directory', () => {
    const results = scanDirectory(tmpDir);
    expect(results).toHaveLength(0);
  });

  it('scans a single file directly (not a directory)', () => {
    const filePath = path.join(tmpDir, 'single.ts');
    fs.writeFileSync(filePath, "import OpenAI from 'openai';\n");
    const results = scanDirectory(filePath);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].provider).toBe('openai');
  });

  it('handles file with only empty lines (no AI usage)', () => {
    fs.writeFileSync(path.join(tmpDir, 'empty.ts'), '\n\n\n');
    const results = scanDirectory(tmpDir);
    expect(results).toHaveLength(0);
  });

  it('deduplicates provider per file (multiple openai patterns → 1 result)', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'multi.ts'),
      [
        "import OpenAI from 'openai';",
        'const client = new OpenAI();',
        'const key = process.env.OPENAI_API_KEY;',
      ].join('\n')
    );
    const results = scanDirectory(tmpDir);
    const openaiResults = results.filter((r) => r.provider === 'openai');
    expect(openaiResults).toHaveLength(1);
  });

  it('returns line numbers starting at 1', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'check-lines.ts'),
      "import Anthropic from '@anthropic-ai/sdk';\n"
    );
    const results = scanDirectory(tmpDir);
    expect(results[0].line).toBe(1);
  });

  it('detects multi-provider project correctly', () => {
    fs.writeFileSync(path.join(tmpDir, 'a.ts'), "import OpenAI from 'openai';\n");
    fs.writeFileSync(
      path.join(tmpDir, 'b.ts'),
      "import Anthropic from '@anthropic-ai/sdk';\n"
    );
    const results = scanDirectory(tmpDir);
    const providers = new Set(results.map((r) => r.provider));
    expect(providers.has('openai')).toBe(true);
    expect(providers.has('anthropic')).toBe(true);
  });
});

describe('runScan — error handling', () => {
  it('exits 2 when path does not exist', () => {
    const exitSpy = mockProcessExit();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(() => runScan('/nonexistent/path/agent-comply-abcdef')).toThrow('process.exit:2');

    exitSpy.mockRestore();
    errSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('prints error message on bad path', () => {
    const exitSpy = mockProcessExit();
    const errorMessages: string[] = [];
    const errSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((...args) => errorMessages.push(args.join(' ')));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      runScan('/nonexistent/path/agent-comply-xyz');
    } catch {
      // expected
    }

    expect(errorMessages.some((m) => m.includes('Error'))).toBe(true);
    exitSpy.mockRestore();
    errSpy.mockRestore();
    logSpy.mockRestore();
  });
});

describe('runClassify — error handling', () => {
  it('exits 2 when path does not exist', () => {
    const exitSpy = mockProcessExit();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    expect(() => runClassify('/nonexistent/path/agent-comply-abcdef')).toThrow('process.exit:2');

    exitSpy.mockRestore();
    errSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('prints help suggestion on bad path', () => {
    const exitSpy = mockProcessExit();
    const errorMessages: string[] = [];
    const errSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((...args) => errorMessages.push(args.join(' ')));
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      runClassify('/nonexistent/path/agent-comply-xyz');
    } catch {
      // expected
    }

    expect(errorMessages.some((m) => m.includes('classify'))).toBe(true);
    exitSpy.mockRestore();
    errSpy.mockRestore();
    logSpy.mockRestore();
  });
});
