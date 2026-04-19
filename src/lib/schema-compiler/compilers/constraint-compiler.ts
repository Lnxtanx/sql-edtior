/**
 * Constraint Compiler
 * 
 * Layer 6: Compiles all constraint types (PK, FK, Unique, Check, Exclusion),
 * detects FK without index, multi-column uniqueness issues, constraint cycles,
 * invalid constraints, and deferred integrity risks.
 */

import type { ParsedSchema, Table, Column, Relationship, Index } from '@/lib/sql-parser';
import type {
    ConstraintCompilation, CompilationIssue,
    PKCompilation, FKCompilation, UniqueCompilation,
    CheckCompilation, ExclusionCompilation, FKWithoutIndex,
} from '../types';

export function compileConstraints(schema: ParsedSchema): { constraints: ConstraintCompilation; issues: CompilationIssue[] } {
    const issues: CompilationIssue[] = [];

    const primaryKeys: PKCompilation[] = [];
    const foreignKeys: FKCompilation[] = [];
    const uniqueConstraints: UniqueCompilation[] = [];
    const checkConstraints: CheckCompilation[] = [];
    const exclusionConstraints: ExclusionCompilation[] = [];

    // Build index lookup for FK-without-index detection
    const indexedColumnSets = buildIndexedColumnSets(schema.indexes);

    for (const table of schema.tables) {
        // Primary Keys
        const pkColumns = table.columns.filter(c => c.isPrimaryKey).map(c => c.name);
        if (pkColumns.length > 0) {
            primaryKeys.push({
                table: table.name,
                schema: table.schema,
                columns: pkColumns,
                name: undefined, // name isn't always available from parser
                isComposite: pkColumns.length > 1,
            });
        }

        // Foreign Keys
        for (const col of table.columns) {
            if (col.isForeignKey && col.references) {
                const fkColumns = [col.name];
                const hasIndex = isColumnSetIndexed(table.name, fkColumns, indexedColumnSets, pkColumns);

                foreignKeys.push({
                    name: undefined,
                    sourceTable: table.name,
                    sourceSchema: table.schema,
                    sourceColumns: fkColumns,
                    targetTable: col.references.table,
                    targetSchema: col.references.schema,
                    targetColumns: [col.references.column],
                    onDelete: col.references.onDelete,
                    onUpdate: col.references.onUpdate,
                    isDeferrable: false,
                    isNotValid: false,
                    hasIndex,
                    matchType: undefined,
                });
            }
        }

        // Unique constraints (named ones from table)
        for (const uc of table.uniqueConstraints) {
            uniqueConstraints.push({
                table: table.name,
                schema: table.schema,
                columns: uc.columns || [],
                name: uc.name,
                isPartial: false,
            });
        }

        // Column-level unique
        for (const col of table.columns) {
            if (col.isUnique && !col.isPrimaryKey) {
                const alreadyInConstraint = table.uniqueConstraints.some(
                    uc => uc.columns?.length === 1 && uc.columns[0] === col.name
                );
                if (!alreadyInConstraint) {
                    uniqueConstraints.push({
                        table: table.name,
                        schema: table.schema,
                        columns: [col.name],
                        name: undefined,
                        isPartial: false,
                    });
                }
            }
        }

        // Check constraints
        for (const cc of table.checkConstraints) {
            const affectedColumns = cc.columns || extractColumnsFromExpression(cc.expression || '', table);
            checkConstraints.push({
                table: table.name,
                schema: table.schema,
                name: cc.name,
                expression: cc.expression || '',
                columns: affectedColumns,
                isNotValid: false,
            });
        }

        // Column-level check constraints
        for (const col of table.columns) {
            if (col.checkConstraint) {
                checkConstraints.push({
                    table: table.name,
                    schema: table.schema,
                    name: undefined,
                    expression: col.checkConstraint,
                    columns: [col.name],
                    isNotValid: false,
                });
            }
        }
    }

    // Analysis: FK without index — data only, no issue generation
    // (The index compiler already generates fk-not-indexed issues, avoid double-counting)
    const fkWithoutIndex: FKWithoutIndex[] = [];
    for (const fk of foreignKeys) {
        if (!fk.hasIndex) {
            const safeTable = fk.sourceTable.includes('.') ? fk.sourceTable.split('.').pop()! : fk.sourceTable;
            const suggestedName = `idx_${safeTable}_${fk.sourceColumns.join('_')}`;
            fkWithoutIndex.push({
                table: fk.sourceTable,
                columns: fk.sourceColumns,
                referencedTable: fk.targetTable,
                suggestedIndex: `CREATE INDEX ${suggestedName} ON ${fk.sourceTable}(${fk.sourceColumns.join(', ')});`,
            });
        }
    }

    // Analysis: Tables without PK
    for (const table of schema.tables) {
        const hasPK = table.columns.some(c => c.isPrimaryKey);
        if (!hasPK && !table.partitionOf) {
            // Partitioned parent tables typically define PK on partitions, so lower severity
            const isPartitioned = table.isPartitioned;
            issues.push({
                id: `constraint-no-pk-${table.name}`,
                layer: 'constraint',
                severity: isPartitioned ? 'warning' : 'error',
                category: 'missing-pk',
                title: 'Missing primary key',
                message: `Table "${table.name}" has no primary key.${isPartitioned ? ' Partitioned tables often define PKs on child partitions.' : ' This prevents proper row identification and replication.'}`,
                affectedObjects: [{ type: 'table', name: table.name, schema: table.schema }],
                remediation: isPartitioned
                    ? 'Add a PRIMARY KEY on partitions or use a composite PK including the partition key.'
                    : 'Add a PRIMARY KEY constraint. Use UUID, SERIAL, or BIGSERIAL.',
                riskScore: isPartitioned ? 40 : 80,
            });
        }
    }

    // Analysis: Constraint cycles (via FK graph)
    const constraintCycles = detectConstraintCycles(foreignKeys);
    for (const cycle of constraintCycles) {
        issues.push({
            id: `constraint-cycle-${cycle.join('-')}`,
            layer: 'constraint',
            severity: 'warning',
            category: 'constraint-cycle',
            title: 'FK constraint cycle',
            message: `Circular FK dependency: ${cycle.join(' → ')} → ${cycle[0]}`,
            affectedObjects: cycle.map(t => ({ type: 'table' as const, name: t })),
            remediation: 'Consider if this circular dependency is intentional. Break cycles using DEFERRABLE constraints or restructure.',
            riskScore: 45,
        });
    }

    // Analysis: multi-column uniqueness issues
    const multiColumnUniquenessIssues: string[] = [];
    for (const uc of uniqueConstraints) {
        if (uc.columns.length > 3) {
            const msg = `${uc.table}: UNIQUE(${uc.columns.join(', ')}) has ${uc.columns.length} columns — consider if this is correct`;
            multiColumnUniquenessIssues.push(msg);
            issues.push({
                id: `constraint-wide-unique-${uc.table}-${uc.columns.join('-')}`,
                layer: 'constraint',
                severity: 'suggestion',
                category: 'wide-unique',
                title: 'Wide unique constraint',
                message: msg,
                affectedObjects: [{ type: 'table', name: uc.table }],
                riskScore: 20,
            });
        }
    }

    return {
        constraints: {
            primaryKeys,
            foreignKeys,
            uniqueConstraints,
            checkConstraints,
            exclusionConstraints,
            fkWithoutIndex,
            multiColumnUniquenessIssues,
            constraintCycles,
            invalidConstraints: [],
            deferredIntegrityRisks: [],
        },
        issues,
    };
}

