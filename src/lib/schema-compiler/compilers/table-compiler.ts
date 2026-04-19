/**
 * Table Compiler
 * 
 * Layer 3: Compiles table-level structural information including type classification,
 * relationship degree, cascade risk, and complexity estimation.
 */

import type { ParsedSchema, Table, Relationship } from '@/lib/sql-parser';
import type { TableCompilation, CompilationIssue } from '../types';

export function compileTables(schema: ParsedSchema): { tables: TableCompilation[]; issues: CompilationIssue[] } {
    const issues: CompilationIssue[] = [];
    const tables: TableCompilation[] = [];

    // Pre-compute relationship maps
    const inboundFKMap = new Map<string, Relationship[]>();
    const outboundFKMap = new Map<string, Relationship[]>();
    const triggerCountMap = new Map<string, number>();
    const indexCountMap = new Map<string, number>();
    const policyMap = new Map<string, boolean>();

    for (const rel of schema.relationships) {
        if (rel.type === 'FOREIGN_KEY') {
            const outKey = rel.source.table;
            const inKey = rel.target.table;
            if (!outboundFKMap.has(outKey)) outboundFKMap.set(outKey, []);
            if (!inboundFKMap.has(inKey)) inboundFKMap.set(inKey, []);
            outboundFKMap.get(outKey)!.push(rel);
            inboundFKMap.get(inKey)!.push(rel);
        }
    }

    for (const trigger of schema.triggers) {
        triggerCountMap.set(trigger.table, (triggerCountMap.get(trigger.table) || 0) + 1);
    }

    for (const index of schema.indexes) {
        indexCountMap.set(index.table, (indexCountMap.get(index.table) || 0) + 1);
    }

    for (const policy of schema.policies) {
        policyMap.set(policy.table, true);
    }

    for (const table of schema.tables) {
        const inboundFK = inboundFKMap.get(table.name) || [];
        const outboundFK = outboundFKMap.get(table.name) || [];
        const triggerCount = triggerCountMap.get(table.name) || 0;
        const idxCount = indexCountMap.get(table.name) || 0;
        const hasRlsPolicies = policyMap.has(table.name);
        const dependencyDegree = inboundFK.length + outboundFK.length;

        // Classify table type
        const tableType = classifyTableType(table);

        // Cascade risk analysis
        const cascadeRiskLevel = computeCascadeRisk(table, inboundFK, outboundFK);

        // Complexity estimation
        const estimatedComplexity = estimateComplexity(table, dependencyDegree, triggerCount, idxCount);

        // Count constraints
        const constraintCount = countConstraints(table);

        tables.push({
            name: table.name,
            schema: table.schema || 'public',
            tableType,
            owner: undefined,
            tablespace: undefined,
            storageParameters: undefined,
            replicaIdentity: undefined,
            rlsEnabled: hasRlsPolicies, // infer from presence of policies (ALTER TABLE ... ENABLE RLS not tracked by parser)
            hasRlsPolicies,
            columnCount: table.columns.length,
            constraintCount,
            inboundFKCount: inboundFK.length,
            outboundFKCount: outboundFK.length,
            dependencyDegree,
            cascadeRiskLevel,
            indexCount: idxCount,
            triggerCount,
            estimatedComplexity,
            source: table,
        });

        // Issues
        // Skip empty-table warning for partition children (they inherit columns from parent)
        if (table.columns.length === 0 && !table.partitionOf) {
            issues.push({
                id: `table-empty-${table.name}`,
                layer: 'table',
                severity: 'warning',
                category: 'empty-table',
                title: 'Empty table definition',
                message: `Table "${table.name}" has no columns defined.`,
                affectedObjects: [{ type: 'table', name: table.name, schema: table.schema }],
                riskScore: 30,
            });
        }

        if (dependencyDegree > 10) {
            issues.push({
                id: `table-high-coupling-${table.name}`,
                layer: 'table',
                severity: 'warning',
                category: 'high-coupling',
                title: 'High coupling table',
                message: `Table "${table.name}" has ${dependencyDegree} FK relationships (${inboundFK.length} inbound, ${outboundFK.length} outbound). High coupling increases change risk.`,
                affectedObjects: [{ type: 'table', name: table.name, schema: table.schema }],
                remediation: 'Consider if some relationships can be simplified or if the table should be decomposed.',
                riskScore: 50,
            });
        }

        if (table.isUnlogged) {
            issues.push({
                id: `table-unlogged-${table.name}`,
                layer: 'table',
                severity: 'info',
                category: 'unlogged-table',
                title: 'Unlogged table',
                message: `Table "${table.name}" is unlogged. Data will be lost on crash.`,
                affectedObjects: [{ type: 'table', name: table.name, schema: table.schema }],
                remediation: 'Unlogged tables are faster but not crash-safe. Ensure this is intentional for non-critical/temporary data.',
                riskScore: 40,
            });
        }

        if (table.isTemporary) {
            issues.push({
                id: `table-temporary-${table.name}`,
                layer: 'table',
                severity: 'info',
                category: 'temporary-table',
                title: 'Temporary table',
                message: `Table "${table.name}" is temporary and exists only for the session.`,
                affectedObjects: [{ type: 'table', name: table.name, schema: table.schema }],
                riskScore: 10,
            });
        }

        if (cascadeRiskLevel === 'HIGH') {
            issues.push({
                id: `table-cascade-risk-${table.name}`,
                layer: 'table',
                severity: 'warning',
                category: 'cascade-risk',
                title: 'High cascade risk',
                message: `Table "${table.name}" has high cascade risk: ${inboundFK.length} tables depend on it with CASCADE delete rules.`,
                affectedObjects: [
                    { type: 'table', name: table.name, schema: table.schema },
                    ...inboundFK
                        .filter(r => r.onDelete === 'CASCADE')
                        .map(r => ({ type: 'table' as const, name: r.source.table, detail: 'CASCADE dependent' })),
                ],
                remediation: 'Review CASCADE delete rules. Consider using RESTRICT or SET NULL where appropriate.',
                riskScore: 70,
            });
        }
    }

    // Check for orphan tables (no relationships at all)
    // Exclude partition children — they inherit relationships from parent
    const partitionChildNames = new Set(schema.tables.filter(t => t.partitionOf).map(t => t.name));
    const orphanTables = tables.filter(t => t.dependencyDegree === 0 && schema.tables.length > 1 && !partitionChildNames.has(t.name));
    if (orphanTables.length > 0) {
        for (const orphan of orphanTables) {
            issues.push({
                id: `table-orphan-${orphan.name}`,
                layer: 'table',
                severity: 'suggestion',
                category: 'orphan-table',
                title: 'Isolated table',
                message: `Table "${orphan.name}" has no foreign key relationships with other tables.`,
                affectedObjects: [{ type: 'table', name: orphan.name, schema: orphan.schema }],
                remediation: 'If this table should relate to others, add foreign key constraints. If it\'s a lookup/config table, this may be intentional.',
                riskScore: 15,
            });
        }
    }

    return { tables, issues };
}

