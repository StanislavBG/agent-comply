import { readFileSync, statSync } from 'fs';
import { globSync } from 'glob';
import { resolve, relative } from 'path';
const PROVIDER_PATTERNS = [
    {
        provider: 'anthropic',
        patterns: [
            /from ['"]@anthropic-ai\/sdk['"]/,
            /require\(['"]@anthropic-ai\/sdk['"]\)/,
            /import.*anthropic/i,
            /Anthropic\s*\(/,
            /claude-[0-9]/,
            /claude-opus|claude-sonnet|claude-haiku/,
            /ANTHROPIC_API_KEY/,
        ],
    },
    {
        provider: 'openai',
        patterns: [
            /from ['"]openai['"]/,
            /require\(['"]openai['"]\)/,
            /import.*openai/i,
            /OpenAI\s*\(/,
            /gpt-[0-9]/,
            /OPENAI_API_KEY/,
        ],
    },
    {
        provider: 'google',
        patterns: [
            /from ['"]@google\/generative-ai['"]/,
            /require\(['"]@google\/generative-ai['"]\)/,
            /gemini-/,
            /GOOGLE_API_KEY|GEMINI_API_KEY/,
        ],
    },
    {
        provider: 'cohere',
        patterns: [
            /from ['"]cohere-ai['"]/,
            /require\(['"]cohere-ai['"]\)/,
            /CO_API_KEY|COHERE_API_KEY/,
        ],
    },
    {
        provider: 'mistral',
        patterns: [
            /from ['"]@mistralai\/mistralai['"]/,
            /MISTRAL_API_KEY/,
        ],
    },
    {
        provider: 'huggingface',
        patterns: [
            /from ['"]@huggingface\/inference['"]/,
            /HuggingFace|huggingface/,
            /HF_API_KEY|HUGGINGFACE_API_KEY/,
        ],
    },
    {
        provider: 'azure-openai',
        patterns: [
            /AZURE_OPENAI/,
            /azure.*openai/i,
            /openai.*azure/i,
        ],
    },
    {
        provider: 'bedrock',
        patterns: [
            /BedrockRuntime/,
            /aws.*bedrock/i,
            /@aws-sdk\/client-bedrock/,
        ],
    },
    {
        // Claude CLI invocation — used by autonomous agent systems like Bilko
        // that call the claude binary directly instead of using the SDK
        provider: 'anthropic-cli',
        patterns: [
            /spawn\s*\(\s*['"]claude['"]/,
            /exec\s*\(\s*['"]claude\s/,
            /execFile\s*\(\s*['"]claude['"]/,
            /execa\s*\(\s*['"]claude['"]/,
            /['"](claude)\s+-p/,
            /claude\s+--no-session/,
        ],
    },
];
const SCAN_EXTENSIONS = ['ts', 'js', 'mts', 'mjs', 'py', 'go', 'rs'];
const EXCLUDE_DIRS = ['node_modules', 'dist', '.git', '__pycache__', 'target', 'vendor'];
export function scanDirectory(rootDir) {
    const results = [];
    const absRoot = resolve(rootDir);
    // Handle single-file targets
    let files;
    try {
        const stat = statSync(absRoot);
        if (stat.isFile()) {
            files = [absRoot];
        }
        else {
            const pattern = `**/*.{${SCAN_EXTENSIONS.join(',')}}`;
            const ignore = EXCLUDE_DIRS.map(d => `**/${d}/**`);
            files = globSync(pattern, { cwd: absRoot, ignore, absolute: true });
        }
    }
    catch {
        return results;
    }
    for (const file of files) {
        let content;
        try {
            content = readFileSync(file, 'utf-8');
        }
        catch {
            continue;
        }
        const relPath = relative(absRoot, file) || file; // for single-file, use basename
        const lines = content.split('\n');
        const seen = new Set(); // dedupe per file per provider
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const { provider, patterns } of PROVIDER_PATTERNS) {
                const key = `${file}:${provider}`;
                if (seen.has(key))
                    continue;
                for (const pattern of patterns) {
                    if (pattern.test(line)) {
                        results.push({
                            file: relPath,
                            line: i + 1,
                            provider,
                            pattern: pattern.source,
                        });
                        seen.add(key);
                        break;
                    }
                }
            }
        }
    }
    return results;
}
//# sourceMappingURL=index.js.map