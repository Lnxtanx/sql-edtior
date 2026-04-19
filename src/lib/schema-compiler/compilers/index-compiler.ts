/**
 * Index Compiler
 * 
 * Layer 7: Compiles full index structure with duplicate detection,
 * redundant index detection, missing index suggestions, and FK-not-indexed analysis.
 */

import type { ParsedSchema, Index } from '@/lib/sql-parser';
import type {
    IndexCompilation, CompilationIssue, IndexEntry,
    DuplicateIndex, RedundantIndex, MissingIndex, FKWithoutIndex,
} from '../types';

export function compileIndexes(schema: ParsedSchema): { indexes: IndexCompilation; issues: CompilationIssue[] } {
    const issues: CompilationIssue[] = [];

    // Build index entries
    const indexEntries: IndexEntry[] = schema.indexes.map(idx => ({
        name: idx.name,
        schema: idx.schema,
        table: idx.table,
        columns: idx.columns,
        type: idx.type,
        isUnique: idx.isUnique,
        isPartial: idx.isPartial,
        whereClause: idx.whereClause,
        includeColumns: idx.includeColumns || [],
        opclass: undefined,
        collation: undefined,
        tablespace: undefined,
        storageParams: undefined,
        isInvalid: false,
        isConcurrent: false,
        expressionDef: undefined,
        backsConstraint: false,
        constraintName: undefined,
    }));

    // Detect expression indexes
    const expressionIndexes = indexEntries
        .filter(idx => idx.columns.some(c => c.includes('(') || c.includes(')')))
        .map(idx => idx.name);

    // Detect partial indexes
    const partialIndexes = indexEntries
        .filter(idx => idx.isPartial)
        .map(idx => idx.name);

    // Detect duplicate indexes (same table, same columns, same order)
    const duplicateIndexes = detectDuplicateIndexes(indexEntries);
    for (const dup of duplicateIndexes) {
        issues.push({
            id: `index-duplicate-${dup.index1}-${dup.index2}`,
            layer: 'index',
            severity: 'warning',
            category: 'duplicate-index',
            title: 'Duplicate index',
            message: `Indexes "${dup.index1}" and "${dup.index2}" on "${dup.table}" cover the same columns (${dup.columns.join(', ')}). ${dup.recommendation}`,
            affectedObjects: [
                { type: 'index', name: dup.index1 },
                { type: 'index', name: dup.index2 },
            ],
            remediation: dup.recommendation,
            sqlFix: `DROP INDEX ${dup.index2}; -- Keep ${dup.index1}`,
            riskScore: 35,
        });
    }

    // Detect redundant indexes (subset of another)
    const redundantIndexes = detectRedundantIndexes(indexEntries);
    for (const red of redundantIndexes) {
        issues.push({
            id: `index-redundant-${red.redundantIndex}`,
            layer: 'index',
            severity: 'warning',
            category: 'redundant-index',
            title: 'Redundant index',
            message: `Index "${red.redundantIndex}" on "${red.table}" is redundant — superseded by "${red.supersededBy}". ${red.recommendation}`,
            affectedObjects: [
                { type: 'index', name: red.redundantIndex },
                { type: 'index', name: red.supersededBy },
            ],
            remediation: red.recommendation,
            sqlFix: `DROP INDEX ${red.redundantIndex}; -- Superseded by ${red.supersededBy}`,
            riskScore: 25,
        });
    }

    // Detect missing indexes for FK columns
    const fkNotIndexed = detectFKNotIndexed(schema);
    for (const missing of fkNotIndexed) {
        issues.push({
            id: `index-fk-missing-${missing.table}-${missing.columns.join('-')}`,
            layer: 'index',
            severity: 'suggestion',
            category: 'fk-not-indexed',
            title: 'FK column not indexed',
            message: `Foreign key ${missing.table}(${missing.columns.join(', ')}) → ${missing.referencedTable} has no index. This will cause slow JOINs and CASCADE deletes.`,
            affectedObjects: [{ type: 'table', name: missing.table }],
            remediation: 'Add an index on the FK columns.',
            sqlFix: missing.suggestedIndex,
            riskScore: 50,
        });
    }

    // Missing index suggestions based on patterns
    const missingIndexSuggestions = detectMissingIndexSuggestions(schema, indexEntries);
    for (const suggestion of missingIndexSuggestions) {
        issues.push({
            id: `index-suggestion-${suggestion.table}-${suggestion.columns.join('-')}`,
            layer: 'index',
            severity: 'suggestion',
            category: 'missing-index',
            title: 'Missing index suggestion',
            message: `${suggestion.reason}`,
            affectedObjects: [{ type: 'table', name: suggestion.table }],
            remediation: 'Consider adding the suggested index.',
            sqlFix: suggestion.suggestedDDL,
            riskScore: suggestion.priority === 'high' ? 40 : suggestion.priority === 'medium' ? 25 : 10,
        });
    }

    // High index count tables
    const indexCountByTable = new Map<string, number>();
    for (const idx of indexEntries) {
        indexCountByTable.set(idx.table, (indexCountByTable.get(idx.table) || 0) + 1);
    }

    for (const [table, count] of indexCountByTable) {
        if (count > 8) {
            issues.push({
                id: `index-high-count-${table}`,
                layer: 'index',
                severity: 'suggestion',
                category: 'high-index-count',
                title: 'High index count',
                message: `Table "${table}" has ${count} indexes. Too many indexes slow down INSERT/UPDATE/DELETE operations.`,
                affectedObjects: [{ type: 'table', name: table }],
                remediation: 'Review indexes for redundancy. Remove unused or redundant indexes.',
                riskScore: 30,
            });
        }
    }

    return {
        indexes: {
            indexes: indexEntries,
            duplicateIndexes,
            redundantIndexes,
            missingIndexSuggestions,
            fkNotIndexed,
            expressionIndexes,
            partialIndexes,
        },
        issues,
    };
}

