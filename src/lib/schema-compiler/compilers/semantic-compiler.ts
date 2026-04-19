/**
 * Semantic Compiler
 * 
 * Layer 19: Cross-object semantic analysis — symbol table construction,
 * unresolved references, shadowed names, type drift, naming consistency,
 * and cross-schema coupling detection.
 */

import type { ParsedSchema } from '@/lib/sql-parser';
import type {
    SemanticCompilation, CompilationIssue, SymbolEntry,
    UnresolvedReference, ShadowedName, TypeDrift, NamingAnomaly,
    CrossSchemaCoupling,
} from '../types';

type SymbolType = 'table' | 'view' | 'function' | 'trigger' | 'sequence' | 'type' | 'index' | 'policy' | 'column' | 'schema' | 'extension';

// Common naming convention patterns
const NAMING_PATTERNS = {
    snake_case: /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/,
    camelCase: /^[a-z][a-zA-Z0-9]*$/,
    PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
    UPPER_SNAKE: /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/,
};

export function compileSemantic(schema: ParsedSchema): { semantic: SemanticCompilation; issues: CompilationIssue[] } {
    const issues: CompilationIssue[] = [];

    // --- 1. Build Symbol Table ---
    const symbols = new Map<string, SymbolEntry>();

    function addSymbol(name: string, type: SymbolType, schema_?: string, definedIn?: string) {
        const key = `${type}::${schema_ || ''}::${name}`;
        symbols.set(key, { name, type, schema: schema_, definedIn });
    }

    for (const table of schema.tables) {
        addSymbol(table.name, 'table', table.schema);
        for (const col of table.columns) {
            addSymbol(`${table.name}.${col.name}`, 'column', table.schema);
        }
    }
    for (const view of schema.views) addSymbol(view.name, 'view', view.schema);
    for (const func of schema.functions) addSymbol(func.name, 'function', func.schema);
    for (const trigger of schema.triggers) addSymbol(trigger.name, 'trigger', trigger.schema);
    for (const seq of schema.sequences) addSymbol(seq.name, 'sequence', seq.schema);
    for (const idx of schema.indexes) addSymbol(idx.name, 'index');
    for (const policy of schema.policies) addSymbol(policy.name, 'policy');
    for (const ext of schema.extensions) addSymbol(ext.name, 'extension');
    for (const enumType of schema.enumTypes) addSymbol(enumType.name, 'type', enumType.schema);
    for (const domain of schema.domains) addSymbol(domain.name, 'type', domain.schema);
    for (const composite of schema.compositeTypes) addSymbol(composite.name, 'type', composite.schema);

    // --- 2. Unresolved References ---
    const unresolvedRefs: UnresolvedReference[] = [];
    const tableNames = new Set(schema.tables.map(t => t.name));
    const viewNames = new Set(schema.views.map(v => v.name));
    const funcNames = new Set(schema.functions.map(f => f.name));

    // FK targets pointing to non-existent tables
    for (const rel of schema.relationships) {
        if (!tableNames.has(rel.target.table) && !viewNames.has(rel.target.table)) {
            unresolvedRefs.push({
                source: `${rel.source.table}.${rel.source.column || '?'}`,
                sourceType: 'table',
                target: rel.target.table,
                targetType: 'table',
                referenceType: 'foreign-key',
            });
        }
    }

    // Views referencing non-existent tables
    for (const view of schema.views) {
        const referencedTables = (view as any).referencedTables;
        if (referencedTables) {
            for (const ref of referencedTables) {
                const refName = typeof ref === 'string' ? ref : ref;
                if (!tableNames.has(refName) && !viewNames.has(refName)) {
                    unresolvedRefs.push({
                        source: view.name,
                        sourceType: 'view',
                        target: refName,
                        targetType: 'table',
                        referenceType: 'view-dependency',
                    });
                }
            }
        }
    }

    // Trigger functions that don't exist
    for (const trigger of schema.triggers) {
        if (trigger.functionName && !funcNames.has(trigger.functionName)) {
            unresolvedRefs.push({
                source: trigger.name,
                sourceType: 'trigger',
                target: trigger.functionName,
                targetType: 'function',
                referenceType: 'trigger-function',
            });
        }
    }

    if (unresolvedRefs.length > 0) {
        issues.push({
            id: 'semantic-unresolved-refs',
            layer: 'semantic',
            severity: 'error',
            category: 'unresolved-reference',
            title: `${unresolvedRefs.length} unresolved reference(s)`,
            message: `Found ${unresolvedRefs.length} references to objects that don't exist in this schema: ${unresolvedRefs.slice(0, 5).map(r => `${r.source} → ${r.target}`).join(', ')}${unresolvedRefs.length > 5 ? '...' : ''}.`,
            affectedObjects: unresolvedRefs.map(r => ({ type: r.sourceType as any, name: r.source })),
            riskScore: 60,
        });
    }

    // --- 3. Shadowed Names ---
    const shadowedNames: ShadowedName[] = [];
    const namesByPlain = new Map<string, { type: string; schema?: string }[]>();

    for (const [, sym] of symbols) {
        const plainName = sym.name.includes('.') ? sym.name : sym.name;
        if (!namesByPlain.has(plainName)) namesByPlain.set(plainName, []);
        namesByPlain.get(plainName)!.push({ type: sym.type, schema: sym.schema });
    }

    for (const [name, entries] of namesByPlain) {
        // Skip column entries (they contain table.col)
        if (name.includes('.')) continue;

        const uniqueTypes = new Set(entries.map(e => e.type));
        if (uniqueTypes.size > 1) {
            shadowedNames.push({
                name,
                definitions: entries.map(e => ({ type: e.type, schema: e.schema })),
            });
        }
    }

    if (shadowedNames.length > 3) {
        issues.push({
            id: 'semantic-shadowed-names',
            layer: 'semantic',
            severity: 'warning',
            category: 'shadowed-names',
            title: 'Name shadowing detected',
            message: `${shadowedNames.length} names are used across different object types: ${shadowedNames.slice(0, 5).map(s => `"${s.name}" (${s.definitions.map(d => d.type).join('/')})`).join(', ')}.`,
            affectedObjects: shadowedNames.slice(0, 5).map(s => ({ type: 'table' as const, name: s.name })),
            remediation: 'Use distinct names for different object types to avoid ambiguous references.',
            riskScore: 20,
        });
    }

    // --- 4. Type Drift ---
    const typeDrift: TypeDrift[] = [];

    // Detect columns with the same name but different types across tables
    const columnTypes = new Map<string, { table: string; type: string; typeCategory?: string }[]>();
    for (const table of schema.tables) {
        for (const col of table.columns) {
            if (!columnTypes.has(col.name)) columnTypes.set(col.name, []);
            columnTypes.get(col.name)!.push({
                table: table.name,
                type: col.type.toLowerCase(),
                typeCategory: col.typeCategory,
            });
        }
    }

    for (const [colName, usages] of columnTypes) {
        if (usages.length < 2) continue;
        // Normalize types for comparison
        const uniqueTypes = new Set(usages.map(u => normalizeType(u.type)));
        if (uniqueTypes.size > 1) {
            // Only flag "semantic" columns that should likely be consistent
            const isSemantic = isSemanticColumn(colName);
            if (isSemantic || usages.length >= 3) {
                typeDrift.push({
                    columnName: colName,
                    variations: usages.map(u => ({ table: u.table, type: u.type })),
                    isSemantic,
                });
            }
        }
    }

    if (typeDrift.length > 0) {
        issues.push({
            id: 'semantic-type-drift',
            layer: 'semantic',
            severity: 'warning',
            category: 'type-drift',
            title: `Type drift in ${typeDrift.length} column(s)`,
            message: `${typeDrift.length} column name(s) have inconsistent types across tables: ${typeDrift.slice(0, 5).map(d => `"${d.columnName}" (${d.variations.map(v => `${v.table}:${v.type}`).join(', ')})`).join('; ')}.`,
            affectedObjects: typeDrift.flatMap(d => d.variations.map(v => ({ type: 'table' as const, name: v.table }))),
            remediation: 'Use consistent types for columns with the same semantic meaning across tables.',
            riskScore: 35,
        });
    }

    // --- 5. Naming Consistency ---
    const namingAnomalies: NamingAnomaly[] = [];

    // Detect dominant naming convention for tables
    const tableConvention = detectDominantConvention(schema.tables.map(t => t.name));
    for (const table of schema.tables) {
        if (tableConvention.pattern && !tableConvention.pattern.test(table.name)) {
            namingAnomalies.push({
                name: table.name,
                type: 'table',
                expectedConvention: tableConvention.name,
                actualPattern: detectPattern(table.name),
            });
        }
    }

    // Detect dominant naming convention for columns
    const allColNames = schema.tables.flatMap(t => t.columns.map(c => c.name));
    const colConvention = detectDominantConvention(allColNames);
    for (const table of schema.tables) {
        for (const col of table.columns) {
            if (colConvention.pattern && !colConvention.pattern.test(col.name)) {
                namingAnomalies.push({
                    name: `${table.name}.${col.name}`,
                    type: 'column',
                    expectedConvention: colConvention.name,
                    actualPattern: detectPattern(col.name),
                });
            }
        }
    }

    if (namingAnomalies.length > 5) {
        issues.push({
            id: 'semantic-naming-anomalies',
            layer: 'semantic',
            severity: 'info',
            category: 'naming-inconsistency',
            title: `${namingAnomalies.length} naming anomalies`,
            message: `Dominant conventions: tables=${tableConvention.name}, columns=${colConvention.name}. ${namingAnomalies.length} names deviate from the convention.`,
            affectedObjects: namingAnomalies.slice(0, 10).map(a => ({ type: a.type as any, name: a.name })),
            remediation: 'Standardize naming conventions for consistency and tooling compatibility.',
            riskScore: 10,
        });
    }

    // --- 6. Cross-Schema Coupling ---
    const crossSchemaCoupling: { sourceSchema: string; targetSchema: string; edgeCount: number }[] = [];
    if (schema.schemas.length > 1) {
        const schemaEdges = new Map<string, number>();
        for (const rel of schema.relationships) {
            const sourceSchema = schema.tables.find(t => t.name === rel.source.table)?.schema || 'public';
            const targetSchema = schema.tables.find(t => t.name === rel.target.table)?.schema || 'public';
            if (sourceSchema !== targetSchema) {
                const key = `${sourceSchema}→${targetSchema}`;
                schemaEdges.set(key, (schemaEdges.get(key) || 0) + 1);
            }
        }

        for (const [key, count] of schemaEdges) {
            const [source, target] = key.split('→');
            crossSchemaCoupling.push({ sourceSchema: source, targetSchema: target, edgeCount: count });
        }

        if (crossSchemaCoupling.length > 0) {
            issues.push({
                id: 'semantic-cross-schema',
                layer: 'semantic',
                severity: 'info',
                category: 'cross-schema-coupling',
                title: `${crossSchemaCoupling.length} cross-schema dependencies`,
                message: `Foreign keys span across ${crossSchemaCoupling.length} schema boundary pairs.`,
                affectedObjects: [],
                riskScore: 15,
            });
        }
    }

    return {
        semantic: {
            symbolTable: Array.from(symbols.values()),
            unresolvedReferences: unresolvedRefs,
            shadowedNames,
            typeDrift,
            namingAnomalies,
            crossSchemaCoupling,
            totalSymbols: symbols.size,
        },
        issues,
    };
}

