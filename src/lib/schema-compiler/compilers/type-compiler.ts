/**
 * Type Compiler
 * 
 * Layer 5: Compiles all data types (enums, domains, composite types, range types),
 * detects unused enums, domain constraint conflicts, duplicate enum semantics,
 * and builds type dependency graph.
 */

import type { ParsedSchema, EnumType, Domain, CompositeType, Column } from '@/lib/sql-parser';
import type {
    TypeCompilation, CompilationIssue, EnumCompilationEntry,
    DomainCompilationEntry, CompositeTypeEntry, RangeTypeEntry,
    DomainConflict, DuplicateEnum, TypeDependencyEdge,
} from '../types';

export function compileTypes(schema: ParsedSchema): { types: TypeCompilation; issues: CompilationIssue[] } {
    const issues: CompilationIssue[] = [];

    // Build column type usage map
    const typeUsage = buildTypeUsageMap(schema);

    // Compile enums
    const enums: EnumCompilationEntry[] = [];
    const enumNames = new Set<string>();

    for (const enumType of schema.enumTypes) {
        enumNames.add(enumType.name.toLowerCase());
        const usedBy = typeUsage.get(enumType.name.toLowerCase()) || [];
        enums.push({
            name: enumType.name,
            schema: enumType.schema,
            values: enumType.values,
            usedByColumns: usedBy,
            isUsed: usedBy.length > 0,
        });
    }

    // Also check legacy enum map
    if (schema.enums instanceof Map) {
        for (const [name, values] of schema.enums) {
            if (!enumNames.has(name.toLowerCase())) {
                const usedBy = typeUsage.get(name.toLowerCase()) || [];
                enums.push({
                    name,
                    schema: undefined,
                    values,
                    usedByColumns: usedBy,
                    isUsed: usedBy.length > 0,
                });
                enumNames.add(name.toLowerCase());
            }
        }
    }

    // Compile domains
    const domains: DomainCompilationEntry[] = schema.domains.map(d => {
        const usedBy = typeUsage.get(d.name.toLowerCase()) || [];
        return {
            name: d.name,
            schema: d.schema,
            baseType: d.baseType,
            notNull: d.notNull || false,
            default: d.default,
            checkExpressions: d.checkExpression ? [d.checkExpression] : [],
            usedByColumns: usedBy,
            isUsed: usedBy.length > 0,
        };
    });

    // Compile composite types
    const compositeTypes: CompositeTypeEntry[] = schema.compositeTypes.map(ct => {
        const usedBy = typeUsage.get(ct.name.toLowerCase()) || [];
        return {
            name: ct.name,
            schema: ct.schema,
            attributes: ct.attributes,
            usedByColumns: usedBy,
        };
    });

    // Range types (detected from column types)
    const rangeTypes: RangeTypeEntry[] = [];

    // Analysis: Unused enums
    const unusedEnums = enums.filter(e => !e.isUsed).map(e => e.name);
    const generatedEnumIssues = new Set<string>();
    for (const name of unusedEnums) {
        const id = `type-unused-enum-${name}`;
        if (generatedEnumIssues.has(id)) continue;
        generatedEnumIssues.add(id);

        issues.push({
            id,
            layer: 'type',
            severity: 'suggestion',
            category: 'unused-enum',
            title: 'Unused enum type',
            message: `Enum type "${name}" is defined but not used by any column.`,
            affectedObjects: [{ type: 'enum', name }],
            remediation: 'Remove the unused enum or apply it to relevant columns.',
            riskScore: 10,
        });
    }

    // Analysis: Unused domains
    const unusedDomains = domains.filter(d => !d.isUsed);
    const generatedDomainIssues = new Set<string>();
    for (const d of unusedDomains) {
        let idFullName = d.schema ? `${d.schema}.${d.name}` : d.name;
        const id = `type-unused-domain-${idFullName}`;
        if (generatedDomainIssues.has(id)) continue;
        generatedDomainIssues.add(id);

        issues.push({
            id,
            layer: 'type',
            severity: 'suggestion',
            category: 'unused-domain',
            title: 'Unused domain type',
            message: `Domain "${d.name}" (${d.baseType}) is defined but not used by any column.`,
            affectedObjects: [{ type: 'domain', name: d.name }],
            remediation: 'Remove the unused domain or apply it to relevant columns.',
            riskScore: 10,
        });
    }

    // Analysis: Duplicate enum semantics
    const duplicateEnumSemantics = detectDuplicateEnums(enums);
    for (const dup of duplicateEnumSemantics) {
        issues.push({
            id: `type-dup-enum-${dup.enum1}-${dup.enum2}`,
            layer: 'type',
            severity: 'suggestion',
            category: 'duplicate-enum',
            title: 'Similar enum types',
            message: `Enums "${dup.enum1}" and "${dup.enum2}" share ${dup.sharedValues.length} values (${Math.round(dup.similarity * 100)}% similarity). Consider consolidating.`,
            affectedObjects: [
                { type: 'enum', name: dup.enum1 },
                { type: 'enum', name: dup.enum2 },
            ],
            remediation: 'If these represent the same concept, consolidate into a single enum.',
            riskScore: 15,
        });
    }

    // Analysis: Domain constraint conflicts
    const domainConstraintConflicts = detectDomainConflicts(domains);
    for (const conflict of domainConstraintConflicts) {
        issues.push({
            id: `type-domain-conflict-${conflict.domain}`,
            layer: 'type',
            severity: 'warning',
            category: 'domain-conflict',
            title: 'Domain constraint conflict',
            message: conflict.description,
            affectedObjects: [{ type: 'domain', name: conflict.domain }],
            riskScore: 30,
        });
    }

    // Build type dependency edges
    const typeDependencyEdges = buildTypeDependencyEdges(schema);

    return {
        types: {
            enums,
            domains,
            compositeTypes,
            rangeTypes,
            unusedEnums,
            domainConstraintConflicts,
            duplicateEnumSemantics,
            typeDependencyEdges,
        },
        issues,
    };
}