function detectDuplicateIndexes(indexes: IndexEntry[]): DuplicateIndex[] {
    const duplicates: DuplicateIndex[] = [];
    const seen = new Map<string, IndexEntry>();

    for (const idx of indexes) {
        const key = `${idx.table}:${idx.columns.join(',')}:${idx.type}`;
        const existing = seen.get(key);
        if (existing) {
            duplicates.push({
                index1: existing.name,
                index2: idx.name,
                table: idx.table,
                columns: idx.columns,
                recommendation: `Drop one of the duplicate indexes. Keep ${existing.isUnique ? existing.name : idx.isUnique ? idx.name : existing.name}.`,
            });
        } else {
            seen.set(key, idx);
        }
    }

    return duplicates;
}

function detectRedundantIndexes(indexes: IndexEntry[]): RedundantIndex[] {
    const redundant: RedundantIndex[] = [];

    // Group by table
    const byTable = new Map<string, IndexEntry[]>();
    for (const idx of indexes) {
        if (!byTable.has(idx.table)) byTable.set(idx.table, []);
        byTable.get(idx.table)!.push(idx);
    }

    for (const [table, tableIndexes] of byTable) {
        // Sort by column count descending (wider indexes first)
        const sorted = [...tableIndexes].sort((a, b) => b.columns.length - a.columns.length);

        for (let i = 0; i < sorted.length; i++) {
            for (let j = i + 1; j < sorted.length; j++) {
                const wider = sorted[i];
                const narrower = sorted[j];

                // Check if narrower is a prefix of wider (and same type)
                if (wider.type === narrower.type && isPrefix(narrower.columns, wider.columns)) {
                    // Don't flag unique indexes as redundant of non-unique
                    if (narrower.isUnique && !wider.isUnique) continue;
                    // Don't flag partial indexes (different predicates)
                    if (narrower.isPartial || wider.isPartial) continue;

                    redundant.push({
                        redundantIndex: narrower.name,
                        supersededBy: wider.name,
                        table,
                        recommendation: `"${narrower.name}" columns are a prefix of "${wider.name}". The wider index can serve both purposes.`,
                    });
                }
            }
        }
    }

    return redundant;
}

function isPrefix(shorter: string[], longer: string[]): boolean {
    if (shorter.length >= longer.length) return false;
    for (let i = 0; i < shorter.length; i++) {
        if (shorter[i] !== longer[i]) return false;
    }
    return true;
}

