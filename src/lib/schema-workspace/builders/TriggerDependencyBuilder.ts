import { ParsedSchema, Relationship, PostgresFunction } from '../../sql-parser/types/core-types';
import { RelationshipBuilder } from './RelationshipBuilder';

/**
 * Extracts dependencies from Triggers
 * 
 * Logic:
 * 1. Identify the function called by the trigger.
 * 2. Scan the function body for references to other tables.
 * 3. Create a dependency: TriggerTable -> ReferencedTable.
 */
export class TriggerDependencyBuilder implements RelationshipBuilder {
    build(schema: ParsedSchema): Relationship[] {
        const relationships: Relationship[] = [];

        // Map functions for faster lookup
        // Key: schema.name (or just name if schema is missing)
        const functionMap = new Map<string, PostgresFunction>();
        for (const func of schema.functions) {
            const key = func.schema ? `${func.schema}.${func.name}` : func.name;
            functionMap.set(key, func);
            // Also map unqualified name if unique? 
            // For now, simple mapping.
            if (!func.schema || func.schema === 'public') {
                functionMap.set(func.name, func);
            }
        }

        for (const trigger of schema.triggers) {
            if (!trigger.functionName) continue;

            // Find the function
            let func: PostgresFunction | undefined;
            if (trigger.functionSchema) {
                func = functionMap.get(`${trigger.functionSchema}.${trigger.functionName}`);
            } else {
                func = functionMap.get(trigger.functionName);
            }

            if (!func || !func.body) continue;

            const sourceTableId = `${trigger.schema || 'public'}.${trigger.table}`;

            // Scan function body for table references
            for (const table of schema.tables) {
                const tableSchema = table.schema || 'public';
                // Parser might return "schema.table" in table.name. Sanitize it.
                const cleanTableName = table.name.includes('.') ? table.name.split('.').pop()! : table.name;

                // 1. Check for fully qualified match "schema.table"
                const qualifiedRegex = new RegExp(`\\b${tableSchema}\\s*\\.\\s*${cleanTableName}\\b`, 'i');
                const hasQualifiedMatch = qualifiedRegex.test(func.body);

                // 2. Check for unqualified match "table"
                const nameRegex = new RegExp(`\\b${cleanTableName}\\b`, 'i');
                const hasNameMatch = nameRegex.test(func.body);

                let isMatch = false;
                let confidence = 0.5;

                if (hasQualifiedMatch) {
                    isMatch = true;
                    confidence = 0.9;
                } else if (hasNameMatch) {
                    // Heuristic: If unqualified match, is it likely this table?
                    // If table is public, or same schema as function, yes.
                    const funcSchema = func.schema || 'public';
                    const tableSchema = table.schema || 'public';

                    if (tableSchema === 'public' || tableSchema === funcSchema) {
                        isMatch = true;
                        confidence = 0.6;
                    }
                }

                if (isMatch) {
                    const sourceSchema = trigger.schema || 'public';
                    const targetSchema = table.schema || 'public';

                    relationships.push({
                        id: `rel_trig_${trigger.name}_${sourceSchema}.${trigger.table}_to_${targetSchema}.${table.name}`,
                        source: {
                            schema: trigger.schema,
                            table: trigger.table
                        },
                        target: {
                            schema: table.schema,
                            table: table.name
                        },
                        type: 'TRIGGER_TARGET',
                        sourceType: 'INFERRED_TRIGGER',
                        cardinality: 'UNKNOWN',
                        confidence,
                        metadata: {
                            isFuzzyMatch: confidence < 0.8,
                            matchMethod: hasQualifiedMatch ? 'regex' : 'regex'
                        },
                        annotations: [`Trigger: ${trigger.name}`, `Function: ${func.name}`]
                    });
                }
            }
        }

        return relationships;
    }
}
