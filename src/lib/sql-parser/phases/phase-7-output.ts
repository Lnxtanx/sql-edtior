/**
 * Phase 7: Output Builder
 * 
 * Builds the final ParsedSchema from context,
 * calculating statistics and organizing output.
 */

import {
    ParsedSchema,
    PostgresStats,
    DataTypeCategory,
    ParserError,
} from '../types/core-types';
import { ParseContext } from '../context/parse-context';
import { buildRelationships, inferPotentialRelationships } from './phase-6-relate';

/**
 * Build the final ParsedSchema output
 */
export function buildOutput(context: ParseContext, startTime: number): ParsedSchema {
    const relationships = buildRelationships(context);

    // Calculate statistics
    const stats = calculateStats(context);

    // Build the output
    const schema: ParsedSchema = {
        tables: Array.from(context.tables.values()),
        relationships,
        enums: buildEnumsMap(context),
        enumTypes: Array.from(context.enums.values()),
        views: Array.from(context.views.values()),
        triggers: Array.from(context.triggers.values()),
        indexes: Array.from(context.indexes.values()),
        sequences: Array.from(context.sequences.values()),
        functions: Array.from(context.functions.values()),
        policies: Array.from(context.policies.values()),
        extensions: Array.from(context.extensions.values()),
        schemas: Array.from(context.schemas),
        domains: Array.from(context.domains.values()),
        compositeTypes: Array.from(context.compositeTypes.values()),
        roles: Array.from(context.roles.values()),
        stats,
        errors: context.errors.filter(e => e.level === 'ERROR'),
        warnings: context.warnings.concat(
            context.errors.filter(e => e.level === 'WARNING')
        ),
        parseTime: Date.now() - startTime,
        confidence: calculateConfidence(context),
    };

    // Add inferred relationships if enabled
    if (!context.options.strict) {
        const inferred = inferPotentialRelationships(context);
        schema.relationships.push(...inferred);
    }

    return schema;
}

/**
 * Build enums map for backward compatibility
 */
function buildEnumsMap(context: ParseContext): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const enumType of context.enums.values()) {
        map.set(enumType.name, enumType.values);
    }
    return map;
}

/**
 * Calculate schema statistics
 */
function calculateStats(context: ParseContext): PostgresStats {
    const dataTypes = new Map<DataTypeCategory, number>();
    let primaryKeys = 0;
    let foreignKeys = 0;
    let uniqueConstraints = 0;
    let checkConstraints = 0;
    let notNullConstraints = 0;
    let generatedColumns = 0;
    let defaultValues = 0;
    let partitionedTables = 0;
    let childPartitions = 0;
    let temporaryTables = 0;
    let inheritedTables = 0;
    const indexTypes = new Map<string, number>();

    // Process tables
    for (const table of context.tables.values()) {
        if (table.isPartitioned) partitionedTables++;
        if (table.partitionOf) childPartitions++;
        if (table.isTemporary) temporaryTables++;
        if (table.inheritsFrom) inheritedTables++;

        checkConstraints += table.checkConstraints.length;
        uniqueConstraints += table.uniqueConstraints.length;

        // Process columns
        for (const column of table.columns) {
            // Data type stats
            const category = column.typeCategory;
            dataTypes.set(category, (dataTypes.get(category) || 0) + 1);

            if (column.isPrimaryKey) primaryKeys++;
            if (column.isForeignKey) foreignKeys++;
            if (column.isUnique) uniqueConstraints++;
            if (column.checkConstraint) checkConstraints++;
            if (!column.nullable) notNullConstraints++;
            if (column.isGenerated) generatedColumns++;
            if (column.defaultValue) defaultValues++;
        }
    }

    // Process indexes
    for (const index of context.indexes.values()) {
        const type = index.type || 'btree';
        indexTypes.set(type, (indexTypes.get(type) || 0) + 1);
        if (index.isUnique) uniqueConstraints++;
    }

    return {
        dataTypes,
        primaryKeys,
        foreignKeys,
        uniqueConstraints,
        checkConstraints,
        notNullConstraints,
        indexTypes,
        generatedColumns,
        defaultValues,
        partitionedTables,
        childPartitions,
        temporaryTables,
        inheritedTables,
        rlsPolicies: context.policies.size,
    };
}

/**
 * Calculate overall parse confidence
 */
function calculateConfidence(context: ParseContext): number {
    const tables = Array.from(context.tables.values());
    if (tables.length === 0) return 0;

    const totalConfidence = tables.reduce((sum, t) => sum + t.confidence, 0);
    const avgConfidence = totalConfidence / tables.length;

    // Penalize for errors
    const errorPenalty = Math.min(context.errors.length * 0.05, 0.3);

    return Math.max(0, avgConfidence - errorPenalty);
}