function buildTypeUsageMap(schema: ParsedSchema): Map<string, { table: string; column: string }[]> {
    const usage = new Map<string, { table: string; column: string }[]>();

    for (const table of schema.tables) {
        for (const col of table.columns) {
            const typeName = col.type.toLowerCase().replace(/\[\]/g, '').replace(/\(.+\)/, '').trim();
            if (!usage.has(typeName)) usage.set(typeName, []);
            usage.get(typeName)!.push({ table: table.name, column: col.name });
        }
    }

    return usage;
}

function detectDuplicateEnums(enums: EnumCompilationEntry[]): DuplicateEnum[] {
    const duplicates: DuplicateEnum[] = [];

    for (let i = 0; i < enums.length; i++) {
        for (let j = i + 1; j < enums.length; j++) {
            const a = enums[i];
            const b = enums[j];

            const setA = new Set(a.values.map(v => v.toLowerCase()));
            const setB = new Set(b.values.map(v => v.toLowerCase()));

            const shared = a.values.filter(v => setB.has(v.toLowerCase()));
            const totalUnique = new Set([...a.values.map(v => v.toLowerCase()), ...b.values.map(v => v.toLowerCase())]).size;
            const similarity = totalUnique > 0 ? shared.length / totalUnique : 0;

            if (similarity >= 0.5 && shared.length >= 2) {
                duplicates.push({
                    enum1: a.name,
                    enum2: b.name,
                    sharedValues: shared,
                    similarity,
                });
            }
        }
    }

    return duplicates;
}

function detectDomainConflicts(domains: DomainCompilationEntry[]): DomainConflict[] {
    const conflicts: DomainConflict[] = [];

    for (const domain of domains) {
        // Check for NOT NULL domain with nullable default
        if (domain.notNull && domain.default === 'NULL') {
            conflicts.push({
                domain: domain.name,
                constraint: 'NOT NULL',
                conflictsWith: 'DEFAULT NULL',
                description: `Domain "${domain.name}" has NOT NULL constraint but DEFAULT NULL — default value violates constraint.`,
            });
        }

        // Check for multiple contradictory check constraints
        for (let i = 0; i < domain.checkExpressions.length; i++) {
            for (let j = i + 1; j < domain.checkExpressions.length; j++) {
                // Basic heuristic: if one says > X and another says < X
                const expr1 = domain.checkExpressions[i];
                const expr2 = domain.checkExpressions[j];
                if (hasContradiction(expr1, expr2)) {
                    conflicts.push({
                        domain: domain.name,
                        constraint: expr1,
                        conflictsWith: expr2,
                        description: `Domain "${domain.name}" may have contradictory CHECK constraints: "${expr1}" vs "${expr2}".`,
                    });
                }
            }
        }
    }

    return conflicts;
}

function hasContradiction(expr1: string, expr2: string): boolean {
    // Very simple heuristic: check for > vs < patterns on same operand
    const matchGt = expr1.match(/VALUE\s*>\s*(\d+)/i);
    const matchLt = expr2.match(/VALUE\s*<\s*(\d+)/i);
    if (matchGt && matchLt) {
        const gt = parseInt(matchGt[1]);
        const lt = parseInt(matchLt[1]);
        if (gt >= lt) return true;
    }
    return false;
}

function buildTypeDependencyEdges(schema: ParsedSchema): TypeDependencyEdge[] {
    const edges: TypeDependencyEdge[] = [];

    // Domains depend on their base types (if also user-defined)
    const userTypes = new Set<string>();
    for (const e of schema.enumTypes) userTypes.add(e.name.toLowerCase());
    for (const d of schema.domains) userTypes.add(d.name.toLowerCase());
    for (const ct of schema.compositeTypes) userTypes.add(ct.name.toLowerCase());

    for (const domain of schema.domains) {
        const baseNorm = domain.baseType.toLowerCase().replace(/\(.+\)/, '').trim();
        if (userTypes.has(baseNorm)) {
            edges.push({
                sourceType: domain.name,
                targetType: baseNorm,
                dependencyKind: 'domain_base_type',
            });
        }
    }

    // Composite types may reference other types
    for (const ct of schema.compositeTypes) {
        for (const attr of ct.attributes) {
            const typeNorm = attr.type.toLowerCase().replace(/\[\]/g, '').replace(/\(.+\)/, '').trim();
            if (userTypes.has(typeNorm)) {
                edges.push({
                    sourceType: ct.name,
                    targetType: typeNorm,
                    dependencyKind: 'composite_attribute',
                });
            }
        }
    }

    return edges;
}