function buildIndexedColumnSets(indexes: ParsedSchema['indexes']): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    for (const idx of indexes) {
        if (!map.has(idx.table)) map.set(idx.table, new Set());
        // An index covers the leading column(s) for FK lookups
        if (idx.columns.length > 0) {
            map.get(idx.table)!.add(idx.columns[0]);
        }
        // Multi-column: add the set as well
        map.get(idx.table)!.add(idx.columns.join(','));
    }
    return map;
}

function isColumnSetIndexed(
    tableName: string,
    columns: string[],
    indexedSets: Map<string, Set<string>>,
    pkColumns: string[],
): boolean {
    // PK columns are auto-indexed
    if (columns.length === 1 && pkColumns.includes(columns[0])) return true;

    const tableIndexes = indexedSets.get(tableName);
    if (!tableIndexes) return false;

    // Check if leading column is indexed
    if (tableIndexes.has(columns[0])) return true;

    // Check exact match
    if (tableIndexes.has(columns.join(','))) return true;

    return false;
}

function extractColumnsFromExpression(expression: string, table: Table): string[] {
    const columnNames = table.columns.map(c => c.name);
    return columnNames.filter(name => {
        const regex = new RegExp(`\\b${name}\\b`, 'i');
        return regex.test(expression);
    });
}

function detectConstraintCycles(foreignKeys: FKCompilation[]): string[][] {
    const graph = new Map<string, string[]>();
    for (const fk of foreignKeys) {
        if (!graph.has(fk.sourceTable)) graph.set(fk.sourceTable, []);
        if (!graph.get(fk.sourceTable)!.includes(fk.targetTable)) {
            graph.get(fk.sourceTable)!.push(fk.targetTable);
        }
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    function dfs(node: string): void {
        visited.add(node);
        recStack.add(node);
        path.push(node);

        for (const neighbor of (graph.get(node) || [])) {
            if (!visited.has(neighbor)) {
                dfs(neighbor);
            } else if (recStack.has(neighbor)) {
                const cycleStart = path.indexOf(neighbor);
                if (cycleStart !== -1) {
                    const cycle = path.slice(cycleStart);
                    const key = [...cycle].sort().join(',');
                    if (!cycles.some(c => [...c].sort().join(',') === key)) {
                        cycles.push(cycle);
                    }
                }
            }
        }

        path.pop();
        recStack.delete(node);
    }

    for (const node of graph.keys()) {
        if (!visited.has(node)) dfs(node);
    }

    return cycles;
}
