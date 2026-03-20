import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';
function loadRules() {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const rulesPath = path.join(__dirname, 'rules', 'eu-ai-act.yaml');
    const content = fs.readFileSync(rulesPath, 'utf-8');
    return yaml.load(content);
}
function tierPriority(tier) {
    const priorities = {
        unacceptable: 4,
        high: 3,
        limited: 2,
        minimal: 1,
        unknown: 0,
    };
    return priorities[tier];
}
export function classifyProject(projectDir) {
    const rules = loadRules();
    const findings = [];
    const warnings = [];
    const sourceFiles = collectSourceFiles(projectDir);
    for (const file of sourceFiles) {
        const fileFindings = analyzeFile(file, rules, projectDir);
        findings.push(...fileFindings);
    }
    // Check for high-risk keywords in config files
    const configFiles = collectConfigFiles(projectDir);
    for (const file of configFiles) {
        const configFindings = analyzeConfigFile(file, rules, projectDir);
        findings.push(...configFindings);
    }
    const providers = [...new Set(findings.map(f => f.provider))];
    // Determine overall tier (highest risk wins)
    let overallTier = findings.length > 0 ? 'minimal' : 'unknown';
    for (const finding of findings) {
        if (tierPriority(finding.tier) > tierPriority(overallTier)) {
            overallTier = finding.tier;
        }
    }
    // Add warnings for missing documentation
    if (overallTier === 'high') {
        warnings.push('HIGH RISK: Requires risk management system, human oversight declaration, and technical documentation');
        warnings.push('HIGH RISK: Model cards and data documentation are mandatory');
    }
    else if (overallTier === 'limited') {
        warnings.push('LIMITED RISK: Transparency notices required for end users');
    }
    // Check for missing package.json AI documentation
    const pkgPath = path.join(projectDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (!pkg.aiCompliance && findings.length > 0) {
                warnings.push('MISSING: No "aiCompliance" field in package.json — add model declarations');
            }
        }
        catch {
            // ignore
        }
    }
    return { tier: overallTier, findings, providers, warnings };
}
function collectSourceFiles(dir) {
    const files = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rb'];
    const skipDirs = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'venv'];
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
            else if (extensions.includes(path.extname(entry.name))) {
                files.push(path.join(currentDir, entry.name));
            }
        }
    }
    walk(dir);
    return files;
}
function collectConfigFiles(dir) {
    const files = [];
    const configNames = ['.env', '.env.local', '.env.production', 'config.yaml', 'config.yml', 'config.json', 'ai-config.yaml'];
    const skipDirs = ['node_modules', '.git', 'dist', 'build'];
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
            else if (configNames.includes(entry.name) || entry.name.endsWith('.env')) {
                files.push(path.join(currentDir, entry.name));
            }
        }
    }
    walk(dir);
    return files;
}
function analyzeFile(filePath, rules, projectDir) {
    const findings = [];
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    }
    catch {
        return findings;
    }
    const lines = content.split('\n');
    const relPath = path.relative(projectDir, filePath);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Check import patterns
        for (const importPattern of rules.import_patterns) {
            const regex = new RegExp(importPattern.pattern, 'i');
            if (regex.test(line) && (line.includes('import') || line.includes('require') || line.includes('from'))) {
                const providerConfig = rules.model_patterns[importPattern.provider];
                const tier = providerConfig ? providerConfig.default_tier : 'limited';
                findings.push({
                    provider: importPattern.provider,
                    file: relPath,
                    line: i + 1,
                    evidence: line.trim(),
                    tier,
                });
            }
        }
        // Check for high-risk keywords
        for (const [tierName, tierConfig] of Object.entries(rules.risk_tiers)) {
            for (const keyword of tierConfig.keywords || []) {
                if (line.toLowerCase().includes(keyword.toLowerCase())) {
                    findings.push({
                        provider: 'keyword-match',
                        file: relPath,
                        line: i + 1,
                        evidence: line.trim(),
                        tier: tierName,
                    });
                }
            }
        }
    }
    return findings;
}
function analyzeConfigFile(filePath, rules, projectDir) {
    const findings = [];
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    }
    catch {
        return findings;
    }
    const lines = content.split('\n');
    const relPath = path.relative(projectDir, filePath);
    const apiKeyPatterns = [
        { pattern: /OPENAI_API_KEY/i, provider: 'openai' },
        { pattern: /ANTHROPIC_API_KEY/i, provider: 'anthropic' },
        { pattern: /GOOGLE_AI_KEY|GEMINI_API_KEY/i, provider: 'google' },
        { pattern: /HUGGINGFACE_API_KEY|HF_TOKEN/i, provider: 'huggingface' },
        { pattern: /COHERE_API_KEY/i, provider: 'cohere' },
        { pattern: /AZURE_OPENAI_KEY/i, provider: 'azure' },
        { pattern: /AWS_BEDROCK|BEDROCK_API/i, provider: 'aws' },
    ];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const { pattern, provider } of apiKeyPatterns) {
            if (pattern.test(line)) {
                const providerConfig = rules.model_patterns[provider];
                findings.push({
                    provider,
                    file: relPath,
                    line: i + 1,
                    evidence: line.replace(/=.*/, '=[REDACTED]').trim(),
                    tier: providerConfig?.default_tier ?? 'limited',
                });
            }
        }
    }
    return findings;
}
//# sourceMappingURL=classifier.js.map