/**
 * Phase 6: Relationship Builder
 * 
 * Builds entity relationships from parsed schema:
 * - Foreign key relationships
 * - Partition parent-child relationships
 * - View source dependencies
 * - Trigger table associations
 */

import {
    Table,
    View,
    Trigger,
    Policy,
    Relationship,
    RelationshipType,
    Cardinality,
} from '../types/core-types';
import { ParseContext } from '../context/parse-context';

// =============================================================================
// Relationship Building
// =============================================================================

/**
 * Build all relationships from parsed schema
 */
export function buildRelationships(context: ParseContext): Relationship[] {
    const relationships: Relationship[] = [];
    let relId = 0;

    const genId = () => `rel-${relId++}`;

    // Helper to resolve or warn
    const resolveOrWarn = (name: string, schema: string | undefined, type: string, source: string): string => {
        const resolved = resolveTableName(name, schema, context);
        if (resolved) return resolved;

        context.addWarning({
            level: 'WARNING',
            code: 'TABLE_UNKNOWN',
            message: `Could not resolve table/view '${name}' referenced by ${type} '${source}'`,
            affectedObject: source,
            suggestion: 'Ensure the table exists and is fully qualified if necessary.',
        });
        return name; // Fallback to original name
    };

    // Foreign key relationships
    for (const table of context.tables.values()) {
        for (const column of table.columns) {
            if (column.isForeignKey && column.references) {
                const targetTableName = resolveOrWarn(
                    column.references.table,
                    table.schema,
                    'foreign_key',
                    `${table.name}.${column.name}`
                );

                relationships.push({
                    id: genId(),
                    source: {
                        schema: table.schema,
                        table: table.name,
                        column: column.name,
                    },
                    target: {
                        schema: column.references.schema,
                        table: targetTableName,
                        column: column.references.column,
                    },
                    type: 'FOREIGN_KEY',
                    cardinality: inferCardinality(column, table) as any,
                    onDelete: column.references.onDelete as any,
                    onUpdate: column.references.onUpdate as any,
                    confidence: 1.0,
                });
            }
        }
    }

    // Partition relationships
    for (const table of context.tables.values()) {
        if (table.partitionOf) {
            const parentTableName = resolveOrWarn(
                table.partitionOf,
                table.schema,
                'partition_parent',
                table.name
            );

            relationships.push({
                id: genId(),
                source: {
                    schema: table.schema,
                    table: table.name,
                },
                target: {
                    table: parentTableName,
                },
                type: 'PARTITION_CHILD',
                cardinality: 'UNKNOWN',
                confidence: 1.0,
                annotations: table.partitionBounds ? [
                    `Bounds: ${JSON.stringify(table.partitionBounds)}`
                ] : undefined,
            });
        }
    }

    // Trigger relationships (Table Target)
    for (const trigger of context.triggers.values()) {
        const targetTableName = resolveOrWarn(
            trigger.table,
            trigger.schema,
            'trigger',
            trigger.name
        );

        relationships.push({
            id: genId(),
            source: {
                // Triggers don't exist in the context symbol table directly as "schema.name" always?
                // Actually they are just registered by name.
                // Source is the trigger itself (conceptually), but usually we visualize Trigger -> Table.
                // Wait, trigger belongs TO a table. 
                // The relationship is "Trigger -> Table".
                // source.table needs to be the trigger name.
                // BUT core-types says Relationship source has `table` property. 
                // It uses `source.table` to store the *trigger name*. 
                table: trigger.name,
            },
            target: {
                table: targetTableName,
            },
            type: 'TRIGGER_TARGET',
            cardinality: 'UNKNOWN',
            confidence: 0.9,
            annotations: [
                `${trigger.timing} ${trigger.events.join('/')} FOR EACH ${trigger.level}`
            ],
        });

        // Trigger Function Dependency
        if (trigger.functionName) {
            // Need to resolve function
            // We can't use resolveOrWarn because that targets tables/views.
            // We need custom resolution for functions.
            const schemes = trigger.functionSchema ? [trigger.functionSchema] : (trigger.schema ? [trigger.schema, ...context.searchPath] : undefined);
            const funcSymbol = context.resolveSymbol(trigger.functionName, schemes);

            if (funcSymbol && funcSymbol.type === 'function') {
                relationships.push({
                    id: genId(),
                    source: {
                        table: trigger.name, // Trigger Name
                    },
                    target: {
                        table: funcSymbol.fullName, // Function Name (abusing table field)
                    },
                    type: 'TRIGGER_FUNCTION',
                    cardinality: 'UNKNOWN',
                    confidence: 0.9,
                });
            } else {
                // Add warning for missing function?
                // Currently we focus on missing tables.
                // Maybe later.
            }
        }
    }

    // Policy relationships
    for (const policy of context.policies.values()) {
        const targetTableName = resolveOrWarn(
            policy.table,
            policy.schema,
            'policy',
            policy.name
        );

        relationships.push({
            id: genId(),
            source: {
                table: policy.name,
            },
            target: {
                table: targetTableName,
            },
            type: 'POLICY_TARGET',
            cardinality: 'UNKNOWN',
            confidence: 0.9,
            annotations: [
                `FOR ${policy.command}`,
                policy.permissive ? 'PERMISSIVE' : 'RESTRICTIVE',
            ],
        });
    }

    // View dependencies
    for (const view of context.views.values()) {
        const deps = context.dependencies.getDependencies(view.name);
        for (const depName of deps) {
            // Need to resolve depName to schema/table if possible
            // Dependencies in context are usually fully qualified if possible

            // Check if dependency is a table or view
            // resolveTableName handles basic resolution

            // Reconstruct target object
            const resolvedName = resolveTableName(depName, view.schema, context);
            const parts = resolvedName ? resolvedName.split('.') : depName.split('.');
            let targetSchema: string | undefined;
            let targetTable: string;

            if (parts.length > 1) {
                targetSchema = parts[0];
                targetTable = resolvedName || depName;
            } else {
                targetTable = resolvedName || depName;
            }

            relationships.push({
                id: genId(),
                source: {
                    schema: view.schema,
                    table: view.name,
                },
                target: {
                    schema: targetSchema,
                    table: targetTable,
                },
                type: 'VIEW_DEPENDENCY',
                cardinality: 'UNKNOWN',
                confidence: view.verificationLevel === 'DEFINITIVE' ? 1.0 : 0.8,
            });
        }
    }

    return relationships;
}

