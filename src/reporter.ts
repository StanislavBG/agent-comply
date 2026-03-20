import { ClassificationResult, RiskTier } from './classifier.js';
import { ScanResult } from './scanner.js';

const TIER_LABELS: Record<RiskTier, string> = {
  unacceptable: 'UNACCEPTABLE (PROHIBITED)',
  high: 'HIGH RISK',
  limited: 'LIMITED RISK',
  minimal: 'MINIMAL RISK',
  unknown: 'UNKNOWN / NO AI DETECTED',
};

const TIER_ACTIONS: Record<RiskTier, string[]> = {
  unacceptable: [
    'IMMEDIATE ACTION REQUIRED: This system may be prohibited under EU AI Act Article 5',
    'Consult legal counsel before deployment',
    'Remove or fundamentally redesign prohibited AI features',
    'File for exemption if applicable (law enforcement exceptions, research)',
  ],
  high: [
    'Implement a risk management system (Article 9)',
    'Create and maintain technical documentation (Article 11)',
    'Ensure data governance practices (Article 10)',
    'Implement human oversight mechanisms (Article 14)',
    'Conduct conformity assessment before deployment',
    'Register in EU database for high-risk AI systems',
    'Assign a qualified person responsible for compliance',
  ],
  limited: [
    'Disclose to users that they are interacting with an AI system',
    'Label AI-generated content clearly',
    'Ensure chatbots identify themselves as AI',
    'Apply transparency measures for emotion recognition systems',
  ],
  minimal: [
    'No mandatory EU AI Act obligations for minimal risk systems',
    'Consider voluntary codes of conduct',
    'Document AI use for internal governance',
  ],
  unknown: [
    'No AI usage detected in scanned files',
    'Run a manual review to confirm',
  ],
};

export function generateReport(scan: ScanResult, classification: ClassificationResult): string {
  const lines: string[] = [];
  const sep = '─'.repeat(60);

  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════╗');
  lines.push('║           EU AI ACT COMPLIANCE REPORT                    ║');
  lines.push('║                    agent-comply v0.1                     ║');
  lines.push('╚══════════════════════════════════════════════════════════╝');
  lines.push('');

  // Overall verdict
  const tierLabel = TIER_LABELS[classification.tier];
  lines.push(`OVERALL RISK TIER: ${tierLabel}`);
  lines.push(sep);

  // Summary stats
  lines.push('SCAN SUMMARY');
  lines.push(`  Project:        ${scan.projectDir}`);
  lines.push(`  Files scanned:  ${scan.summary.totalFiles}`);
  lines.push(`  Files with AI:  ${scan.summary.filesWithAI}`);
  lines.push(`  AI providers:   ${scan.summary.providersDetected.length > 0 ? scan.summary.providersDetected.join(', ') : 'none'}`);
  lines.push('');

  // Findings
  if (classification.findings.length > 0) {
    lines.push(sep);
    lines.push('AI USAGE DETECTED');
    lines.push('');

    // Group by provider
    const byProvider = new Map<string, typeof classification.findings>();
    for (const finding of classification.findings) {
      const list = byProvider.get(finding.provider) ?? [];
      list.push(finding);
      byProvider.set(finding.provider, list);
    }

    for (const [provider, findings] of byProvider.entries()) {
      lines.push(`  ${provider.toUpperCase()} (${findings.length} reference${findings.length > 1 ? 's' : ''})`);
      const unique = findings.slice(0, 3); // Show top 3
      for (const f of unique) {
        lines.push(`    ${f.file}:${f.line}  [${TIER_LABELS[f.tier]}]`);
        lines.push(`      ${f.evidence.substring(0, 70)}`);
      }
      if (findings.length > 3) {
        lines.push(`    ... and ${findings.length - 3} more`);
      }
      lines.push('');
    }
  }

  // Model references from scan
  if (scan.modelReferences.length > 0) {
    lines.push(sep);
    lines.push('MODEL REFERENCES');
    const uniqueModels = [...new Set(scan.modelReferences.map(m => `${m.model} (${m.provider})`))];
    for (const m of uniqueModels) {
      lines.push(`  • ${m}`);
    }
    lines.push('');
  }

  // Prompt templates
  if (scan.promptTemplates.length > 0) {
    lines.push(sep);
    lines.push('PROMPT TEMPLATES DETECTED');
    lines.push(`  ${scan.promptTemplates.length} prompt template(s) found`);
    for (const pt of scan.promptTemplates.slice(0, 5)) {
      lines.push(`  ${pt.file}:${pt.line}`);
    }
    lines.push('');
  }

  // API key declarations
  if (scan.envKeys.length > 0) {
    lines.push(sep);
    lines.push('API KEY CONFIGURATIONS');
    for (const ek of scan.envKeys) {
      lines.push(`  ${ek.file}: ${ek.key} (${ek.provider})`);
    }
    lines.push('');
  }

  // Warnings
  if (classification.warnings.length > 0) {
    lines.push(sep);
    lines.push('COMPLIANCE WARNINGS');
    for (const w of classification.warnings) {
      lines.push(`  ⚠  ${w}`);
    }
    lines.push('');
  }

  // Required actions
  lines.push(sep);
  lines.push('REQUIRED ACTIONS');
  const actions = TIER_ACTIONS[classification.tier];
  for (const action of actions) {
    lines.push(`  → ${action}`);
  }
  lines.push('');

  // Missing docs check
  const missingDocs: string[] = [];
  if (classification.tier === 'high' || classification.tier === 'unacceptable') {
    missingDocs.push('Technical documentation (Article 11 + Annex IV)');
    missingDocs.push('Risk management system documentation (Article 9)');
    missingDocs.push('Human oversight mechanisms documentation (Article 14)');
    missingDocs.push('Model card / AI system card');
    missingDocs.push('Data governance documentation (Article 10)');
  } else if (classification.tier === 'limited') {
    missingDocs.push('User-facing transparency notice');
    missingDocs.push('AI disclosure documentation');
  }

  if (missingDocs.length > 0) {
    lines.push(sep);
    lines.push('MISSING DOCUMENTATION');
    for (const doc of missingDocs) {
      lines.push(`  ✗ ${doc}`);
    }
    lines.push('');
  }

  lines.push(sep);
  lines.push(`Report generated: ${new Date().toISOString()}`);
  lines.push('Reference: EU AI Act (Regulation 2024/1689)');
  lines.push('');

  return lines.join('\n');
}

export function generateJsonReport(scan: ScanResult, classification: ClassificationResult): object {
  return {
    generatedAt: new Date().toISOString(),
    regulation: 'EU AI Act (Regulation 2024/1689)',
    projectDir: scan.projectDir,
    overallTier: classification.tier,
    overallTierLabel: TIER_LABELS[classification.tier],
    summary: scan.summary,
    findings: classification.findings,
    warnings: classification.warnings,
    requiredActions: TIER_ACTIONS[classification.tier],
    modelReferences: scan.modelReferences,
    promptTemplates: scan.promptTemplates,
    envKeys: scan.envKeys.map(k => ({ ...k, key: k.key })),
  };
}