function detectFKNotIndexed(schema: ParsedSchema): FKWithoutIndex[] {
    const missing: FKWithoutIndex[] = [];

    // Build indexed leading columns per table
    const indexedLeading = new Map<string, Set<string>>();
    for (const idx of schema.indexes) {
        if (!indexedLeading.has(idx.table)) indexedLeading.set(idx.table, new Set());
        if (idx.columns.length > 0) {
            indexedLeading.get(idx.table)!.add(idx.columns[0]);
        }
    }

    // Helper: strip schema prefix from name for safe index naming
    const safeName = (name: string) => {
        const bare = name.includes('.') ? name.split('.').pop()! : name;
        return bare.replace(/[^a-z0-9_]/gi, '_');
    };

    for (const table of schema.tables) {
        // Skip partition children (inherit indexes from parent)
        if (table.partitionOf) continue;

        const pkCols = new Set(table.columns.filter(c => c.isPrimaryKey).map(c => c.name));
        const tableIndexed = indexedLeading.get(table.name) || new Set();

        for (const col of table.columns) {
            if (col.isForeignKey && !col.isPrimaryKey) {
                if (!tableIndexed.has(col.name) && !pkCols.has(col.name)) {
                    const safeTable = safeName(table.name);
                    missing.push({
                        table: table.name,
                        columns: [col.name],
                        referencedTable: col.references?.table || 'unknown',
                        suggestedIndex: `CREATE INDEX idx_${safeTable}_${col.name} ON ${table.name}(${col.name});`,
                    });
                }
            }
        }
    }

    return missing;
}

function detectMissingIndexSuggestions(schema: ParsedSchema, indexes: IndexEntry[]): MissingIndex[] {
    const suggestions: MissingIndex[] = [];

    // Build existing index coverage
    const indexedColumns = new Set<string>();
    for (const idx of indexes) {
        for (const col of idx.columns) {
            indexedColumns.add(`${idx.table}.${col}`);
        }
    }

    // Helper: strip schema prefix for safe index naming
    const safeName = (name: string) => {
        const bare = name.includes('.') ? name.split('.').pop()! : name;
        return bare.replace(/[^a-z0-9_]/gi, '_');
    };

    for (const table of schema.tables) {
        // Skip partition children
        if (table.partitionOf) continue;

        // JSONB columns without GIN index (high-value suggestion)
        const jsonbCols = table.columns.filter(c =>
            c.type.toLowerCase() === 'jsonb' || c.type.toLowerCase() === 'json'
        );
        for (const col of jsonbCols) {
            const hasGin = indexes.some(i =>
                i.table === table.name && i.type === 'gin' && i.columns.includes(col.name)
            );
            if (!hasGin && col.type.toLowerCase() === 'jsonb') {
                const safeTable = safeName(table.name);
                suggestions.push({
                    table: table.name,
                    columns: [col.name],
                    reason: `JSONB column "${table.name}.${col.name}" has no GIN index for efficient querying.`,
                    suggestedDDL: `CREATE INDEX idx_${safeTable}_${col.name}_gin ON ${table.name} USING gin (${col.name});`,
                    priority: 'medium',
                });
            }
        }

        // Only suggest timestamp/status indexes for larger tables with significant column count
        if (table.columns.length < 8) continue;

        // Timestamp columns commonly queried by range
        const tsCols = table.columns.filter(c =>
            c.type.toLowerCase().includes('timestamp') &&
            (c.name.includes('created') || c.name.includes('updated') || c.name.includes('deleted'))
        );
        for (const col of tsCols) {
            if (!indexedColumns.has(`${table.name}.${col.name}`)) {
                const safeTable = safeName(table.name);
                suggestions.push({
                    table: table.name,
                    columns: [col.name],
                    reason: `Timestamp column "${table.name}.${col.name}" is commonly used in range queries but has no index.`,
                    suggestedDDL: `CREATE INDEX idx_${safeTable}_${col.name} ON ${table.name}(${col.name});`,
                    priority: 'low',
                });
            }
        }

        // Status/state columns (only for tables with many columns — these get many queries)
        const statusCols = table.columns.filter(c =>
            (c.name.includes('status') || c.name.includes('state') || c.name.includes('is_active') || c.name.includes('is_deleted')) &&
            table.columns.length > 10
        );
        for (const col of statusCols) {
            if (!indexedColumns.has(`${table.name}.${col.name}`)) {
                const safeTable = safeName(table.name);
                suggestions.push({
                    table: table.name,
                    columns: [col.name],
                    reason: `Column "${table.name}.${col.name}" likely used in WHERE filters but has no index.`,
                    suggestedDDL: `CREATE INDEX idx_${safeTable}_${col.name} ON ${table.name}(${col.name}) WHERE ${col.name} IS NOT NULL;`,
                    priority: 'low',
                });
            }
        }
    }

    return suggestions;
}
