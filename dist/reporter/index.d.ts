import type { ComplyConfig, CheckViolation, ComplianceReport } from '../types/index.js';
export declare function formatSarif(report: ComplianceReport): string;
export declare function formatJunit(report: ComplianceReport): string;
export declare function buildReport(config: ComplyConfig, violations: CheckViolation[]): ComplianceReport;
export declare function formatReport(report: ComplianceReport): string;
//# sourceMappingURL=index.d.ts.map