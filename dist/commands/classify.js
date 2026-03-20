import { scanDirectory } from '../scanner/index.js';
const PROHIBITED_SIGNALS = [
    { pattern: /social.?scor/i, tier: 'prohibited', reason: 'Social scoring (Art. 5(1)(c))' },
    { pattern: /subliminal|manipulat/i, tier: 'prohibited', reason: 'Subliminal manipulation (Art. 5(1)(a))' },
    { pattern: /real.?time.*biometric/i, tier: 'prohibited', reason: 'Real-time biometric surveillance (Art. 5(1)(d))' },
    { pattern: /emotion.?recogni.*workplace|emotion.?recogni.*school/i, tier: 'prohibited', reason: 'Emotion recognition in workplace/school (Art. 5(1)(f))' },
];
const HIGH_RISK_SIGNALS = [
    { pattern: /biometric|facial.?recogni|face.?recogni|voice.?id/i, tier: 'high', reason: 'Biometric identification (Annex III §1)' },
    { pattern: /critical.?infra|power.?grid|water.?system|transport/i, tier: 'high', reason: 'Critical infrastructure (Annex III §2)' },
    { pattern: /student|education.*assess|exam.*grade|admission/i, tier: 'high', reason: 'Education assessment (Annex III §3)' },
    { pattern: /employ|recruit|cv.?screen|job.?applic|hiring/i, tier: 'high', reason: 'Employment / CV screening (Annex III §4)' },
    { pattern: /credit.?scor|loan|insur.*eligib|benefit.*eligib/i, tier: 'high', reason: 'Essential services / credit scoring (Annex III §5)' },
    { pattern: /law.?enforce|police|criminal|court|justice/i, tier: 'high', reason: 'Law enforcement (Annex III §6)' },
    { pattern: /immigrat|asylum|border.?control|visa/i, tier: 'high', reason: 'Migration / border control (Annex III §7)' },
    { pattern: /election|democracy|vote|ballot/i, tier: 'high', reason: 'Democratic processes (Annex III §8)' },
    { pattern: /medical.?diagnos|health.*assess|clinical|patient/i, tier: 'high', reason: 'Healthcare diagnosis (Annex III §2)' },
];
const LIMITED_SIGNALS = [
    { pattern: /chatbot|assistant|chat|convers/i, tier: 'limited', reason: 'Chatbot / conversational AI (Art. 52 disclosure)' },
    { pattern: /generat|synthe|deepfake|image.?gen|text.?gen/i, tier: 'limited', reason: 'Content generation (Art. 52 disclosure)' },
    { pattern: /translat|summar|transcri/i, tier: 'limited', reason: 'General purpose AI (Art. 52 disclosure)' },
    { pattern: /emotion.?recogni|affect.?recogni/i, tier: 'limited', reason: 'Emotion recognition (Art. 52 disclosure)' },
];
function classifyFile(file, provider) {
    const context = file.toLowerCase();
    for (const signal of PROHIBITED_SIGNALS) {
        if (signal.pattern.test(context))
            return { tier: signal.tier, reason: signal.reason };
    }
    for (const signal of HIGH_RISK_SIGNALS) {
        if (signal.pattern.test(context))
            return { tier: signal.tier, reason: signal.reason };
    }
    for (const signal of LIMITED_SIGNALS) {
        if (signal.pattern.test(context))
            return { tier: signal.tier, reason: signal.reason };
    }
    // Default: limited — AI usage always carries disclosure obligations
    return { tier: 'limited', reason: `AI provider (${provider}) — default limited tier (Art. 52 disclosure required)` };
}
const TIER_ORDER = { prohibited: 4, high: 3, limited: 2, minimal: 1 };
const TIER_LABEL = {
    prohibited: '✗ PROHIBITED',
    high: '⚠ HIGH',
    limited: '~ LIMITED',
    minimal: '✓ MINIMAL',
};
export function runClassify(targetPath) {
    console.log(`\nScanning: ${targetPath}\n`);
    const results = scanDirectory(targetPath);
    if (results.length === 0) {
        console.log('No AI provider usage detected.\n');
        return;
    }
    // Dedupe by file+provider, keep highest risk
    const byFileProvider = new Map();
    for (const r of results) {
        const key = `${r.file}::${r.provider}`;
        const classification = classifyFile(r.file, r.provider);
        const existing = byFileProvider.get(key);
        if (!existing || TIER_ORDER[classification.tier] > TIER_ORDER[existing.tier]) {
            byFileProvider.set(key, { ...classification, provider: r.provider, file: r.file, line: r.line });
        }
    }
    // Aggregate to overall project tier
    let projectTier = 'minimal';
    const entries = [...byFileProvider.values()];
    for (const e of entries) {
        if (TIER_ORDER[e.tier] > TIER_ORDER[projectTier])
            projectTier = e.tier;
    }
    // Print table
    console.log('── AI USAGE DETECTED ────────────────────────────────────────');
    console.log(`${'FILE'.padEnd(50)} ${'PROVIDER'.padEnd(15)} ${'RISK TIER'.padEnd(15)} REASON`);
    console.log('─'.repeat(120));
    // Sort by tier descending
    entries.sort((a, b) => TIER_ORDER[b.tier] - TIER_ORDER[a.tier]);
    for (const e of entries) {
        const file = e.file.length > 48 ? '...' + e.file.slice(-45) : e.file;
        console.log(`${file.padEnd(50)} ${e.provider.padEnd(15)} ${TIER_LABEL[e.tier].padEnd(15)} ${e.reason}`);
    }
    console.log('─'.repeat(120));
    console.log('');
    console.log(`PROVIDERS FOUND: ${[...new Set(entries.map(e => e.provider))].join(', ')}`);
    console.log(`FILES WITH AI:   ${new Set(entries.map(e => e.file)).size}`);
    console.log('');
    const tierCounts = { prohibited: 0, high: 0, limited: 0, minimal: 0 };
    for (const e of entries)
        tierCounts[e.tier]++;
    console.log('RISK DISTRIBUTION:');
    console.log(`  prohibited: ${tierCounts.prohibited}`);
    console.log(`  high:       ${tierCounts.high}`);
    console.log(`  limited:    ${tierCounts.limited}`);
    console.log(`  minimal:    ${tierCounts.minimal}`);
    console.log('');
    console.log(`OVERALL PROJECT TIER: ${TIER_LABEL[projectTier]}`);
    console.log('');
    if (projectTier === 'prohibited') {
        console.log('ACTION REQUIRED: Remove or redesign prohibited AI use cases before deployment.');
        process.exit(1);
    }
    else if (projectTier === 'high') {
        console.log('ACTION REQUIRED: High-risk systems need conformity assessment, human oversight,');
        console.log('  model cards, data documentation, and registration in the EU AI Act database.');
    }
    else if (projectTier === 'limited') {
        console.log('ACTION REQUIRED: Disclose AI usage to end users (Art. 52). Run `agent-comply check`');
        console.log('  against a policy to verify documentation requirements.');
    }
    else {
        console.log('No significant compliance obligations detected for this tier.');
    }
    console.log('');
}
//# sourceMappingURL=classify.js.map