import { SchemaGraph, TableNode } from '../types';
import { Relationship } from '../../sql-parser/types/core-types';
import { toNodeId } from '../utils';

export interface CascadeRisk {
    level: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    description: string;
    chains?: string[][]; // List of paths (table names) that cause this risk
}

/**
 * Analyze the graph for dangerous cascade deletion chains using DFS
 */
export function analyzeCascadeRisks(graph: SchemaGraph): Map<string, CascadeRisk> {
    const risks = new Map<string, CascadeRisk>();

    // We only care about CASCADE deletions in the OUTBOUND direction (Table -> Children)
    // A -> B (A depends on B). If B deleted, A is deleted?
    // SQL: FOREIGN KEY (a_id) REFERENCES B(id) ON DELETE CASCADE
    // If I delete row from B, row from A is deleted.
    // So edge is A -> B. But propagation is B -> A.
    // Cascade Adjacency: B -> [A, C, D]

    const cascadePropagation = new Map<string, string[]>();

    for (const rel of graph.relationships) {
        if (rel.onDelete?.toUpperCase() === 'CASCADE') {
            // Relation A -> B (A references B).
            // Propagation: If target (B) is deleted, source (A) is deleted.
            const triggerTable = toNodeId(rel.target.schema, rel.target.table);
            const victimTable = toNodeId(rel.source.schema, rel.source.table);

            if (!cascadePropagation.has(triggerTable)) {
                cascadePropagation.set(triggerTable, []);
            }
            cascadePropagation.get(triggerTable)?.push(victimTable);
        }
    }

    // For each table, detect if deleting it causes a massive chain
    for (const node of graph.nodes.values()) {
        if (node.type !== 'TABLE') continue;

        const tableName = node.id;

        const { count, hasCycle, maxDepth } = analyzePropagation(tableName, cascadePropagation);

        if (count > 0 || hasCycle) {
            let level: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
            let description = '';

            if (hasCycle) {
                level = 'HIGH';
                description = 'Participates in a CASCADE cycle (Infinite Loop Risk)';
            } else if (count >= 5 || maxDepth >= 3) {
                level = 'HIGH';
                description = `Deleting this cascades to ${count} tables (Depth ${maxDepth})`;
            } else if (count >= 2) {
                level = 'MEDIUM';
                description = `Deleting this cascades to ${count} tables`;
            } else {
                level = 'LOW';
                description = `Deletes 1 dependent table`;
            }

            if (level !== 'LOW') { // Only register significant risks
                risks.set(tableName, {
                    level,
                    description,
                    chains: []
                });
            }
        }
    }

    return risks;
}

function analyzePropagation(start: string, adj: Map<string, string[]>): { count: number, hasCycle: boolean, maxDepth: number } {
    const visited = new Set<string>();
    const stack: { node: string, depth: number, path: string[] }[] = [{ node: start, depth: 0, path: [start] }];

    let maxDepth = 0;
    let hasCycle = false;
    const allVictims = new Set<string>();

    while (stack.length > 0) {
        const { node, depth, path } = stack.pop()!;

        if (depth > maxDepth) maxDepth = depth;

        const victims = adj.get(node) || [];

        for (const victim of victims) {
            if (path.includes(victim)) {
                hasCycle = true;
                continue;
            }

            if (!allVictims.has(victim)) {
                allVictims.add(victim);
                stack.push({ node: victim, depth: depth + 1, path: [...path, victim] });
            }
        }
    }

    return { count: allVictims.size, hasCycle, maxDepth };
}
