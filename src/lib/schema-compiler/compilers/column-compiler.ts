/**
 * Column Compiler
 * 
 * Layer 4: Deep column-level compilation with type resolution, domain resolution,
 * semantic analysis (business key candidates, index coverage, constraint participation),
 * type mismatch detection across FK pairs, and implicit cast risk analysis.
 */

import type { ParsedSchema, Column, Table, Index, Domain } from '@/lib/sql-parser';
import type {
    ColumnCompilation, CompilationIssue, DomainResolution,
    IndexCoverageInfo, ConstraintParticipation, TypeMismatch, ImplicitCastRisk,
} from '../types';

// Type equivalence groups for mismatch detection
const TYPE_EQUIVALENCES: Record<string, string> = {
    'int': 'int4', 'integer': 'int4', 'int4': 'int4',
    'bigint': 'int8', 'int8': 'int8',
    'smallint': 'int2', 'int2': 'int2',
    'serial': 'int4', 'bigserial': 'int8', 'smallserial': 'int2',
    'real': 'float4', 'float4': 'float4',
    'double precision': 'float8', 'float8': 'float8',
    'boolean': 'bool', 'bool': 'bool',
    'character varying': 'varchar', 'varchar': 'varchar',
    'character': 'char', 'char': 'char', 'bpchar': 'char',
    'timestamp without time zone': 'timestamp', 'timestamp': 'timestamp',
    'timestamp with time zone': 'timestamptz', 'timestamptz': 'timestamptz',
    'time without time zone': 'time', 'time': 'time',
    'time with time zone': 'timetz', 'timetz': 'timetz',
    'text': 'text', 'uuid': 'uuid', 'jsonb': 'jsonb', 'json': 'json',
    'bytea': 'bytea', 'date': 'date', 'interval': 'interval',
    'numeric': 'numeric', 'decimal': 'numeric', 'money': 'money',
    'inet': 'inet', 'cidr': 'cidr', 'macaddr': 'macaddr',
};

// Types where implicit casts can lose precision
const IMPLICIT_CAST_RISKS: Array<{ from: string; to: string; risk: 'high' | 'medium' | 'low'; reason: string }> = [
    { from: 'int8', to: 'int4', risk: 'high', reason: 'Potential integer overflow' },
    { from: 'int4', to: 'int2', risk: 'high', reason: 'Potential integer overflow' },
    { from: 'float8', to: 'float4', risk: 'medium', reason: 'Loss of precision' },
    { from: 'numeric', to: 'float4', risk: 'medium', reason: 'Loss of decimal precision' },
    { from: 'numeric', to: 'float8', risk: 'low', reason: 'Possible rounding' },
    { from: 'text', to: 'varchar', risk: 'medium', reason: 'Potential truncation' },
    { from: 'timestamptz', to: 'timestamp', risk: 'medium', reason: 'Loss of timezone info' },
];

const BUSINESS_KEY_PATTERNS = [
    /^email$/i, /^username$/i, /^slug$/i, /^code$/i, /^sku$/i,
    /^phone$/i, /^ssn$/i, /^tax_id$/i, /^license/i, /^registration/i,
    /^account.*(number|no|id)$/i, /^order.*(number|no)$/i,
    /^invoice.*(number|no)$/i, /^tracking/i,
];

