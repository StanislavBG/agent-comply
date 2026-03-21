import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { scanDirectory } from '../scanner/index.js';
const COMPLY_TEMPLATE = (projectName, providers) => {
    const modelEntries = providers.map((p, i) => `  - id: ${p}-model-${i + 1}
    provider: ${p}
    use_case: "describe the use case here"
    risk_tier: limited  # prohibited | high | limited | minimal
    human_oversight: true
    data_categories:
      - user_messages`).join('\n\n');
    const agentEntries = providers.map((p, i) => `  - id: ${p}-agent-${i + 1}
    model: ${p}-model-${i + 1}
    tools: []
    outputs_affect_humans: false`).join('\n\n');
    return `project:
  name: ${projectName}
  version: "1.0.0"
  owner: "your-team@example.com"

models:
${modelEntries || `  - id: example-model
    provider: openai
    use_case: "describe the use case"
    risk_tier: limited
    human_oversight: true
    data_categories:
      - user_messages`}

agents:
${agentEntries || `  - id: example-agent
    model: example-model
    tools: []
    outputs_affect_humans: false`}
`;
};
export function runInit(outputPath) {
    const target = resolve(outputPath ?? 'comply.yaml');
    if (existsSync(target)) {
        console.error(`File already exists: ${target}`);
        console.error('Delete it first or specify a different path.');
        process.exit(1);
    }
    // Auto-detect providers in current directory
    const cwd = process.cwd();
    const detected = scanDirectory(cwd);
    const providers = [...new Set(detected.map(r => r.provider))];
    const projectName = cwd.split('/').pop() ?? 'my-ai-project';
    writeFileSync(target, COMPLY_TEMPLATE(projectName, providers));
    console.log(`\n✔ Created: ${target}`);
    if (providers.length > 0) {
        console.log(`\nAuto-detected providers: ${providers.join(', ')}`);
        console.log('Model stubs have been added — fill in use_case and risk_tier for each.');
    }
    else {
        console.log('\nNo AI providers detected in current directory — template scaffold created.');
    }
    console.log('\nNext:');
    console.log('  1. Edit comply.yaml — fill in use_case and risk_tier for each model');
    console.log('  2. agent-comply classify .   — auto-detect AI usage from your codebase');
    console.log('  3. agent-comply check <policy>  — validate against EU AI Act policy');
    console.log('');
    console.log('EU AI Act policies: https://github.com/StanislavBG/agent-comply/tree/main/policies');
    console.log('');
    console.log('Running deploy gates? agent-gate integrates agent-comply automatically:');
    console.log('  npx agent-gate init');
}
//# sourceMappingURL=init.js.map