function classifyTableType(table: Table): TableCompilation['tableType'] {
    if (table.isTemporary) return 'temporary';
    if (table.isUnlogged) return 'unlogged';
    if (table.isPartitioned) return 'partitioned';
    if (table.partitionOf) return 'base'; // child partitions are base tables
    if (table.inheritsFrom) return 'inherited';
    return 'base';
}

function computeCascadeRisk(
    table: Table,
    inboundFK: Relationship[],
    outboundFK: Relationship[],
): TableCompilation['cascadeRiskLevel'] {
    const cascadeInbound = inboundFK.filter(r => r.onDelete === 'CASCADE').length;
    const totalInbound = inboundFK.length;

    if (cascadeInbound >= 3) return 'HIGH';
    if (cascadeInbound >= 1 && totalInbound >= 3) return 'MEDIUM';
    if (cascadeInbound >= 1) return 'LOW';
    return 'NONE';
}

function estimateComplexity(
    table: Table,
    dependencyDegree: number,
    triggerCount: number,
    indexCount: number,
): TableCompilation['estimatedComplexity'] {
    let score = 0;

    // Column count factor
    if (table.columns.length > 30) score += 3;
    else if (table.columns.length > 15) score += 2;
    else if (table.columns.length > 8) score += 1;

    // Relationship factor
    if (dependencyDegree > 8) score += 3;
    else if (dependencyDegree > 4) score += 2;
    else if (dependencyDegree > 1) score += 1;

    // Trigger factor
    if (triggerCount > 3) score += 2;
    else if (triggerCount > 0) score += 1;

    // Index factor
    if (indexCount > 5) score += 1;

    // Partition factor
    if (table.isPartitioned) score += 2;

    // Constraint factor
    if (table.checkConstraints.length > 3) score += 1;
    if (table.uniqueConstraints.length > 3) score += 1;

    if (score >= 8) return 'enterprise';
    if (score >= 5) return 'complex';
    if (score >= 2) return 'moderate';
    return 'simple';
}

function countConstraints(table: Table): number {
    let count = 0;
    count += table.columns.filter(c => c.isPrimaryKey).length > 0 ? 1 : 0; // PK
    count += table.columns.filter(c => c.isForeignKey).length; // FKs
    count += table.columns.filter(c => c.isUnique).length; // uniques per column
    count += table.uniqueConstraints.length; // named unique constraints
    count += table.checkConstraints.length;
    count += table.columns.filter(c => !c.nullable).length; // NOT NULL as constraints
    return count;
}