export function compileColumns(schema: ParsedSchema): { columns: ColumnCompilation[]; issues: CompilationIssue[] } {
    const issues: CompilationIssue[] = [];
    const columns: ColumnCompilation[] = [];

    // Build domain lookup
    const domainMap = new Map<string, Domain>();
    for (const domain of schema.domains) {
        domainMap.set(domain.name.toLowerCase(), domain);
        if (domain.schema) {
            domainMap.set(`${domain.schema}.${domain.name}`.toLowerCase(), domain);
        }
    }

    // Build index lookup: table -> column -> index names
    const indexLookup = buildIndexLookup(schema.indexes);

    // Build FK pair map for type mismatch detection
    const fkPairs = buildFKPairs(schema);

    for (const table of schema.tables) {
        for (const col of table.columns) {
            const resolvedType = resolveType(col.type, domainMap);
            const domainResolution = resolveDomain(col.type, domainMap);
            const arrayDimensions = countArrayDimensions(col.type);
            const indexCoverage = computeIndexCoverage(table.name, col.name, indexLookup, col.isPrimaryKey);
            const constraintParticipation = computeConstraintParticipation(col, table);
            const isBusinessKey = detectBusinessKey(col, constraintParticipation);
            const typeMismatches = detectTypeMismatches(table.name, col, fkPairs, domainMap);
            const implicitCastRisks = detectImplicitCastRisks(table.name, col, fkPairs);

            columns.push({
                tableName: table.name,
                tableSchema: table.schema || 'public',
                name: col.name,
                resolvedType: resolvedType,
                originalType: col.type,
                typeCategory: col.typeCategory,
                domainResolution,
                arrayDimensions,
                collation: undefined, // requires introspection
                nullable: col.nullable,
                defaultExpression: col.defaultValue,
                isGenerated: col.isGenerated,
                generatedExpression: col.generatedExpression,
                identityGeneration: undefined,
                storageType: undefined,
                compression: undefined,
                statisticsTarget: undefined,
                isBusinessKeyCandidate: isBusinessKey,
                indexCoverage,
                constraintParticipation,
                typeMismatchDetection: typeMismatches.length > 0 ? typeMismatches : undefined,
                implicitCastRisks: implicitCastRisks.length > 0 ? implicitCastRisks : undefined,
            });

            // Type mismatch issues
            for (const mismatch of typeMismatches) {
                issues.push({
                    id: `col-type-mismatch-${table.name}-${col.name}-${mismatch.remoteTable}-${mismatch.remoteColumn}`,
                    layer: 'column',
                    severity: mismatch.severity === 'error' ? 'error' : 'warning',
                    category: 'type-mismatch',
                    title: 'FK type mismatch',
                    message: mismatch.description,
                    affectedObjects: [
                        { type: 'column', name: `${table.name}.${col.name}`, detail: mismatch.localType },
                        { type: 'column', name: `${mismatch.remoteTable}.${mismatch.remoteColumn}`, detail: mismatch.remoteType },
                    ],
                    remediation: `Align column types: both should use the same type (${mismatch.remoteType} recommended).`,
                    riskScore: mismatch.severity === 'error' ? 70 : 40,
                });
            }

            // Implicit cast risk issues
            for (const risk of implicitCastRisks) {
                issues.push({
                    id: `col-cast-risk-${table.name}-${col.name}-${risk.context}`,
                    layer: 'column',
                    severity: risk.riskLevel === 'high' ? 'warning' : 'suggestion',
                    category: 'implicit-cast',
                    title: 'Implicit cast risk',
                    message: `Column "${table.name}.${col.name}" (${risk.fromType}) may require implicit cast to ${risk.toType} in ${risk.context}.`,
                    affectedObjects: [{ type: 'column', name: `${table.name}.${col.name}` }],
                    riskScore: risk.riskLevel === 'high' ? 50 : risk.riskLevel === 'medium' ? 30 : 15,
                });
            }

            // Nullable FK 
            if (col.isForeignKey && col.nullable) {
                issues.push({
                    id: `col-nullable-fk-${table.name}-${col.name}`,
                    layer: 'column',
                    severity: 'info',
                    category: 'nullable-fk',
                    title: 'Nullable foreign key',
                    message: `FK column "${table.name}.${col.name}" is nullable, meaning optional relationships are allowed.`,
                    affectedObjects: [{ type: 'column', name: `${table.name}.${col.name}` }],
                    riskScore: 5,
                });
            }
        }
    }

    return { columns, issues };
}

function resolveType(type: string, domainMap: Map<string, Domain>): string {
    const normalized = type.toLowerCase().replace(/\s+/g, ' ').trim();
    const domain = domainMap.get(normalized);
    if (domain) return domain.baseType;
    return type;
}

function resolveDomain(type: string, domainMap: Map<string, Domain>): DomainResolution | undefined {
    const normalized = type.toLowerCase().replace(/\s+/g, ' ').trim();
    const domain = domainMap.get(normalized);
    if (!domain) return undefined;

    return {
        domainName: domain.name,
        domainSchema: domain.schema,
        baseType: domain.baseType,
        constraints: [
            ...(domain.notNull ? ['NOT NULL'] : []),
            ...(domain.checkExpression ? [`CHECK (${domain.checkExpression})`] : []),
        ],
    };
}

function countArrayDimensions(type: string): number {
    const match = type.match(/(\[\])+$/);
    if (!match) return 0;
    return (match[0].length / 2);
}

function buildIndexLookup(indexes: ParsedSchema['indexes']): Map<string, Map<string, { names: string[]; isLeading: boolean }>> {
    const lookup = new Map<string, Map<string, { names: string[]; isLeading: boolean }>>();

    for (const idx of indexes) {
        if (!lookup.has(idx.table)) lookup.set(idx.table, new Map());
        const tableMap = lookup.get(idx.table)!;

        for (let i = 0; i < idx.columns.length; i++) {
            const col = idx.columns[i];
            if (!tableMap.has(col)) tableMap.set(col, { names: [], isLeading: false });
            const entry = tableMap.get(col)!;
            entry.names.push(idx.name);
            if (i === 0) entry.isLeading = true;
        }
    }

    return lookup;
}

function computeIndexCoverage(
    tableName: string,
    columnName: string,
    indexLookup: Map<string, Map<string, { names: string[]; isLeading: boolean }>>,
    isPrimaryKey: boolean,
): IndexCoverageInfo {
    const tableMap = indexLookup.get(tableName);
    const entry = tableMap?.get(columnName);

    return {
        isIndexed: isPrimaryKey || (entry?.names.length ?? 0) > 0,
        isPrimaryKey,
        indexNames: entry?.names || [],
        isLeadingColumn: isPrimaryKey || (entry?.isLeading ?? false),
        coverageLevel: isPrimaryKey ? 'full' :
            entry?.isLeading ? 'full' :
            (entry?.names.length ?? 0) > 0 ? 'partial' : 'none',
    };
}

