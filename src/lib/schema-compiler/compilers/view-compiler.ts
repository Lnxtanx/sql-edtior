/**
 * View Compiler
 * 
 * Layer 9: Compiles views and materialized views with dependency analysis,
 * broken reference detection, circular view dependencies, volatile function deps,
 * and unindexed materialized view detection.
 */

import type { ParsedSchema, View, Relationship } from '@/lib/sql-parser';
import type {
    ViewCompilation, CompilationIssue, ViewEntry, MaterializedViewEntry,
    BrokenReference, VolatileFunctionDep,
} from '../types';

export function compileViews(schema: ParsedSchema): { views: ViewCompilation; issues: CompilationIssue[] } {
    const issues: CompilationIssue[] = [];

    // Build table name set for reference validation
    const tableNames = new Set(schema.tables.map(t => t.name.toLowerCase()));
    const viewNames = new Set(schema.views.map(v => v.name.toLowerCase()));
    const allObjectNames = new Set([...tableNames, ...viewNames]);

    // Build view dependency map from relationships
    const viewDeps = new Map<string, string[]>();
    const viewReferencedBy = new Map<string, string[]>();

    for (const rel of schema.relationships) {
        if (rel.type === 'VIEW_DEPENDENCY') {
            const source = rel.source.table;
            const target = rel.target.table;
            if (!viewDeps.has(source)) viewDeps.set(source, []);
            viewDeps.get(source)!.push(target);
            if (!viewReferencedBy.has(target)) viewReferencedBy.set(target, []);
            viewReferencedBy.get(target)!.push(source);
        }
    }

    // Build function lookup for volatile detection
    const functionVolatility = new Map<string, string>();
    for (const fn of schema.functions) {
        functionVolatility.set(fn.name.toLowerCase(), fn.volatility || 'VOLATILE');
    }

    // Compute view depths (distance from base tables)
    const viewDepthMap = computeViewDepths(viewDeps, tableNames, viewNames);

    // Build index lookup for views — if a view has indexes, it MUST be materialized
    // (regular views cannot have indexes in PostgreSQL)
    const viewsWithIndexes = new Set<string>();
    for (const idx of schema.indexes) {
        if (viewNames.has(idx.table.toLowerCase())) {
            viewsWithIndexes.add(idx.table.toLowerCase());
        }
    }

    // Compile regular views and materialized views
    const views: ViewEntry[] = [];
    const materializedViews: MaterializedViewEntry[] = [];

    for (const view of schema.views) {
        const deps = viewDeps.get(view.name) || [];
        const refs = viewReferencedBy.get(view.name) || [];
        const depth = viewDepthMap.get(view.name.toLowerCase()) || 0;

        // Determine if materialized: use parser flag, or infer from having indexes
        const isMaterialized = view.isMaterialized || viewsWithIndexes.has(view.name.toLowerCase());

        const entry: ViewEntry = {
            name: view.name,
            schema: view.schema,
            isMaterialized,
            isRecursive: view.isRecursive,
            securityBarrier: false,
            checkOption: undefined,
            dependsOn: deps,
            referencedBy: refs,
            depth,
            columns: view.columns,
            query: view.query,
        };

        if (isMaterialized) {
            const hasIndexes = schema.indexes.some(i => i.table === view.name);
            materializedViews.push({
                ...entry,
                isPopulated: true, // can't determine from SQL alone
                hasIndexes,
                refreshMethod: undefined,
                storageParameters: undefined,
            });

            if (!hasIndexes) {
                issues.push({
                    id: `view-matview-no-index-${view.name}`,
                    layer: 'view',
                    severity: 'warning',
                    category: 'unindexed-matview',
                    title: 'Unindexed materialized view',
                    message: `Materialized view "${view.name}" has no indexes. Query performance will be degraded.`,
                    affectedObjects: [{ type: 'view', name: view.name }],
                    remediation: 'Add indexes on frequently queried columns of the materialized view.',
                    riskScore: 40,
                });
            }
        } else {
            views.push(entry);
        }
    }

    // Broken references
    const brokenReferences: BrokenReference[] = [];
    for (const view of schema.views) {
        const deps = viewDeps.get(view.name) || [];
        for (const dep of deps) {
            if (!allObjectNames.has(dep.toLowerCase())) {
                brokenReferences.push({
                    view: view.name,
                    missingObject: dep,
                    objectType: 'table_or_view',
                });
                issues.push({
                    id: `view-broken-ref-${view.name}-${dep}`,
                    layer: 'view',
                    severity: 'error',
                    category: 'broken-reference',
                    title: 'Broken view reference',
                    message: `View "${view.name}" references "${dep}" which does not exist in the schema.`,
                    affectedObjects: [{ type: 'view', name: view.name }],
                    riskScore: 70,
                });
            }
        }
    }

    // Circular view dependencies
    const circularViewDeps = detectCircularViewDeps(viewDeps);
    for (const cycle of circularViewDeps) {
        issues.push({
            id: `view-circular-${cycle.join('-')}`,
            layer: 'view',
            severity: 'warning',
            category: 'circular-view-dep',
            title: 'Circular view dependency',
            message: `Circular dependency: ${cycle.join(' → ')} → ${cycle[0]}`,
            affectedObjects: cycle.map(v => ({ type: 'view' as const, name: v })),
            remediation: 'Break the circular dependency or mark views as recursive if intentional.',
            riskScore: 50,
        });
    }

    // Volatile function dependencies
    const volatileFunctionDeps: VolatileFunctionDep[] = [];
    for (const view of schema.views) {
        if (view.query) {
            for (const [funcName, volatility] of functionVolatility) {
                if (volatility === 'VOLATILE' && view.query.toLowerCase().includes(funcName)) {
                    volatileFunctionDeps.push({
                        view: view.name,
                        function: funcName,
                        risk: `View "${view.name}" depends on volatile function "${funcName}". Results may vary between evaluations.`,
                    });
                }
            }
        }
    }
    if (volatileFunctionDeps.length > 0) {
        for (const dep of volatileFunctionDeps) {
            issues.push({
                id: `view-volatile-func-${dep.view}-${dep.function}`,
                layer: 'view',
                severity: 'suggestion',
                category: 'volatile-function-dep',
                title: 'Volatile function in view',
                message: dep.risk,
                affectedObjects: [
                    { type: 'view', name: dep.view },
                    { type: 'function' as any, name: dep.function },
                ],
                riskScore: 25,
            });
        }
    }

    // Unindexed materialized views
    const unindexedMaterializedViews = materializedViews
        .filter(mv => !mv.hasIndexes)
        .map(mv => mv.name);

    // Deep view chains
    for (const [viewName, depth] of viewDepthMap) {
        if (depth > 3) {
            issues.push({
                id: `view-deep-chain-${viewName}`,
                layer: 'view',
                severity: 'suggestion',
                category: 'deep-view-chain',
                title: 'Deep view dependency chain',
                message: `View "${viewName}" is at depth ${depth} in the dependency chain. Deep chains impact query planning.`,
                affectedObjects: [{ type: 'view', name: viewName }],
                remediation: 'Consider materializing intermediate views or flattening the dependency chain.',
                riskScore: 20,
            });
        }
    }

    return {
        views: {
            views,
            materializedViews,
            brokenReferences,
            circularViewDeps,
            volatileFunctionDeps,
            unindexedMaterializedViews,
            viewDepthMap,
        },
        issues,
    };
}

