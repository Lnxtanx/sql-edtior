/**
 * Graph Adjacency Utilities
 * 
 * Utilities for building and traversing the schema graph adjacency structure.
 * optimized for Correctness (Edge Identity) and Scale (MinHeap, O(1) Queue).
 */

import { Relationship } from '../../sql-parser/types/core-types';
import { toNodeId } from '../utils';

// --- Types ---

export interface PathResult {
    path: string[];          // Sequence of table names
    edges: Relationship[];   // Sequence of specific edges taken
    totalWeight: number;     // Total cost (hops or weight)
}

export interface WeightedEdge {
    target: string;
    weight: number;
    relationship: Relationship;
}

// --- MinHeap Implementation for Dijkstra ---

class MinHeap<T> {
    private heap: T[] = [];
    private compare: (a: T, b: T) => number;

    constructor(compare: (a: T, b: T) => number) {
        this.compare = compare;
    }

    push(item: T) {
        this.heap.push(item);
        this.bubbleUp(this.heap.length - 1);
    }

    pop(): T | undefined {
        if (this.heap.length === 0) return undefined;
        const root = this.heap[0];
        const last = this.heap.pop();
        if (this.heap.length > 0 && last !== undefined) {
            this.heap[0] = last;
            this.sinkDown(0);
        }
        return root;
    }

    get length() {
        return this.heap.length;
    }

    private bubbleUp(index: number) {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.compare(this.heap[index], this.heap[parentIndex]) < 0) {
                [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
                index = parentIndex;
            } else {
                break;
            }
        }
    }

    private sinkDown(index: number) {
        const length = this.heap.length;
        while (true) {
            const leftChild = 2 * index + 1;
            const rightChild = 2 * index + 2;
            let swap = null;

            if (leftChild < length) {
                if (this.compare(this.heap[leftChild], this.heap[index]) < 0) {
                    swap = leftChild;
                }
            }

            if (rightChild < length) {
                if (
                    (swap === null && this.compare(this.heap[rightChild], this.heap[index]) < 0) ||
                    (swap !== null && this.compare(this.heap[rightChild], this.heap[leftChild]) < 0)
                ) {
                    swap = rightChild;
                }
            }

            if (swap === null) break;

            [this.heap[index], this.heap[swap]] = [this.heap[swap], this.heap[index]];
            index = swap;
        }
    }
}

// --- Adjacency Building ---

/**
 * Build adjacency lists from relationships
 */
export function buildAdjacencyLists(relationships: Relationship[]): {
    adjacency: Map<string, Relationship[]>;
    outboundAdjacency: Map<string, Relationship[]>;
    inboundAdjacency: Map<string, Relationship[]>;
} {
    const adjacency = new Map<string, Relationship[]>();
    const outboundAdjacency = new Map<string, Relationship[]>();
    const inboundAdjacency = new Map<string, Relationship[]>();

    for (const rel of relationships) {
        if (!rel || !rel.source || !rel.target) {
            console.warn("Invalid relationship skipped in adjacency build:", rel);
            continue;
        }
        const sourceId = toNodeId(rel.source.schema, rel.source.table);
        const targetId = toNodeId(rel.target.schema, rel.target.table);

        // Skip self-references for adjacency maps? 
        // Ideally yes, but maybe useful for self-loops. 
        // Existing code skipped checks (sourceName === targetName).
        if (sourceId === targetId) continue;

        // Bidirectional adjacency
        if (!adjacency.has(sourceId)) adjacency.set(sourceId, []);
        if (!adjacency.has(targetId)) adjacency.set(targetId, []);
        adjacency.get(sourceId)!.push(rel);
        adjacency.get(targetId)!.push(rel);

        // Outbound: source → target
        if (!outboundAdjacency.has(sourceId)) outboundAdjacency.set(sourceId, []);
        outboundAdjacency.get(sourceId)!.push(rel);

        // Inbound: target ← source
        if (!inboundAdjacency.has(targetId)) inboundAdjacency.set(targetId, []);
        inboundAdjacency.get(targetId)!.push(rel);
    }

    return { adjacency, outboundAdjacency, inboundAdjacency };
}