function computeConstraintParticipation(col: Column, table: Table): ConstraintParticipation {
    const inUniqueConstraint = table.uniqueConstraints.some(uc =>
        uc.columns?.includes(col.name)
    );
    const inCheckConstraint = table.checkConstraints.some(cc =>
        cc.expression?.includes(col.name)
    );

    return {
        primaryKey: col.isPrimaryKey,
        foreignKey: col.isForeignKey,
        unique: col.isUnique || inUniqueConstraint,
        check: !!col.checkConstraint || inCheckConstraint,
        notNull: !col.nullable,
        exclusion: false, // detection requires deeper parsing
    };
}

function detectBusinessKey(col: Column, cp: ConstraintParticipation): boolean {
    // Already a PK? Not a business key candidate (it IS the key)
    if (cp.primaryKey) return false;

    // Must be unique and not-null to be a candidate
    if (!cp.unique || col.nullable) return false;

    // Check name patterns
    return BUSINESS_KEY_PATTERNS.some(p => p.test(col.name));
}

interface FKPair {
    sourceTable: string;
    sourceColumn: string;
    sourceType: string;
    targetTable: string;
    targetColumn: string;
    targetType: string;
}

function buildFKPairs(schema: ParsedSchema): FKPair[] {
    const pairs: FKPair[] = [];
    const tableMap = new Map<string, Table>();
    for (const t of schema.tables) tableMap.set(t.name, t);

    for (const table of schema.tables) {
        for (const col of table.columns) {
            if (col.references) {
                const targetTable = tableMap.get(col.references.table);
                const targetCol = targetTable?.columns.find(c => c.name === col.references!.column);
                if (targetCol) {
                    pairs.push({
                        sourceTable: table.name,
                        sourceColumn: col.name,
                        sourceType: col.type,
                        targetTable: col.references.table,
                        targetColumn: col.references.column,
                        targetType: targetCol.type,
                    });
                }
            }
        }
    }

    return pairs;
}

function normalizeTypeName(type: string): string {
    const clean = type.toLowerCase().replace(/\s+/g, ' ').replace(/\(.+\)/, '').trim();
    return TYPE_EQUIVALENCES[clean] || clean;
}

function detectTypeMismatches(
    tableName: string,
    col: Column,
    fkPairs: FKPair[],
    domainMap: Map<string, Domain>,
): TypeMismatch[] {
    const mismatches: TypeMismatch[] = [];

    // Find FK pairs where this column is involved
    const relevantPairs = fkPairs.filter(p =>
        (p.sourceTable === tableName && p.sourceColumn === col.name) ||
        (p.targetTable === tableName && p.targetColumn === col.name)
    );

    for (const pair of relevantPairs) {
        const sourceNorm = normalizeTypeName(resolveType(pair.sourceType, domainMap));
        const targetNorm = normalizeTypeName(resolveType(pair.targetType, domainMap));

        if (sourceNorm !== targetNorm) {
            const isThis = pair.sourceTable === tableName && pair.sourceColumn === col.name;
            mismatches.push({
                localColumn: col.name,
                localType: isThis ? pair.sourceType : pair.targetType,
                remoteTable: isThis ? pair.targetTable : pair.sourceTable,
                remoteColumn: isThis ? pair.targetColumn : pair.sourceColumn,
                remoteType: isThis ? pair.targetType : pair.sourceType,
                severity: isPrecisionLoss(sourceNorm, targetNorm) ? 'error' : 'warning',
                description: `FK type mismatch: "${tableName}.${col.name}" (${isThis ? pair.sourceType : pair.targetType}) → "${isThis ? pair.targetTable : pair.sourceTable}.${isThis ? pair.targetColumn : pair.sourceColumn}" (${isThis ? pair.targetType : pair.sourceType})`,
            });
        }
    }

    return mismatches;
}

function isPrecisionLoss(from: string, to: string): boolean {
    const width: Record<string, number> = { int2: 1, int4: 2, int8: 3, float4: 1, float8: 2 };
    return (width[from] || 0) > (width[to] || 0);
}

function detectImplicitCastRisks(
    tableName: string,
    col: Column,
    fkPairs: FKPair[],
): ImplicitCastRisk[] {
    const risks: ImplicitCastRisk[] = [];
    const colNorm = normalizeTypeName(col.type);

    for (const pair of fkPairs) {
        if (pair.sourceTable === tableName && pair.sourceColumn === col.name) {
            const targetNorm = normalizeTypeName(pair.targetType);
            for (const risk of IMPLICIT_CAST_RISKS) {
                if (colNorm === risk.from && targetNorm === risk.to) {
                    risks.push({
                        fromType: col.type,
                        toType: pair.targetType,
                        context: `FK → ${pair.targetTable}.${pair.targetColumn}`,
                        riskLevel: risk.risk,
                    });
                }
            }
        }
    }

    return risks;
}
