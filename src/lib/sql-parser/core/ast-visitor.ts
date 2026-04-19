
import { Statement } from 'pgsql-ast-parser';

/**
 * Extract table dependencies from a SELECT statement or similar query.
 * Recursively searches for table references in FROM clauses, JOINs, and subqueries.
 */
export function extractViewDependencies(query: Statement | null | undefined): Set<string> {
    const dependencies = new Set<string>();
    const tempCTEs = new Set<string>(); // Common Table Expressions defined in the query
    const visited = new Set<any>(); // Cycle detection

    if (!query) return dependencies;

    function visit(node: any, depth: number = 0) {
        if (!node || typeof node !== 'object') return;
        if (depth > 100) return; // Safety limit
        if (visited.has(node)) return;
        visited.add(node);

        // Handle CTEs (WITH statement usually wrapper)
        // pgsql-ast-parser produces { type: 'select', with: [...] } OR { type: 'with', bind: [...], in: ... }
        if (node.type === 'with') {
            if (Array.isArray(node.bind)) {
                for (const cte of node.bind) {
                    const alias = cte.alias.name.toLowerCase();
                    tempCTEs.add(alias);
                    visit(cte.statement, depth + 1);
                }
            }
            if (node.in) {
                visit(node.in, depth + 1);
            }
            return; // Don't do generic recursion to avoid double visiting
        }

        // Handle SELECT statements
        if (node.type === 'select') {
            const select = node;

            // Handle CTEs (WITH clause) - add them to tempCTEs so we don't count them as dependencies
            if (select.with) {
                for (const cte of select.with) {
                    tempCTEs.add(cte.alias.name.toLowerCase());
                    visit(cte.statement, depth + 1); // Recurse into CTE definition
                }
            }

            // Handle FROM clause
            if (select.from) {
                for (const from of select.from) {
                    visitTableRef(from, depth + 1);
                }
            }
        }

        // Handle UNION / INTERSECT / EXCEPT
        if (node.type === 'union' || node.type === 'intersect' || node.type === 'except') {
            visit(node.left, depth + 1);
            visit(node.right, depth + 1);
        }

        // Common recursion for other properties
        for (const key in node) {
            // Skip internal properties or known scalars
            if (key === 'loc' || key === '_parent' || typeof node[key] !== 'object') continue;

            const val = node[key];
            if (Array.isArray(val)) {
                val.forEach(v => visit(v, depth + 1));
            } else {
                visit(val, depth + 1);
            }
        }
    }

    function visitTableRef(from: any, depth: number) {
        if (depth > 100) return;

        // Table reference
        if (from.type === 'table') {
            const tableName = from.name.name;
            const schemaName = from.name.schema;

            // Ignore if it's a CTE we've seen
            if (!schemaName && tempCTEs.has(tableName.toLowerCase())) {
                return;
            }

            const fullName = schemaName ? `${schemaName}.${tableName}` : tableName;
            dependencies.add(fullName);
        }

        // Subquery alias
        if (from.type === 'statement') {
            visit(from.statement, depth + 1);
        }

        // Joins - recursively traverse structure
        if (from.join && typeof from.join === 'object') {
            if (from.join.to) {
                visitTableRef(from.join.to, depth + 1);
            }
        }
    }

    visit(query);
    return dependencies;
}
