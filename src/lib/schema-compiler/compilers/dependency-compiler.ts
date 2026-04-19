/**
 * Dependency Graph Compiler
 * 
 * Layer 16: Builds a unified dependency graph across all objects,
 * detects cycles (Tarjan's SCC), computes centrality, and analyzes DROP CASCADE chains.
 */

import type { ParsedSchema } from '@/lib/sql-parser';
import type {
    DependencyCompilation, CompilationIssue, DependencyEdge,
    DependencyNode, DependencyCycle, CentralityEntry, AffectedObject,
} from '../types';

type ObjectType = 'table' | 'view' | 'function' | 'trigger' | 'sequence' | 'type' | 'index' | 'policy' | 'extension';

export function compileDependencies(schema: ParsedSchema): { dependencies: DependencyCompilation; issues: CompilationIssue[] } {
    const issues: CompilationIssue[] = [];

    const nodes = new Map<string, DependencyNode>();
    const edges: DependencyEdge[] = [];

    // Helper to register a node
    function addNode(name: string, type: ObjectType, schema_?: string) {
        const key = nodeKey(name, type);
        if (!nodes.has(key)) {
            nodes.set(key, { name, type, schema: schema_, inDegree: 0, outDegree: 0 });
        }
    }

    function addEdge(source: string, sourceType: ObjectType, target: string, targetType: ObjectType, relation: string) {
        const sKey = nodeKey(source, sourceType);
        const tKey = nodeKey(target, targetType);
        addNode(source, sourceType);
        addNode(target, targetType);
        edges.push({ source: sKey, target: tKey, sourceType, targetType, relation });
        nodes.get(sKey)!.outDegree++;
        nodes.get(tKey)!.inDegree++;
    }

    // 1. Tables
    for (const table of schema.tables) {
        addNode(table.name, 'table', table.schema);
    }

    // 2. Foreign key edges (table → table)
    for (const rel of schema.relationships) {
        addEdge(rel.source.table, 'table', rel.target.table, 'table', 'foreign-key');
    }

    // 3. Inheritance edges
    for (const table of schema.tables) {
        if (table.inheritsFrom) {
            for (const parent of table.inheritsFrom) {
                addEdge(table.name, 'table', parent, 'table', 'inherits');
            }
        }
        if (table.partitionOf) {
            addEdge(table.name, 'table', table.partitionOf, 'table', 'partition-of');
        }
    }

    // 4. Views → referenced tables
    for (const view of schema.views) {
        addNode(view.name, 'view', view.schema);
        const referencedTables = (view as any).referencedTables;
        if (referencedTables) {
            for (const ref of referencedTables) {
                const refName = typeof ref === 'string' ? ref : ref;
                // The referenced object could be a table or another view
                const isView = schema.views.some(v => v.name === refName);
                addEdge(view.name, 'view', refName, isView ? 'view' : 'table', 'references');
            }
        }
    }

    // 5. Functions
    for (const func of schema.functions) {
        addNode(func.name, 'function', func.schema);
        // If we can detect table references in function body
        if (func.body) {
            for (const table of schema.tables) {
                if (func.body.includes(table.name)) {
                    addEdge(func.name, 'function', table.name, 'table', 'references-in-body');
                }
            }
        }
    }

    // 6. Triggers → functions and tables
    for (const trigger of schema.triggers) {
        addNode(trigger.name, 'trigger', trigger.schema);
        addEdge(trigger.name, 'trigger', trigger.table, 'table', 'trigger-on');
        if (trigger.functionName) {
            addEdge(trigger.name, 'trigger', trigger.functionName, 'function', 'executes');
        }
    }

    // 7. Sequences → tables
    for (const seq of schema.sequences) {
        addNode(seq.name, 'sequence', seq.schema);
        const ownedByTable = (seq as any).ownedByTable;
        if (ownedByTable) {
            addEdge(seq.name, 'sequence', ownedByTable, 'table', 'owned-by');
        }
    }

    // 8. Policies → tables
    for (const policy of schema.policies) {
        addNode(policy.name, 'policy');
        addEdge(policy.name, 'policy', policy.table, 'table', 'policy-on');
    }

    // 9. Indexes → tables
    for (const idx of schema.indexes) {
        addNode(idx.name, 'index');
        addEdge(idx.name, 'index', idx.table, 'table', 'index-on');
    }

    // --- Cycle detection using Tarjan's SCC ---
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
        if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
        adjacency.get(edge.source)!.push(edge.target);
    }

    const cycles = findCycles(adjacency);
    const dependencyCycles: DependencyCycle[] = cycles.map((cycle, i) => ({
        id: `cycle-${i}`,
        nodes: cycle.map(key => {
            const node = nodes.get(key);
            return { name: node?.name || key, type: node?.type || 'table' as ObjectType };
        }),
        risk: cycle.length > 3 ? 'high' : cycle.length > 2 ? 'medium' : 'low',
    }));

    for (const cycle of dependencyCycles) {
        if (cycle.risk === 'high' || cycle.risk === 'medium') {
            issues.push({
                id: `dep-cycle-${cycle.id}`,
                layer: 'dependency',
                severity: cycle.risk === 'high' ? 'error' : 'warning',
                category: 'dependency-cycle',
                title: 'Dependency cycle detected',
                message: `Circular dependency: ${cycle.nodes.map(n => `${n.type}:${n.name}`).join(' → ')} → ${cycle.nodes[0].type}:${cycle.nodes[0].name}`,
                affectedObjects: cycle.nodes.map(n => ({ type: n.type as AffectedObject['type'], name: n.name })),
                remediation: 'Break the cycle by removing or restructuring one dependency edge.',
                riskScore: cycle.risk === 'high' ? 70 : 45,
            });
        }
    }

    // --- Centrality analysis ---
    const centrality: CentralityEntry[] = [];
    for (const [key, node] of nodes) {
        const total = node.inDegree + node.outDegree;
        if (total >= 3) {
            centrality.push({
                name: node.name,
                type: node.type,
                inDegree: node.inDegree,
                outDegree: node.outDegree,
                totalDegree: total,
            });
        }
    }
    centrality.sort((a, b) => b.totalDegree - a.totalDegree);

    // Highly central objects
    if (centrality.length > 0 && centrality[0].totalDegree >= 10) {
        const top = centrality[0];
        issues.push({
            id: `dep-central-${top.name}`,
            layer: 'dependency',
            severity: 'info',
            category: 'high-centrality',
            title: 'Highly central object',
            message: `${top.type} "${top.name}" has ${top.totalDegree} dependency connections (in: ${top.inDegree}, out: ${top.outDegree}). Changes to this object have wide blast radius.`,
            affectedObjects: [{ type: top.type as AffectedObject['type'], name: top.name }],
            riskScore: 30,
        });
    }

    // --- DROP CASCADE chain analysis ---
    const cascadeChains: { root: string; rootType: ObjectType; affectedCount: number; affected: string[] }[] = [];

    // For tables with high in-degree, compute cascade depth
    for (const [key, node] of nodes) {
        if (node.type === 'table' && node.inDegree >= 3) {
            const affected = computeCascadeAffected(key, adjacency, nodes);
            if (affected.length >= 3) {
                cascadeChains.push({
                    root: node.name,
                    rootType: node.type,
                    affectedCount: affected.length,
                    affected: affected.slice(0, 20),
                });
            }
        }
    }

    cascadeChains.sort((a, b) => b.affectedCount - a.affectedCount);

    if (cascadeChains.length > 0 && cascadeChains[0].affectedCount >= 5) {
        const top = cascadeChains[0];
        issues.push({
            id: `dep-cascade-${top.root}`,
            layer: 'dependency',
            severity: 'warning',
            category: 'cascade-risk',
            title: 'High CASCADE risk',
            message: `DROP CASCADE on "${top.root}" would affect ${top.affectedCount} objects: ${top.affected.slice(0, 5).join(', ')}${top.affectedCount > 5 ? '...' : ''}.`,
            affectedObjects: [{ type: top.rootType as AffectedObject['type'], name: top.root }],
            riskScore: 55,
        });
    }

    return {
        dependencies: {
            nodes: Array.from(nodes.values()),
            edges,
            cycles: dependencyCycles,
            centrality: centrality.slice(0, 20),
            cascadeChains,
            totalNodes: nodes.size,
            totalEdges: edges.length,
        },
        issues,
    };
}

