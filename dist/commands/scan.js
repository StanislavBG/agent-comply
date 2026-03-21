import { scanDirectory } from '../scanner/index.js';
export function runScan(targetPath) {
    console.log(`\nScanning: ${targetPath}\n`);
    let results = [];
    try {
        results = scanDirectory(targetPath);
    }
    catch (e) {
        console.error(`\nError: ${e.message}`);
        console.error(`Run 'agent-comply scan --help' for usage.\n`);
        process.exit(2);
    }
    if (results.length === 0) {
        console.log('No AI provider usage detected.\n');
        return;
    }
    // Group by provider
    const byProvider = new Map();
    for (const r of results) {
        const list = byProvider.get(r.provider) ?? [];
        list.push(r);
        byProvider.set(r.provider, list);
    }
    const allFiles = new Set(results.map(r => r.file));
    const providers = [...byProvider.keys()].sort();
    console.log('── AI PROVIDER SCAN RESULTS ─────────────────────────────────');
    console.log(`${'FILE'.padEnd(55)} ${'PROVIDER'.padEnd(15)} LINE`);
    console.log('─'.repeat(80));
    // Sort results by provider then file
    const sorted = [...results].sort((a, b) => a.provider.localeCompare(b.provider) || a.file.localeCompare(b.file));
    for (const r of sorted) {
        const file = r.file.length > 53 ? '...' + r.file.slice(-50) : r.file;
        console.log(`${file.padEnd(55)} ${r.provider.padEnd(15)} ${r.line}`);
    }
    console.log('─'.repeat(80));
    console.log('');
    console.log(`PROVIDERS: ${providers.join(', ')}`);
    console.log(`FILES:     ${allFiles.size}`);
    console.log(`MATCHES:   ${results.length}`);
    console.log('');
    console.log('Next steps:');
    console.log('  agent-comply classify <path>   — add EU AI Act risk tier classification');
    console.log('  agent-comply init              — generate comply.yaml to document these models');
    console.log('');
}
//# sourceMappingURL=scan.js.map