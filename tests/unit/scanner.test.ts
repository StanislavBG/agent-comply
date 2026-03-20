import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { scanDirectory } from '../../src/scanner/index.js';

const TMP = '/tmp/agent-comply-test-scan';

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
  writeFileSync(join(TMP, 'openai_usage.ts'), `import OpenAI from 'openai';\nconst client = new OpenAI();\n`);
  writeFileSync(join(TMP, 'anthropic_usage.ts'), `import Anthropic from '@anthropic-ai/sdk';\n`);
  writeFileSync(join(TMP, 'google_usage.ts'), `import { GoogleGenerativeAI } from '@google/generative-ai';\n`);
  writeFileSync(join(TMP, 'bedrock_usage.ts'), `const { BedrockRuntime } = require('@aws-sdk/client-bedrock-runtime');\n`);
  writeFileSync(join(TMP, 'plain.ts'), `const x = 1;\nexport default x;\n`);
  writeFileSync(join(TMP, 'env_usage.ts'), `const key = process.env.ANTHROPIC_API_KEY;\n`);
  mkdirSync(join(TMP, 'node_modules', 'openai'), { recursive: true });
  writeFileSync(join(TMP, 'node_modules', 'openai', 'index.js'), `import OpenAI from 'openai';`);
});

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('scanDirectory', () => {
  it('detects openai import', () => {
    const results = scanDirectory(TMP);
    const found = results.filter(r => r.provider === 'openai');
    expect(found.length).toBeGreaterThan(0);
  });

  it('detects anthropic import', () => {
    const results = scanDirectory(TMP);
    const found = results.filter(r => r.provider === 'anthropic');
    expect(found.length).toBeGreaterThan(0);
  });

  it('detects google import', () => {
    const results = scanDirectory(TMP);
    const found = results.filter(r => r.provider === 'google');
    expect(found.length).toBeGreaterThan(0);
  });

  it('detects bedrock usage', () => {
    const results = scanDirectory(TMP);
    const found = results.filter(r => r.provider === 'bedrock');
    expect(found.length).toBeGreaterThan(0);
  });

  it('detects ANTHROPIC_API_KEY env var pattern', () => {
    const results = scanDirectory(TMP);
    const found = results.filter(r => r.provider === 'anthropic' && r.file.includes('env_usage'));
    expect(found.length).toBeGreaterThan(0);
  });

  it('returns line numbers > 0', () => {
    const results = scanDirectory(TMP);
    for (const r of results) {
      expect(r.line).toBeGreaterThan(0);
    }
  });

  it('excludes node_modules', () => {
    const results = scanDirectory(TMP);
    for (const r of results) {
      expect(r.file).not.toContain('node_modules');
    }
  });

  it('returns no results for plain file with no AI usage', () => {
    const results = scanDirectory(TMP);
    const found = results.filter(r => r.file.includes('plain.ts'));
    expect(found.length).toBe(0);
  });
});