/**
 * Calculate deterministic weight for an edge
 */
export function calculateEdgeWeight(rel: Relationship): number {
    // 1. Explicit Foreign Keys are the strongest links (Cost 1.0)
    // 2. Inferred relationships (by name match, regex views) are weaker (Cost 2.0)

    // Check if it's inferred based on type or sourceType
    if (
        rel.type === 'INFERRED' ||
        rel.sourceType === 'PARSER_MATCH' ||
        rel.sourceType === 'INFERRED_VIEW' ||
        rel.sourceType === 'INFERRED_TRIGGER'
    ) {
        return 2.0;
    }
    return 1.0;
}

/**
 * Build weighted adjacency list storing explicit Edge Identity
 * Optimized: Sorts neighbors by weight ASC for stable BFS tie-breaking.
 */
export function buildWeightedAdjacencyLists(relationships: Relationship[]): Map<string, WeightedEdge[]> {
    const adjacency = new Map<string, WeightedEdge[]>();

    for (const rel of relationships) {
        if (!rel || !rel.source || !rel.target) {
            continue;
        }
        const source = toNodeId(rel.source.schema, rel.source.table);
        const target = toNodeId(rel.target.schema, rel.target.table);

        if (source === target) continue;
        const weight = calculateEdgeWeight(rel);

        if (!adjacency.has(source)) adjacency.set(source, []);
        if (!adjacency.has(target)) adjacency.set(target, []);

        // Bidirectional for undirected pathfinding
        // Store the ACTUAL relationship object to preserve identity
        adjacency.get(source)!.push({ target, weight, relationship: rel });

        // For bidirectional, we use the same relationship object. 
        // The traversal logic will handle directionality display.
        adjacency.get(target)!.push({ target: source, weight, relationship: rel });
    }

    // Sort adjacency lists by weight (ASC)
    // This effectively makes BFS prefer "stronger" edges when hop counts are equal
    for (const neighbors of adjacency.values()) {
        neighbors.sort((a, b) => a.weight - b.weight);
    }

    return adjacency;
}

// --- Traversals & Pathfinding ---

/**
 * Get all nodes connected to a given node within a certain depth
 */
export function getConnectedTables(
    startNodeId: string,
    adjacency: Map<string, Relationship[]>,
    maxDepth: number = 2
): Map<string, number> {
    const distances = new Map<string, number>();
    distances.set(startNodeId, 0);

    const queue: Array<{ id: string; depth: number }> = [
        { id: startNodeId, depth: 0 }
    ];
    let head = 0; // Optimization: index pointer instead of shift()

    while (head < queue.length) {
        const { id, depth } = queue[head++];

        if (depth >= maxDepth) continue;

        const edges = adjacency.get(id);
        if (!edges) continue;

        for (const rel of edges) {
            // Determine neighbor (other side of the edge)
            const sourceId = toNodeId(rel.source.schema, rel.source.table);
            const targetId = toNodeId(rel.target.schema, rel.target.table);
            const neighborId = sourceId === id ? targetId : sourceId;

            if (!distances.has(neighborId)) {
                distances.set(neighborId, depth + 1);
                queue.push({ id: neighborId, depth: depth + 1 });
            }
        }
    }

    return distances;
}

/**
 * Get nodes reachable in a specific direction with optional edge filtering
 */
