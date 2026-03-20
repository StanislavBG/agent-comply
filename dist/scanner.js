import * as fs from 'fs';
import * as path from 'path';
const AI_IMPORT_PATTERNS = [
    { pattern: /['"]openai['"]/i, provider: 'openai' },
    { pattern: /['"]@anthropic-ai\/sdk['"]/i, provider: 'anthropic' },
    { pattern: /['"]anthropic['"]/i, provider: 'anthropic' },
    { pattern: /['"]@google\/generative-ai['"]/i, provider: 'google' },
    { pattern: /['"]@huggingface\/inference['"]/i, provider: 'huggingface' },
    { pattern: /['"]@huggingface\/hub['"]/i, provider: 'huggingface' },
    { pattern: /['"]cohere-ai['"]/i, provider: 'cohere' },
    { pattern: /['"]langchain['"]/i, provider: 'langchain' },
    { pattern: /['"]@langchain\//i, provider: 'langchain' },
    { pattern: /['"]llamaindex['"]/i, provider: 'llamaindex' },
    { pattern: /['"]replicate['"]/i, provider: 'replicate' },
    { pattern: /from openai/i, provider: 'openai' },
    { pattern: /import openai/i, provider: 'openai' },
    { pattern: /from anthropic/i, provider: 'anthropic' },
    { pattern: /import anthropic/i, provider: 'anthropic' },
];
const MODEL_STRING_PATTERNS = [
    { pattern: /gpt-4o?(?:-turbo|-mini|-preview)?/i, model: 'gpt-4', provider: 'openai' },
    { pattern: /gpt-3\.5-turbo/i, model: 'gpt-3.5-turbo', provider: 'openai' },
    { pattern: /claude-(?:opus|sonnet|haiku|3|2|instant)/i, model: 'claude', provider: 'anthropic' },
    { pattern: /gemini-(?:pro|ultra|flash|1\.5)/i, model: 'gemini', provider: 'google' },
    { pattern: /llama-?[23]?(?:-\d+b)?/i, model: 'llama', provider: 'meta' },
    { pattern: /mistral-?(?:\d+b|7b|8x7b)?/i, model: 'mistral', provider: 'mistral' },
    { pattern: /dall-?e-?[23]?/i, model: 'dall-e', provider: 'openai' },
    { pattern: /whisper-?(?:large|medium|small|tiny)?/i, model: 'whisper', provider: 'openai' },
    { pattern: /text-embedding-(?:ada|3)/i, model: 'text-embedding', provider: 'openai' },
];
const PROMPT_TEMPLATE_PATTERNS = [
    /system_prompt\s*[=:]/i,
    /systemPrompt\s*[=:]/i,
    /messages\s*=\s*\[/,
    /role:\s*['"]system['"]/,
    /role:\s*['"]user['"]/,
    /SYSTEM_PROMPT/,
    /PROMPT_TEMPLATE/,
];
const API_KEY_PATTERNS = [
    { pattern: /OPENAI_API_KEY/i, provider: 'openai' },
    { pattern: /ANTHROPIC_API_KEY/i, provider: 'anthropic' },
    { pattern: /GOOGLE_AI_KEY|GEMINI_API_KEY|GOOGLE_APPLICATION_CREDENTIALS/i, provider: 'google' },
    { pattern: /HUGGINGFACE_API_KEY|HF_TOKEN/i, provider: 'huggingface' },
    { pattern: /COHERE_API_KEY/i, provider: 'cohere' },
    { pattern: /AZURE_OPENAI_KEY|AZURE_OPENAI_API_KEY/i, provider: 'azure' },
    { pattern: /AWS_BEDROCK|BEDROCK_API_KEY/i, provider: 'aws' },
    { pattern: /REPLICATE_API_TOKEN/i, provider: 'replicate' },
];
export function scanProject(projectDir) {
    const result = {
        projectDir,
        aiImports: [],
        envKeys: [],
        promptTemplates: [],
        modelReferences: [],
        configFiles: [],
        summary: {
            totalFiles: 0,
            filesWithAI: 0,
            providersDetected: [],
        },
    };
    const sourceFiles = collectFiles(projectDir, ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py']);
    const configFiles = collectFiles(projectDir, ['.env', '.yaml', '.yml', '.json', '.toml']);
    const envFiles = collectFiles(projectDir, ['.env']).concat(collectFiles(projectDir, ['']).filter(f => path.basename(f).startsWith('.env')));
    result.summary.totalFiles = sourceFiles.length + configFiles.length;
    const filesWithAI = new Set();
    // Scan source files
    for (const file of sourceFiles) {
        const relPath = path.relative(projectDir, file);
        let content;
        try {
            content = fs.readFileSync(file, 'utf-8');
        }
        catch {
            continue;
        }
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Check AI imports
            for (const { pattern, provider } of AI_IMPORT_PATTERNS) {
                if (pattern.test(line)) {
                    result.aiImports.push({ file: relPath, line: i + 1, import: line.trim(), provider });
                    filesWithAI.add(file);
                }
            }
            // Check model string references
            for (const { pattern, model, provider } of MODEL_STRING_PATTERNS) {
                if (pattern.test(line)) {
                    result.modelReferences.push({ file: relPath, line: i + 1, model, provider });
                    filesWithAI.add(file);
                }
            }
            // Check prompt templates
            for (const pattern of PROMPT_TEMPLATE_PATTERNS) {
                if (pattern.test(line)) {
                    result.promptTemplates.push({ file: relPath, line: i + 1, snippet: line.trim().substring(0, 80) });
                    filesWithAI.add(file);
                    break;
                }
            }
        }
    }
    // Scan env/config files for API keys
    const allEnvFiles = [...new Set([...envFiles, ...configFiles])];
    for (const file of allEnvFiles) {
        const relPath = path.relative(projectDir, file);
        let content;
        try {
            content = fs.readFileSync(file, 'utf-8');
        }
        catch {
            continue;
        }
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const { pattern, provider } of API_KEY_PATTERNS) {
                if (pattern.test(line)) {
                    result.envKeys.push({ file: relPath, key: line.split('=')[0].trim(), provider });
                }
            }
        }
        // Track interesting config files
        const basename = path.basename(file);
        if (basename.includes('ai') || basename.includes('openai') || basename.includes('llm')) {
            result.configFiles.push(relPath);
        }
    }
    result.summary.filesWithAI = filesWithAI.size;
    const allProviders = [
        ...result.aiImports.map(i => i.provider),
        ...result.envKeys.map(k => k.provider),
        ...result.modelReferences.map(m => m.provider),
    ];
    result.summary.providersDetected = [...new Set(allProviders)];
    return result;
}
function collectFiles(dir, extensions) {
    const files = [];
    const skipDirs = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'venv', '.next', '.nuxt'];
    function walk(currentDir) {
        let entries;
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (!skipDirs.includes(entry.name)) {
                    walk(path.join(currentDir, entry.name));
                }
            }
            else {
                const ext = path.extname(entry.name);
                const base = entry.name;
                if (extensions.includes(ext) || extensions.some(e => e === '' && base.startsWith('.env'))) {
                    files.push(path.join(currentDir, entry.name));
                }
            }
        }
    }
    walk(dir);
    return files;
}
//# sourceMappingURL=scanner.js.map