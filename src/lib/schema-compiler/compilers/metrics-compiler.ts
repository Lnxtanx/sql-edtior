/**
 * Metrics Compiler
 * 
 * Layer 20: Enterprise metrics computation — graph diameter, coupling score,
 * constraint/index density, security exposure, naming quality, and overall readiness score.
 */

import type { ParsedSchema } from '@/lib/sql-parser';
import type {
    CompilationMetrics, CompilationIssue, MetricValue, LetterGrade,
} from '../types';

export function compileMetrics(
    schema: ParsedSchema,
    issuesSoFar: CompilationIssue[],
): { metrics: CompilationMetrics; issues: CompilationIssue[] } {
    const issues: CompilationIssue[] = [];

    const tableCount = schema.tables.length;
    const viewCount = schema.views.length;
    const funcCount = schema.functions.length;
    const triggerCount = schema.triggers.length;
    const indexCount = schema.indexes.length;
    const fkCount = schema.relationships.length;
    const seqCount = schema.sequences.length;
    const policyCount = schema.policies.length;
    const extCount = schema.extensions.length;
    const colCount = schema.tables.reduce((sum, t) => sum + t.columns.length, 0);

    // --- Density Metrics ---

    // Constraint density: FK + check + unique constraints per table
    const totalChecks = schema.tables.reduce((sum, t) => sum + (t.checkConstraints?.length || 0), 0);
    const totalUniques = schema.tables.reduce((sum, t) => sum + (t.uniqueConstraints?.length || 0), 0);
    const constraintDensity = tableCount > 0
        ? Number(((fkCount + totalChecks + totalUniques) / tableCount).toFixed(2))
        : 0;

    // Index density: indexes per table
    const indexDensity = tableCount > 0
        ? Number((indexCount / tableCount).toFixed(2))
        : 0;

    // Column density: average columns per table
    const columnDensity = tableCount > 0
        ? Number((colCount / tableCount).toFixed(2))
        : 0;

    // --- Coupling Score ---
    // Based on FK relationships relative to table count
    const maxPossibleEdges = tableCount * (tableCount - 1);
    const couplingScore = maxPossibleEdges > 0
        ? Math.min(100, Math.round((fkCount / maxPossibleEdges) * 100 * 10))
        : 0;

    // --- Normalization Estimation ---
    // Roughly estimate normalization quality
    const wideTableCount = schema.tables.filter(t => t.columns.length > 20).length;
    const tablesWithPK = schema.tables.filter(t => t.columns.some(c => c.isPrimaryKey)).length;
    const pkCoverage = tableCount > 0 ? tablesWithPK / tableCount : 0;
    const normalizationScore = Math.round(
        (pkCoverage * 40) +
        ((1 - Math.min(1, wideTableCount / Math.max(1, tableCount))) * 30) +
        (Math.min(1, constraintDensity / 3) * 30)
    );

    // --- Security Score ---
    // Detect SECURITY DEFINER from function body text (parser doesn't expose a dedicated field)
    const secDefFunctions = schema.functions.filter(f =>
        (f as any).securityDefiner ||
        (f.body && /security\s+definer/i.test(f.body))
    ).length;
    const hasRLS = policyCount > 0;
    const multipleSchemas = schema.schemas.length > 1;
    const securityScore = Math.max(0, Math.min(100,
        (hasRLS ? 25 : 0) +
        (multipleSchemas ? 15 : 0) +
        // Penalize fewer for having sec-def; having some is fine if controlled
        (secDefFunctions === 0 ? 15 : Math.max(0, 15 - secDefFunctions * 3)) +
        (policyCount >= tableCount * 0.3 ? 20 : Math.round((policyCount / Math.max(1, tableCount)) * 20)) +
        (extCount > 0 ? 10 : 0) +
        // Bonus for having explicit schemas (namespace isolation)
        (schema.schemas.length >= 3 ? 15 : schema.schemas.length >= 2 ? 10 : 0)
    ));

    // --- Naming Quality Score ---
    // Strip schema prefix before checking convention (parser stores "auth.users" not "users")
    const stripSchema = (name: string) => name.includes('.') ? name.split('.').pop()! : name;
    const snakeCaseNames = schema.tables.filter(t => /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(stripSchema(t.name))).length;
    const namingScore = tableCount > 0
        ? Math.round((snakeCaseNames / tableCount) * 100)
        : 100;

    // --- Documentation Score ---
    const tablesWithComments = schema.tables.filter(t => t.comment).length;
    const colsWithComments = schema.tables.reduce((sum, t) =>
        sum + t.columns.filter(c => c.comment).length, 0);
    const documentationScore = tableCount > 0
        ? Math.round(
            ((tablesWithComments / tableCount) * 50) +
            ((colCount > 0 ? colsWithComments / colCount : 0) * 50)
        )
        : 0;

    // --- Issue Distribution ---
    const issueBySeverity = {
        error: issuesSoFar.filter(i => i.severity === 'error').length,
        warning: issuesSoFar.filter(i => i.severity === 'warning').length,
        info: issuesSoFar.filter(i => i.severity === 'info').length,
    };

    const issueByLayer = new Map<string, number>();
    for (const issue of issuesSoFar) {
        issueByLayer.set(issue.layer, (issueByLayer.get(issue.layer) || 0) + 1);
    }

    // --- Overall Readiness Score ---
    // Weighted combination of all quality scores
    // Penalties are proportional to schema size — a few issues in a large schema is acceptable
    const criticalErrorCount = issuesSoFar.filter(i => i.severity === 'critical').length;
    const schemaScale = Math.max(1, Math.log2(tableCount + 1)); // dampens penalties for larger schemas
    const errorPenalty = Math.min(20, (criticalErrorCount * 8 + issueBySeverity.error * 2) / schemaScale);
    const warningPenalty = Math.min(15, (issueBySeverity.warning * 0.3) / schemaScale);

    const rawReadiness =
        (normalizationScore * 0.20) +
        (securityScore * 0.20) +
        (namingScore * 0.10) +
        (documentationScore * 0.05) +
        (pkCoverage * 100 * 0.15) +
        (Math.min(100, indexDensity * 30) * 0.10) +
        (Math.min(100, constraintDensity * 25) * 0.10) +
        // Bonus for schema organization
        (schema.schemas.length > 1 ? 5 : 0) +
        // Bonus for having views (abstraction layer)
        (viewCount > 0 ? 5 : 0) +
        // Bonus for having triggers (automation)
        (triggerCount > 0 ? 2 : 0);

    const readinessScore = Math.max(0, Math.min(100,
        Math.round(rawReadiness - errorPenalty - warningPenalty)
    ));

    const overallGrade = scoreToGrade(readinessScore);

    // Build metrics
    const metrics: CompilationMetrics = {
        objectCounts: {
            tables: tableCount,
            views: viewCount,
            functions: funcCount,
            triggers: triggerCount,
            indexes: indexCount,
            sequences: seqCount,
            policies: policyCount,
            extensions: extCount,
            columns: colCount,
            relationships: fkCount,
            enums: schema.enumTypes.length,
            domains: schema.domains.length,
            compositeTypes: schema.compositeTypes.length,
            schemas: schema.schemas.length,
        },
        densityMetrics: {
            constraintDensity: buildMetric('Constraint Density', constraintDensity, 'constraints/table', constraintDensity >= 2 ? 'good' : 'warning'),
            indexDensity: buildMetric('Index Density', indexDensity, 'indexes/table', indexDensity >= 1 && indexDensity <= 8 ? 'good' : 'warning'),
            columnDensity: buildMetric('Column Density', columnDensity, 'columns/table', columnDensity <= 20 ? 'good' : 'warning'),
            couplingScore: buildMetric('Coupling Score', couplingScore, '%', couplingScore <= 30 ? 'good' : 'warning'),
        },
        qualityScores: {
            normalization: buildMetric('Normalization', normalizationScore, '/100', scoreToStatus(normalizationScore)),
            security: buildMetric('Security', securityScore, '/100', scoreToStatus(securityScore)),
            naming: buildMetric('Naming Quality', namingScore, '/100', scoreToStatus(namingScore)),
            documentation: buildMetric('Documentation', documentationScore, '/100', scoreToStatus(documentationScore)),
        },
        issueDistribution: {
            bySeverity: issueBySeverity,
            byLayer: Object.fromEntries(issueByLayer),
            totalIssues: issuesSoFar.length,
        },
        readinessScore,
        overallGrade,
    };

    // Generate metric-based issues
    if (readinessScore < 40) {
        issues.push({
            id: 'metrics-low-readiness',
            layer: 'metrics',
            severity: 'warning',
            category: 'low-readiness',
            title: 'Low enterprise readiness score',
            message: `Overall readiness score is ${readinessScore}/100 (${overallGrade}). Major improvements needed in ${getWeakestArea(metrics)}.`,
            affectedObjects: [],
            riskScore: 50,
        });
    }

    if (documentationScore < 20 && tableCount > 5) {
        issues.push({
            id: 'metrics-low-documentation',
            layer: 'metrics',
            severity: 'info',
            category: 'low-documentation',
            title: 'Low documentation coverage',
            message: `Only ${tablesWithComments}/${tableCount} tables and ${colsWithComments}/${colCount} columns have comments. Documentation score: ${documentationScore}/100.`,
            affectedObjects: [],
            remediation: 'Add COMMENT ON statements to tables and columns for better documentation.',
            riskScore: 15,
        });
    }

    if (pkCoverage < 1.0 && tableCount > 0) {
        const missing = tableCount - tablesWithPK;
        issues.push({
            id: 'metrics-pk-coverage',
            layer: 'metrics',
            severity: missing > 0 ? 'warning' : 'info',
            category: 'pk-coverage',
            title: 'Primary key coverage',
            message: `${tablesWithPK}/${tableCount} tables have primary keys (${Math.round(pkCoverage * 100)}% coverage).`,
            affectedObjects: schema.tables.filter(t => !t.columns.some(c => c.isPrimaryKey)).map(t => ({ type: 'table' as const, name: t.name })),
            riskScore: missing > 3 ? 40 : 20,
        });
    }

    return { metrics, issues };
}

function buildMetric(name: string, value: number, unit: string, status: 'good' | 'warning' | 'critical'): MetricValue {
    return { name, value, unit, status };
}

function scoreToGrade(score: number): LetterGrade {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
}

function scoreToStatus(score: number): 'good' | 'warning' | 'critical' {
    if (score >= 70) return 'good';
    if (score >= 40) return 'warning';
    return 'critical';
}

function getWeakestArea(metrics: CompilationMetrics): string {
    const areas = [
        { name: 'normalization', score: metrics.qualityScores.normalization.value },
        { name: 'security', score: metrics.qualityScores.security.value },
        { name: 'naming', score: metrics.qualityScores.naming.value },
        { name: 'documentation', score: metrics.qualityScores.documentation.value },
    ];
    areas.sort((a, b) => a.score - b.score);
    return areas[0]?.name || 'unknown';
}