export function getDirectedConnections(
    startNodeId: string,
    adjacency: Map<string, Relationship[]>,
    direction: 'outbound' | 'inbound' | 'both',
    outboundAdjacency: Map<string, Relationship[]>,
    inboundAdjacency: Map<string, Relationship[]>,
    maxDepth: number = 2,
    edgeFilter?: (rel: Relationship) => boolean
): Map<string, number> {
    const distances = new Map<string, number>();
    distances.set(startNodeId, 0);

    // Determines which adjacency map to use for a step
    // Note: If 'both', we use the combined 'adjacency' map
    const useCombined = direction === 'both';
    const directedAdj = direction === 'outbound' ? outboundAdjacency : inboundAdjacency;

    const queue: Array<{ id: string; depth: number }> = [
        { id: startNodeId, depth: 0 }
    ];
    let head = 0;

    while (head < queue.length) {
        const { id, depth } = queue[head++];

        if (depth >= maxDepth) continue;

        const edges = useCombined ? adjacency.get(id) : directedAdj.get(id);
        if (!edges) continue;

        for (const rel of edges) {
            // Apply Filter!
            if (edgeFilter && !edgeFilter(rel)) continue;

            // Determine neighbor
            const sourceId = toNodeId(rel.source.schema, rel.source.table);
            const targetId = toNodeId(rel.target.schema, rel.target.table);

            // Should be the 'other' side
            let neighborId: string;

            if (useCombined) {
                neighborId = sourceId === id ? targetId : sourceId;
            } else if (direction === 'outbound') {
                // We are at source, going to target
                neighborId = targetId;
            } else {
                // inbound: We are at target, coming from source
                neighborId = sourceId;
            }

            if (!distances.has(neighborId)) {
                distances.set(neighborId, depth + 1);
                queue.push({ id: neighborId, depth: depth + 1 });
            }
        }
    }

    return distances;
}

/**
 * Find all paths between two tables (DFS) - Be careful with large depths
 */
export function findPaths(
    startTable: string,
    endTable: string,
    adjacency: Map<string, Set<string>>,
    maxDepth: number = 5
): string[][] {
    const paths: string[][] = [];

    function dfs(current: string, target: string, path: string[], visited: Set<string>) {
        if (path.length > maxDepth) return;

        if (current === target) {
            paths.push([...path]);
            return;
        }

        const neighbors = adjacency.get(current);
        if (!neighbors) return;

        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                path.push(neighbor);
                dfs(neighbor, target, path, visited);
                path.pop();
                visited.delete(neighbor);
            }
        }
    }

    const visited = new Set<string>([startTable]);
    dfs(startTable, endTable, [startTable], visited);

    return paths;
}

/**
 * Detect cycles in the relationship graph
 */
export function detectCycles(adjacency: Map<string, Set<string>>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    function dfs(node: string): void {
        visited.add(node);
        recursionStack.add(node);
        path.push(node);

        const neighbors = adjacency.get(node);
        if (neighbors) {
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    dfs(neighbor);
                } else if (recursionStack.has(neighbor)) {
                    // Found a cycle
                    const cycleStart = path.indexOf(neighbor);
                    if (cycleStart !== -1) {
                        cycles.push([...path.slice(cycleStart), neighbor]);
                    }
                }
            }
        }

        path.pop();
        recursionStack.delete(node);
    }

    for (const node of adjacency.keys()) {
        if (!visited.has(node)) {
            dfs(node);
        }
    }

    return cycles;
}

/**
 * Calculate the degree (number of connections) for each table
 */
export function calculateDegrees(
    tables: string[],
    adjacency: Map<string, Set<string>>
): Map<string, { in: number; out: number; total: number }> {
    const degrees = new Map<string, { in: number; out: number; total: number }>();

    for (const table of tables) {
        const connections = adjacency.get(table);
        const total = connections ? connections.size : 0;

        degrees.set(table, {
            in: 0, // Will be computed from directed adjacency
            out: 0,
            total,
        });
    }

    return degrees;
}

// --- OPTIMIZED PATHFINDING ---

