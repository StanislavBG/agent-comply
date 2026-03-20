export type RiskTier = 'unacceptable' | 'high' | 'limited' | 'minimal' | 'unknown';
export interface ModelFinding {
    provider: string;
    model?: string;
    file: string;
    line: number;
    evidence: string;
    tier: RiskTier;
}
export interface ClassificationResult {
    tier: RiskTier;
    findings: ModelFinding[];
    providers: string[];
    warnings: string[];
}
export declare function classifyProject(projectDir: string): ClassificationResult;
//# sourceMappingURL=classifier.d.ts.map