export interface ScanResult {
    projectDir: string;
    aiImports: Array<{
        file: string;
        line: number;
        import: string;
        provider: string;
    }>;
    envKeys: Array<{
        file: string;
        key: string;
        provider: string;
    }>;
    promptTemplates: Array<{
        file: string;
        line: number;
        snippet: string;
    }>;
    modelReferences: Array<{
        file: string;
        line: number;
        model: string;
        provider: string;
    }>;
    configFiles: string[];
    summary: {
        totalFiles: number;
        filesWithAI: number;
        providersDetected: string[];
    };
}
export declare function scanProject(projectDir: string): ScanResult;
//# sourceMappingURL=scanner.d.ts.map