function normalizeType(type: string): string {
    const map: Record<string, string> = {
        'int': 'integer', 'int4': 'integer', 'int8': 'bigint',
        'int2': 'smallint', 'float4': 'real', 'float8': 'double precision',
        'bool': 'boolean', 'varchar': 'character varying',
        'timestamp': 'timestamp without time zone',
        'timestamptz': 'timestamp with time zone',
    };
    // Strip length specs
    const base = type.replace(/\(.+\)/, '').trim();
    return map[base] || base;
}

function isSemanticColumn(name: string): boolean {
    const semanticNames = [
        'id', 'uuid', 'created_at', 'updated_at', 'deleted_at',
        'email', 'name', 'status', 'type', 'price', 'amount',
        'user_id', 'account_id', 'created_by', 'modified_by',
    ];
    return semanticNames.includes(name.toLowerCase());
}

function detectDominantConvention(names: string[]): { name: string; pattern: RegExp | null } {
    if (names.length === 0) return { name: 'none', pattern: null };

    const counts: Record<string, number> = {};
    for (const name of names) {
        const pat = detectPattern(name);
        counts[pat] = (counts[pat] || 0) + 1;
    }

    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (!dominant || dominant[1] < names.length * 0.6) return { name: 'mixed', pattern: null };

    const patternMap: Record<string, RegExp> = NAMING_PATTERNS;
    return { name: dominant[0], pattern: patternMap[dominant[0]] || null };
}

function detectPattern(name: string): string {
    if (NAMING_PATTERNS.snake_case.test(name)) return 'snake_case';
    if (NAMING_PATTERNS.camelCase.test(name)) return 'camelCase';
    if (NAMING_PATTERNS.PascalCase.test(name)) return 'PascalCase';
    if (NAMING_PATTERNS.UPPER_SNAKE.test(name)) return 'UPPER_SNAKE';
    return 'other';
}
