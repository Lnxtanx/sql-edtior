import {
    Table,
    Relationship,
    RelationshipType,
} from '../../sql-parser/types/core-types';

import {
    SchemaGraph,
    SchemaNode,
    SchemaSubgraph,
    SubgraphOptions,
    DEFAULT_SUBGRAPH_OPTIONS,
} from '../types';

import { getDirectedConnections } from './adjacency';
import { toNodeId } from '../utils';

/**
 * Extract a subgraph focused on specific tables
 */
export function extractSubgraph(
    graph: SchemaGraph,
    focusTables: string[],
    options: SubgraphOptions = {}
): SchemaSubgraph {
    const opts: Required<SubgraphOptions> = {
        ...DEFAULT_SUBGRAPH_OPTIONS,
        ...options,
    };

    // Validate focus tables exist
    const validFocusTables = focusTables.filter(t => graph.nodes.has(t));
    if (validFocusTables.length === 0) {
        return createEmptySubgraph(focusTables, opts);
    }

    // Calculate distances from all focus tables
    const allDistances = new Map<string, number>();

    // Define edge filter for traversal
    const edgeFilter = (rel: Relationship): boolean => {
        if (opts.minConfidence > 0 && rel.confidence < opts.minConfidence) return false;
        return true;
    };

    for (const focusTableId of validFocusTables) {
        const distances = getDirectedConnections(
            focusTableId,
            graph.adjacency,
            opts.direction,
            graph.outboundAdjacency,
            graph.inboundAdjacency,
            opts.maxDepth,
            edgeFilter
        );

        for (const [tableId, distance] of distances) {
            const existing = allDistances.get(tableId);
            if (existing === undefined || distance < existing) {
                allDistances.set(tableId, distance);
            }
        }
    }

    // Filter relationships matching the same criteria
    const filteredRelationships = graph.relationships.filter(edgeFilter);

    // Collect nodes in the subgraph
    const subgraphTables: Table[] = [];
    const subgraphNodes: SchemaNode[] = [];
    const depthCounts = new Map<number, number>();

    for (const [tableId, distance] of allDistances) {
        const node = graph.nodes.get(tableId);
        if (!node) continue;

        // Create a node with distance information
        const subgraphNode = {
            ...node,
            distance,
            isFocused: validFocusTables.includes(tableId),
        };

        subgraphNodes.push(subgraphNode);

        if (node.type === 'TABLE') {
            subgraphTables.push(node.table);
        }

        // Track depth counts
        depthCounts.set(distance, (depthCounts.get(distance) || 0) + 1);
    }

    // Collect relationships between tables in the subgraph
    const tableSet = new Set(allDistances.keys());
    const subgraphRelationships = filteredRelationships.filter(rel => {
        const sourceId = toNodeId(rel.source.schema, rel.source.table);
        const targetId = toNodeId(rel.target.schema, rel.target.table);
        return tableSet.has(sourceId) && tableSet.has(targetId);
    });

    // Check if we hit the max depth (truncated)
    const maxDistanceFound = Math.max(...Array.from(allDistances.values()));
    const wasTruncated = maxDistanceFound >= opts.maxDepth;

    return {
        tables: subgraphTables,
        nodes: subgraphNodes,
        relationships: subgraphRelationships,
        focus: validFocusTables,
        options: opts,
        stats: {
            tableCount: subgraphTables.length,
            depthCounts,
            wasTruncated,
        },
    };
}

/**
 * Create an empty subgraph result
 */
function createEmptySubgraph(
    focus: string[],
    options: Required<SubgraphOptions>
): SchemaSubgraph {
    return {
        tables: [],
        nodes: [],
        relationships: [],
        focus,
        options,
        stats: {
            tableCount: 0,
            depthCounts: new Map(),
            wasTruncated: false,
        },
    };
}

/**
 * Extract a subgraph for a single table (convenience function)
 */
export function extractTableSubgraph(
    graph: SchemaGraph,
    tableName: string, // Expects qualified ID
    options: SubgraphOptions = {}
): SchemaSubgraph {
    return extractSubgraph(graph, [tableName], options);
}

/**
 * Extract only directly connected tables (depth 1)
 */