function reconstructPath(
    endTable: string,
    startTable: string,
    cameFrom: Map<string, { parent: string, edge: Relationship }>
): { nodes: string[], edges: Relationship[] } {
    const nodes: string[] = [endTable];
    const edges: Relationship[] = [];
    let current = endTable;

    while (current !== startTable) {
        const entry = cameFrom.get(current);
        if (!entry) break; // Should not happen if path exists

        edges.unshift(entry.edge); // Prepend edge
        current = entry.parent;
        nodes.unshift(current); // Prepend node
    }

    return { nodes, edges };
}

/**
 * Get the shortest path between two tables using BFS (Unweighted by definition, but tie-broken by weight)
 * Optimized: Uses index-based queue and reconstruction map. Accepts cached WeightedAdjacency.
 */
export function getShortestPath(
    startTable: string,
    endTable: string,
    // Accepts cached adjacency map to avoid O(E) rebuilds
    adjacency: Map<string, WeightedEdge[]>
): PathResult | null {
    if (startTable === endTable) return { path: [startTable], edges: [], totalWeight: 0 };

    const visited = new Set<string>([startTable]);
    const queue: string[] = [startTable];
    const cameFrom = new Map<string, { parent: string, edge: Relationship }>();

    let head = 0;

    while (head < queue.length) {
        const current = queue[head++];

        if (current === endTable) {
            const { nodes, edges } = reconstructPath(endTable, startTable, cameFrom);
            return { path: nodes, edges, totalWeight: edges.length };
        }

        const neighbors = adjacency.get(current);
        if (!neighbors) continue;

        // Note: neighbors are pre-sorted by weight in buildWeightedAdjacencyLists.
        // This ensures stable tie-breaking: low-weight edges are visited first in BFS level traversal.
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor.target)) {
                visited.add(neighbor.target);
                cameFrom.set(neighbor.target, { parent: current, edge: neighbor.relationship });
                queue.push(neighbor.target);

                // Optimization: Check if target is endTable here to return early
                if (neighbor.target === endTable) {
                    const { nodes, edges } = reconstructPath(endTable, startTable, cameFrom);
                    return { path: nodes, edges, totalWeight: edges.length };
                }
            }
        }
    }

    return null;
}


/**
 * Dijkstra's Algorithm for Weighted Shortest Path
 * Optimized: Uses MinHeap and reconstruction map. Accepts cached WeightedAdjacency.
 */
export function getWeightedShortestPath(
    startTable: string,
    endTable: string,
    // Accepts cached adjacency map
    adjacency: Map<string, WeightedEdge[]>
): PathResult | null {
    // Edge case: Start and End are likely non-null, but check for safety
    if (!startTable || !endTable) return null;

    // Fix: Handle Start === End case
    if (startTable === endTable) return { path: [startTable], edges: [], totalWeight: 0 };

    // MinHeap item: { node, cost }
    const pq = new MinHeap<{ node: string; cost: number }>((a, b) => a.cost - b.cost);
    pq.push({ node: startTable, cost: 0 });

    const visited = new Map<string, number>(); // Node -> Cost
    const cameFrom = new Map<string, { parent: string, edge: Relationship }>();

    // Initialize start cost
    visited.set(startTable, 0);

    while (pq.length > 0) {
        const { node, cost } = pq.pop()!;

        if (node === endTable) {
            const { nodes, edges } = reconstructPath(endTable, startTable, cameFrom);
            return { path: nodes, edges, totalWeight: cost };
        }

        // Lazy deletion check: if we found a shorter path to this node already, skip
        if (cost > (visited.get(node) ?? Infinity)) {
            continue;
        }

        const neighbors = adjacency.get(node);
        if (!neighbors) continue;

        for (const neighbor of neighbors) {
            const newCost = cost + neighbor.weight;
            const currentBestCost = visited.get(neighbor.target) ?? Infinity;

            if (newCost < currentBestCost) {
                visited.set(neighbor.target, newCost);
                cameFrom.set(neighbor.target, { parent: node, edge: neighbor.relationship });
                pq.push({ node: neighbor.target, cost: newCost });
            }
        }
    }

    return null;
}
