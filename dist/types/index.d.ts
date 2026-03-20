export type RiskTier = 'prohibited' | 'high' | 'limited' | 'minimal';
export interface ModelConfig {
    id: string;
    provider: string;
    use_case: string;
    risk_tier: RiskTier;
    human_oversight: boolean;
    data_categories: string[];
}
export interface AgentConfig {
    id: string;
    model: string;
    tools: string[];
    outputs_affect_humans: boolean;
}
export interface ComplyConfig {
    project: {
        name: string;
        version: string;
        owner: string;
    };
    models: ModelConfig[];
    agents: AgentConfig[];
}
export interface ScanResult {
    file: string;
    line: number;
    provider: string;
    pattern: string;
}
export interface PolicyRule {
    id: string;
    description: string;
    condition: PolicyCondition;
    severity: 'error' | 'warning';
}
export interface PolicyCondition {
    field: string;
    operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'required';
    value?: unknown;
}
export interface PolicyConfig {
    name: string;
    version: string;
    rules: PolicyRule[];
}
export interface CheckViolation {
    rule_id: string;
    severity: 'error' | 'warning';
    description: string;
    context: string;
}
export interface ComplianceReport {
    generated_at: string;
    project: ComplyConfig['project'];
    summary: {
        total_models: number;
        total_agents: number;
        risk_tiers: Record<RiskTier, number>;
        human_oversight_required: number;
        affects_humans: number;
    };
    models: ModelConfig[];
    agents: AgentConfig[];
    violations: CheckViolation[];
}
//# sourceMappingURL=index.d.ts.map