export function extractDirectConnections(
    graph: SchemaGraph,
    tableName: string
): SchemaSubgraph {
    return extractSubgraph(graph, [tableName], { maxDepth: 1 });
}

/**
 * Extract the smallest subgraph that includes multiple tables
 * (finds the connection path between them)
 */
export function extractConnectingSubgraph(
    graph: SchemaGraph,
    tableNames: string[]
): SchemaSubgraph {
    // If only one or zero tables, return simple subgraph
    if (tableNames.length <= 1) {
        return extractSubgraph(graph, tableNames, { maxDepth: 2 });
    }

    // Find the maximum depth needed to connect all tables
    // Start with depth 1, increase until all tables are connected
    for (let depth = 1; depth <= 5; depth++) {
        const subgraph = extractSubgraph(graph, tableNames, { maxDepth: depth });

        // Check if all requested tables are in the subgraph
        // NOTE: subgraph.tables contains Table objects.
        // We need to match by qualified ID.
        const subgraphTableIds = new Set(subgraph.tables.map(t => toNodeId(t.schema, t.name)));
        const allIncluded = tableNames.every(t => subgraphTableIds.has(t));

        if (allIncluded) {
            return subgraph;
        }
    }

    // If we couldn't connect them all, return max depth subgraph
    return extractSubgraph(graph, tableNames, { maxDepth: 5 });
}

/**
 * Extract subgraph based on a relationship type filter
 */
export function extractByRelationshipType(
    graph: SchemaGraph,
    focusTables: string[],
    relationshipTypes: RelationshipType[]
): SchemaSubgraph {
    // First get the full subgraph
    const fullSubgraph = extractSubgraph(graph, focusTables, { maxDepth: 3 });

    // Filter relationships by type
    const typeSet = new Set(relationshipTypes);
    const filteredRelationships = fullSubgraph.relationships.filter(
        rel => typeSet.has(rel.type)
    );

    // Get tables that are still connected after filtering
    const connectedTables = new Set<string>();
    for (const rel of filteredRelationships) {
        connectedTables.add(toNodeId(rel.source.schema, rel.source.table));
        connectedTables.add(toNodeId(rel.target.schema, rel.target.table));
    }

    // Always include focus tables
    for (const focus of focusTables) {
        connectedTables.add(focus);
    }

    // Filter tables and nodes
    const filteredTables = fullSubgraph.tables.filter(t =>
        connectedTables.has(toNodeId(t.schema, t.name))
    );
    const filteredNodes = fullSubgraph.nodes.filter(n =>
        connectedTables.has(n.id)
    );

    return {
        ...fullSubgraph,
        tables: filteredTables,
        nodes: filteredNodes,
        relationships: filteredRelationships,
        stats: {
            ...fullSubgraph.stats,
            tableCount: filteredTables.length,
        },
    };
}

/**
 * Get isolated tables (no relationships)
 */
export function getIsolatedTables(graph: SchemaGraph): Table[] {
    const isolatedTables: Table[] = [];

    for (const node of graph.nodes.values()) {
        if (node.type === 'TABLE' && node.inbound.length === 0 && node.outbound.length === 0) {
            isolatedTables.push(node.table);
        }
    }

    return isolatedTables;
}

/**
 * Get hub tables (highly connected, more than N relationships)
 */
export function getHubTables(graph: SchemaGraph, minConnections: number = 3): Table[] {
    const hubs: Table[] = [];

    for (const node of graph.nodes.values()) {
        if (node.type !== 'TABLE') continue;

        const totalConnections = node.inbound.length + node.outbound.length;
        if (totalConnections >= minConnections) {
            hubs.push(node.table);
        }
    }

    // Sort by number of connections (descending)
    hubs.sort((a, b) => {
        const aId = toNodeId(a.schema, a.name);
        const bId = toNodeId(b.schema, b.name);

        const aNode = graph.nodes.get(aId);
        const bNode = graph.nodes.get(bId);

        if (!aNode || !bNode) return 0;

        const aConns = aNode.inbound.length + aNode.outbound.length;
        const bConns = bNode.inbound.length + bNode.outbound.length;
        return bConns - aConns;
    });

    return hubs;
}
