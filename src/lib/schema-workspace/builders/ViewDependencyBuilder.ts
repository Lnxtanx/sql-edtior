import { ParsedSchema, Relationship, Table } from '../../sql-parser/types/core-types';
import { RelationshipBuilder } from './RelationshipBuilder';

/**
 * Extracts dependencies from Views
 */
export class ViewDependencyBuilder implements RelationshipBuilder {
    build(schema: ParsedSchema): Relationship[] {
        const relationships: Relationship[] = [];

        // Iterate every table in the schema to check for dependencies
        // This ensures we capture dependencies for tables with same names in different schemas
        // e.g. if view references "users", we might link to both "public.users" and "auth.users"
        // This is ambiguous but safer than missing one.
        for (const view of schema.views) {
            if (!view.query) continue;

            const viewSchema = view.schema || 'public';

            for (const table of schema.tables) {
                const tableSchema = table.schema || 'public';
                // Parser might return "schema.table" in table.name. Sanitize it.
                const cleanTableName = table.name.includes('.') ? table.name.split('.').pop()! : table.name;

                // Skip if table name is not in query (fast check)
                if (!view.query.includes(cleanTableName)) continue;

                // 1. Check for fully qualified match "schema.table"
                // e.g. "public.users" or "auth.users"
                const qualifiedRegex = new RegExp(`\\b${tableSchema}\\s*\\.\\s*${cleanTableName}\\b`, 'i');
                const hasQualifiedMatch = qualifiedRegex.test(view.query);

                // 2. Check for unqualified match "table"
                // e.g. "users"
                const nameRegex = new RegExp(`\\b${cleanTableName}\\b`, 'i');
                const hasNameMatch = nameRegex.test(view.query);

                let isMatch = false;
                let confidence = 0.5;

                if (hasQualifiedMatch) {
                    isMatch = true;
                    confidence = 0.9; // High confidence
                } else if (hasNameMatch) {
                    // Heuristic: Unqualified match is valid if:
                    // - Table is in same schema as view
                    // - OR Table is in 'public' (default search path)
                    if (tableSchema === viewSchema || tableSchema === 'public') {
                        isMatch = true;
                        confidence = 0.7;
                    }
                }

                if (isMatch) {
                    relationships.push({
                        id: `rel_view_${viewSchema}_${view.name}_${tableSchema}_${table.name}`,
                        source: {
                            schema: view.schema,
                            table: view.name
                        },
                        target: {
                            schema: table.schema,
                            table: table.name
                        },
                        type: 'VIEW_DEPENDENCY', // The view "sources" from the table
                        cardinality: 'UNKNOWN',
                        sourceType: 'INFERRED_VIEW',
                        confidence,
                        metadata: {
                            isFuzzyMatch: confidence < 0.8,
                            matchMethod: 'regex'
                        }
                    });
                }
            }
        }

        return relationships;
    }
}