function nodeKey(name: string, type: ObjectType): string {
    return `${type}::${name}`;
}

/**
 * Find all strongly connected components using iterative Tarjan's algorithm
 * Returns only SCCs with size > 1 (actual cycles)
 */
function findCycles(adjacency: Map<string, string[]>): string[][] {
    let index = 0;
    const stack: string[] = [];
    const onStack = new Set<string>();
    const indices = new Map<string, number>();
    const lowlinks = new Map<string, number>();
    const sccs: string[][] = [];

    const allNodes = new Set<string>();
    for (const [source, targets] of adjacency) {
        allNodes.add(source);
        for (const t of targets) allNodes.add(t);
    }

    function strongconnect(v: string) {
        indices.set(v, index);
        lowlinks.set(v, index);
        index++;
        stack.push(v);
        onStack.add(v);

        const neighbors = adjacency.get(v) || [];
        for (const w of neighbors) {
            if (!indices.has(w)) {
                strongconnect(w);
                lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
            } else if (onStack.has(w)) {
                lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
            }
        }

        if (lowlinks.get(v) === indices.get(v)) {
            const scc: string[] = [];
            let w: string;
            do {
                w = stack.pop()!;
                onStack.delete(w);
                scc.push(w);
            } while (w !== v);
            if (scc.length > 1) {
                sccs.push(scc);
            }
        }
    }

    for (const node of allNodes) {
        if (!indices.has(node)) {
            strongconnect(node);
        }
    }

    return sccs;
}

/**
 * Compute all objects that would be affected by DROP CASCADE on a given node
 */
function computeCascadeAffected(
    rootKey: string,
    adjacency: Map<string, string[]>,
    nodes: Map<string, DependencyNode>,
): string[] {
    // Build reverse adjacency (who depends on me)
    const reverseAdj = new Map<string, string[]>();
    for (const [source, targets] of adjacency) {
        for (const t of targets) {
            if (!reverseAdj.has(t)) reverseAdj.set(t, []);
            reverseAdj.get(t)!.push(source);
        }
    }

    // BFS from root through reverse edges
    const visited = new Set<string>();
    const queue = [rootKey];
    visited.add(rootKey);

    while (queue.length > 0) {
        const current = queue.shift()!;
        const dependents = reverseAdj.get(current) || [];
        for (const dep of dependents) {
            if (!visited.has(dep)) {
                visited.add(dep);
                queue.push(dep);
            }
        }
    }

    visited.delete(rootKey);
    return Array.from(visited).map(key => {
        const node = nodes.get(key);
        return node ? `${node.type}:${node.name}` : key;
    });
}