function computeViewDepths(
    viewDeps: Map<string, string[]>,
    tableNames: Set<string>,
    viewNames: Set<string>,
): Map<string, number> {
    const depths = new Map<string, number>();

    // Base tables are depth 0
    for (const t of tableNames) depths.set(t, 0);

    // BFS from base tables
    let changed = true;
    let iterations = 0;
    const maxIterations = 100;

    while (changed && iterations < maxIterations) {
        changed = false;
        iterations++;

        for (const viewName of viewNames) {
            const deps = viewDeps.get(viewName) || [];
            if (deps.length === 0) {
                if (!depths.has(viewName.toLowerCase())) {
                    depths.set(viewName.toLowerCase(), 0);
                    changed = true;
                }
                continue;
            }

            let maxDepth = -1;
            let allResolved = true;
            for (const dep of deps) {
                const depDepth = depths.get(dep.toLowerCase());
                if (depDepth !== undefined) {
                    maxDepth = Math.max(maxDepth, depDepth);
                } else {
                    allResolved = false;
                }
            }

            if (allResolved && maxDepth >= 0) {
                const newDepth = maxDepth + 1;
                if (!depths.has(viewName.toLowerCase()) || depths.get(viewName.toLowerCase())! < newDepth) {
                    depths.set(viewName.toLowerCase(), newDepth);
                    changed = true;
                }
            }
        }
    }

    return depths;
}

function detectCircularViewDeps(viewDeps: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    function dfs(node: string): void {
        visited.add(node);
        recStack.add(node);
        path.push(node);

        for (const neighbor of (viewDeps.get(node) || [])) {
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

    for (const node of viewDeps.keys()) {
        if (!visited.has(node)) dfs(node);
    }

    return cycles;
}