/**
 * Resolve a table name to its full qualified form.
 * Returns null if table is not found.
 */
function resolveTableName(
    name: string,
    currentSchema: string | undefined,
    context: ParseContext
): string | null {
    // Determine search schemes
    const schemes = currentSchema ? [currentSchema, ...context.searchPath] : undefined;

    // Resolve valid relation symbol (table or view)
    const symbol = context.resolveSymbol(name, schemes);

    if (symbol && (symbol.type === 'table' || symbol.type === 'view')) {
        return symbol.fullName;
    }

    return null;
}

/**
 * Infer cardinality from column properties
 */
function inferCardinality(
    column: any,
    table: Table
): string {
    // If FK column is unique or part of PK, it's likely 1:1
    if (column.isUnique || column.isPrimaryKey) {
        return 'ONE_TO_ONE';
    }

    // If FK column is the only PK, it's likely 1:1
    const pkColumns = table.columns.filter(c => c.isPrimaryKey);
    if (pkColumns.length === 1 && pkColumns[0].name === column.name) {
        return 'ONE_TO_ONE';
    }

    // Default to 1:N (many-to-one)
    return 'MANY_TO_ONE';
}

/**
 * Detect naming convention based FK patterns
 * (for suggesting potential relationships not explicitly defined)
 */
export function inferPotentialRelationships(
    context: ParseContext
): Relationship[] {
    const potential: Relationship[] = [];
    let relId = 1000;

    const tableNames = new Set(
        Array.from(context.tables.keys()).map(n => {
            const parts = n.split('.');
            return parts[parts.length - 1].toLowerCase();
        })
    );

    for (const table of context.tables.values()) {
        for (const column of table.columns) {
            // Skip if already a FK
            if (column.isForeignKey) continue;

            const colName = column.name.toLowerCase();

            // Pattern: *_id where * matches a table name
            if (colName.endsWith('_id')) {
                const potentialTable = colName.slice(0, -3); // Remove _id

                if (tableNames.has(potentialTable) || tableNames.has(potentialTable + 's')) {
                    // Find the actual table
                    let targetTable: string | null = null;

                    for (const t of context.tables.keys()) {
                        const baseName = t.split('.').pop()?.toLowerCase();
                        if (baseName === potentialTable || baseName === potentialTable + 's') {
                            targetTable = t;
                            break;
                        }
                    }

                    if (targetTable) {
                        potential.push({
                            id: `inferred-${relId++}`,
                            source: {
                                schema: table.schema,
                                table: table.name,
                                column: column.name,
                            },
                            target: {
                                table: targetTable,
                                column: 'id',
                            },
                            type: 'INFERRED',
                            cardinality: 'MANY_TO_ONE',
                            confidence: 0.6,
                            annotations: ['Inferred from naming convention'],
                        });
                    }
                }
            }
        }
    }

    return potential;
}
