/**
 * Build Schema Graph
 * 
 * Converts a ParsedSchema into a SchemaGraph with adjacency information
 * for efficient traversal and subgraph extraction.
 */

import {
    ParsedSchema,
    Table,
    Column,
    Relationship,
} from '../sql-parser/types/core-types';

import {
    SchemaGraph,
    SchemaNode,
    SchemaGraphMetadata,
} from './types';

import { buildAdjacencyLists } from './core/adjacency';

import { toNodeId } from './utils';

/**
 * Build a SchemaGraph from a ParsedSchema
 */
export function buildSchemaGraph(
    parsedSchema: ParsedSchema,
    parseTime: number = 0
): SchemaGraph {
    const startTime = performance.now();

    // 1. Collect all relationships using builders
    // 1. Source relationships directly from the parser
    // The parser now handles all relationship extraction (FKs, Views, Triggers, Policies)
    const allRelationships = parsedSchema.relationships;

    // 2. Add synthetic relationships for CALLS (Triggers -> Functions) and DEPENDS_ON (Columns -> Types)
    const syntheticRelationships: Relationship[] = [];

    // Track types to establish DEPENDS_ON
    const enumNames = new Set<string>();
    const domainNames = new Set<string>();

    if (parsedSchema.enumTypes) {
        parsedSchema.enumTypes.forEach(e => enumNames.add(e.name));
    }
    if (parsedSchema.enums && parsedSchema.enums instanceof Map) {
        for (const name of parsedSchema.enums.keys()) enumNames.add(name);
    }
    parsedSchema.domains?.forEach(d => domainNames.add(d.name));

    // Generate CALLS from triggers
    parsedSchema.triggers?.forEach(t => {
        if (t.functionName) {
            syntheticRelationships.push({
                id: `rel_${t.table}_calls_${t.functionName}`,
                source: { schema: t.schema, table: t.table },
                target: { schema: t.functionSchema || t.schema, table: t.functionName },
                type: 'CALLS',
                confidence: 1.0
            });
        }
    });

    // Generate DEPENDS_ON from columns
    parsedSchema.tables?.forEach(table => {
        table.columns.forEach(col => {
            // Strip array brackets if present
            const baseType = col.type.replace('[]', '');
            if (enumNames.has(baseType) || domainNames.has(baseType)) {
                syntheticRelationships.push({
                    id: `rel_${table.name}_depends_${baseType}`,
                    source: { schema: table.schema, table: table.name, column: col.name },
                    target: { schema: table.schema, table: baseType },
                    type: 'DEPENDS_ON',
                    confidence: 1.0
                });
            }
        });
    });

    // Generate HAS_SEQUENCE from columns
    parsedSchema.tables?.forEach(table => {
        table.columns.forEach(col => {
            if (col.defaultValue && col.defaultValue.toLowerCase().includes('nextval')) {
                const match = col.defaultValue.match(/'([^']+)'/);
                if (match) {
                    const seqName = match[1];
                    syntheticRelationships.push({
                        id: `rel_${table.name}_has_seq_${col.name}`,
                        source: { schema: table.schema, table: table.name, column: col.name },
                        target: { schema: table.schema, table: seqName }, // Assuming sequence is in same schema if unqualified
                        type: 'HAS_SEQUENCE',
                        confidence: 0.9
                    });
                }
            }
        });
    });

    // Generate OWNS_POLICY and APPLIES_TO from policies
    parsedSchema.policies?.forEach(policy => {
        // OWNS_POLICY (Role -> Policy)
        if (policy.roles && policy.roles.length > 0) {
            policy.roles.forEach(roleName => {
                // Role names usually don't have schemas (they are global objects)
                syntheticRelationships.push({
                    id: `rel_role_${roleName}_owns_policy_${policy.name}`,
                    source: { table: roleName },
                    target: { schema: policy.schema, table: policy.name }, // Now targets the Policy node, not the table
                    type: 'OWNS_POLICY',
                    confidence: 1.0
                });
            });
        }

        // APPLIES_TO (Policy -> Table)
        syntheticRelationships.push({
            id: `rel_policy_${policy.name}_applies_to_${policy.table}`,
            source: { schema: policy.schema, table: policy.name }, // Source is the Policy node
            target: { schema: policy.schema, table: policy.table }, // Target is the Table node
            type: 'APPLIES_TO',
            confidence: 1.0
        });
    });

    const finalRelationships = [...parsedSchema.relationships, ...syntheticRelationships];

    // 3. Build adjacency lists
    const { adjacency, outboundAdjacency, inboundAdjacency } = buildAdjacencyLists(
        finalRelationships
    );

    // Optimized: Pre-group relationships by Source and Target Node ID
    // This reduces node construction complexity from O(Nodes * Edges) to O(Nodes + Edges)
    const inboundMap = new Map<string, Relationship[]>();
    const outboundMap = new Map<string, Relationship[]>();

    for (const rel of finalRelationships) {
        if (!rel || !rel.source || !rel.target) {
            continue;
        }
        const sourceId = toNodeId(rel.source.schema, rel.source.table);
        const targetId = toNodeId(rel.target.schema, rel.target.table);

        if (!outboundMap.has(sourceId)) outboundMap.set(sourceId, []);
        outboundMap.get(sourceId)!.push(rel);

        if (!inboundMap.has(targetId)) inboundMap.set(targetId, []);
        inboundMap.get(targetId)!.push(rel);
    }

    // Build nodes (Tables + Views)
    const nodes = new Map<string, SchemaNode>();

    // 3a. Process Tables
    for (const table of parsedSchema.tables) {
        const tableId = toNodeId(table.schema, table.name);

        // Find inbound and outbound relationships (O(1) lookup)
        const inbound = inboundMap.get(tableId) || [];
        const outbound = outboundMap.get(tableId) || [];

        // Find foreign key columns
        const foreignKeyColumns = table.columns.filter(col => col.isForeignKey);

        // Find columns referenced by other tables
        const referencedColumnNames = new Set(
            inbound.map(rel => rel.target.column).filter(Boolean) as string[]
        );
        const referencedColumns = table.columns.filter(
            col => referencedColumnNames.has(col.name)
        );

        // Attach triggers, policies, indexes for this table
        const tableTriggers = parsedSchema.triggers.filter(t => toNodeId(t.schema, t.table) === tableId);
        const tablePolicies = parsedSchema.policies.filter(p => toNodeId(p.schema, p.table) === tableId);
        const tableIndexes = parsedSchema.indexes.filter(i => toNodeId(i.schema, i.table) === tableId);

        nodes.set(tableId, {
            id: tableId,
            type: 'TABLE',
            table,
            inbound,
            outbound,
            foreignKeyColumns,
            referencedColumns,
            triggers: tableTriggers,
            policies: tablePolicies,
            indexes: tableIndexes,
            distance: -1,
            isFocused: false,
        });
    }

    // 3b. Process Views
    for (const view of parsedSchema.views) {
        const viewId = toNodeId(view.schema, view.name);

        // Find relationships (O(1) lookup)
        const inbound = inboundMap.get(viewId) || [];
        const outbound = outboundMap.get(viewId) || [];

        nodes.set(viewId, {
            id: viewId,
            type: view.isMaterialized ? 'MATERIALIZED_VIEW' : 'VIEW',
            view,
            inbound,
            outbound,
            distance: -1,
            isFocused: false,
        });
    }

    // 3c. Process Functions
    for (const func of parsedSchema.functions || []) {
        const funcId = toNodeId(func.schema, func.name);
        const inbound = inboundMap.get(funcId) || [];
        const outbound = outboundMap.get(funcId) || [];

        nodes.set(funcId, {
            id: funcId,
            type: 'FUNCTION',
            functionDef: func,
            inbound,
            outbound,
            distance: -1,
            isFocused: false,
        });
    }

    // Build enum map and Process Enums
    const enumMap = new Map<string, { name: string; schema?: string; values: string[] }>();
    if (parsedSchema.enumTypes) {
        for (const enumType of parsedSchema.enumTypes) {
            enumMap.set(enumType.name, enumType);
        }
    }
    // Also handle the legacy enums Map format
    if (parsedSchema.enums && parsedSchema.enums instanceof Map) {
        for (const [name, values] of parsedSchema.enums.entries()) {
            if (!enumMap.has(name)) {
                enumMap.set(name, { name, values: values as string[] });
            }
        }
    }

    for (const [name, enumDef] of enumMap.entries()) {
        const enumId = toNodeId(enumDef.schema, name);
        const inbound = inboundMap.get(enumId) || [];
        const outbound = outboundMap.get(enumId) || [];

        nodes.set(enumId, {
            id: enumId,
            type: 'ENUM',
            enumDef: enumDef as any,
            inbound,
            outbound,
            distance: -1,
            isFocused: false,
        });
    }

    // Process Extensions
    for (const ext of parsedSchema.extensions || []) {
        const extId = toNodeId(undefined, ext.name);
        const inbound = inboundMap.get(extId) || [];
        const outbound = outboundMap.get(extId) || [];

        nodes.set(extId, {
            id: extId,
            type: 'EXTENSION',
            extensionDef: ext,
            inbound,
            outbound,
            distance: -1,
            isFocused: false,
        });
    }

    // Process Policies
    for (const policy of parsedSchema.policies || []) {
        const policyId = toNodeId(policy.schema, policy.name);
        const inbound = inboundMap.get(policyId) || [];
        const outbound = outboundMap.get(policyId) || [];

        nodes.set(policyId, {
            id: policyId,
            type: 'POLICY',
            policyDef: policy,
            inbound,
            outbound,
            distance: -1,
            isFocused: false,
        });
    }

    // 3d. Process Domains
    for (const domain of parsedSchema.domains || []) {
        const domainId = toNodeId(domain.schema, domain.name);
        const inbound = inboundMap.get(domainId) || [];
        const outbound = outboundMap.get(domainId) || [];

        nodes.set(domainId, {
            id: domainId,
            type: 'DOMAIN',
            domainDef: domain,
            inbound,
            outbound,
            distance: -1,
            isFocused: false,
        });
    }

    // 3e. Process Roles
    for (const role of parsedSchema.roles || []) {
        const roleId = toNodeId(undefined, role.name); // Roles are global
        const inbound = inboundMap.get(roleId) || [];
        const outbound = outboundMap.get(roleId) || [];

        nodes.set(roleId, {
            id: roleId,
            type: 'ROLE',
            roleDef: role,
            inbound,
            outbound,
            distance: -1,
            isFocused: false,
        });
    }

    // 3f. Process Sequences
    for (const sequence of parsedSchema.sequences || []) {
        const sequenceId = toNodeId(sequence.schema, sequence.name);
        const inbound = inboundMap.get(sequenceId) || [];
        const outbound = outboundMap.get(sequenceId) || [];

        nodes.set(sequenceId, {
            id: sequenceId,
            type: 'SEQUENCE',
            sequenceDef: sequence,
            inbound,
            outbound,
            distance: -1,
            isFocused: false,
        });
    }

    // Ensure all nodes are in adjacency (even isolated ones)
    for (const nodeId of nodes.keys()) {
        if (!adjacency.has(nodeId)) {
            adjacency.set(nodeId, []);
        }
    }

    // Calculate metadata
    const buildTime = performance.now() - startTime;
    const columnCount = parsedSchema.tables.reduce(
        (sum, table) => sum + table.columns.length,
        0
    );

    const metadata: SchemaGraphMetadata = {
        parseTime,
        buildTime,
        tableCount: parsedSchema.tables.length,
        relationCount: parsedSchema.relationships.length,
        columnCount,
        hasErrors: parsedSchema.errors.length > 0,
        errorCount: parsedSchema.errors.length,
        warningCount: parsedSchema.warnings.length,
        confidence: parsedSchema.confidence || 1,
    };

    return {
        nodes,
        relationships: allRelationships,
        adjacency,
        outboundAdjacency,
        inboundAdjacency,
        indexes: parsedSchema.indexes || [],
        views: parsedSchema.views || [],
        enums: enumMap,
        functions: parsedSchema.functions || [],
        triggers: parsedSchema.triggers || [],
        policies: parsedSchema.policies || [],
        sequences: parsedSchema.sequences || [],
        roles: parsedSchema.roles || [],
        extensions: parsedSchema.extensions || [],
        domains: parsedSchema.domains || [],
        compositeTypes: parsedSchema.compositeTypes || [],
        metadata,
    };
}

/**
 * Get all node IDs from a graph
 */
export function getNodeIds(graph: SchemaGraph): string[] {
    return Array.from(graph.nodes.keys());
}

/**
 * Get a specific node (Table or View)
 */
export function getNode(graph: SchemaGraph, nodeId: string): SchemaNode | undefined {
    return graph.nodes.get(nodeId);
}

/**
 * Get all tables as an array (for legacy consumers)
 */
export function getTables(graph: SchemaGraph): Table[] {
    const tables: Table[] = [];
    for (const node of graph.nodes.values()) {
        if (node.type === 'TABLE') {
            tables.push(node.table);
        }
    }
    return tables;
}

/**
 * Get relationships for a specific node
 */
export function getNodeRelationships(
    graph: SchemaGraph,
    nodeId: string
): { inbound: Relationship[]; outbound: Relationship[] } {
    const node = graph.nodes.get(nodeId);
    if (!node) {
        return { inbound: [], outbound: [] };
    }
    return {
        inbound: node.inbound,
        outbound: node.outbound,
    };
}

/**
 * Find tables/nodes that reference a given node (inbound FK)
 * Returns qualified IDs
 */
export function getReferencingNodes(graph: SchemaGraph, nodeId: string): string[] {
    // Determine neighbors from inbound relationships
    const inboundrels = graph.inboundAdjacency.get(nodeId);
    if (!inboundrels) return [];

    // Extract unique source IDs
    return inboundrels.map(rel => {
        // For inbound relationships, the referencing node is the source
        return toNodeId(rel.source.schema, rel.source.table);
    });
}

/**
 * Check if two nodes are directly connected
 */
export function areNodesConnected(
    graph: SchemaGraph,
    id1: string,
    id2: string
): boolean {
    const connections = graph.adjacency.get(id1);
    if (!connections) return false;

    // Search relationships
    // This is O(E_node), slower than Set lookup.
    // But E_node is usually small.
    return connections.some(rel => {
        const source = toNodeId(rel.source.schema, rel.source.table);
        const target = toNodeId(rel.target.schema, rel.target.table);
        return (source === id1 && target === id2) || (source === id2 && target === id1);
    });
}

/**
 * Get statistics about the graph
 */
export function getGraphStats(graph: SchemaGraph): {
    tables: number;
    relationships: number;
    columns: number;
    indexes: number;
    views: number;
    enums: number;
    functions: number;
    avgColumnsPerTable: number;
    avgRelationsPerTable: number;
    isolatedTables: number;
} {
    const nodeCount = graph.nodes.size;
    let tableCount = 0;
    for (const node of graph.nodes.values()) {
        if (node.type === 'TABLE') tableCount++;
    }

    const columnCount = graph.metadata.columnCount;

    // Count isolated tables (no relationships)
    let isolatedTables = 0;
    for (const [id, rels] of graph.adjacency) {
        if (rels.length === 0) {
            // Check if it's a table
            const node = graph.nodes.get(id);
            if (node && node.type === 'TABLE') {
                isolatedTables++;
            }
        }
    }

    return {
        tables: tableCount || nodeCount, // Fallback
        relationships: graph.relationships.length,
        columns: columnCount,
        indexes: graph.indexes.length,
        views: graph.views.length,
        enums: graph.enums.size,
        functions: graph.functions.length,
        avgColumnsPerTable: tableCount > 0 ? columnCount / tableCount : 0,
        avgRelationsPerTable: tableCount > 0 ? graph.relationships.length / tableCount : 0,
        isolatedTables,
    };
}

/**
 * Create an empty schema graph (for initial state)
 */
export function createEmptyGraph(): SchemaGraph {
    return {
        nodes: new Map(),
        relationships: [],
        adjacency: new Map(),
        outboundAdjacency: new Map(),
        inboundAdjacency: new Map(),
        indexes: [],
        views: [],
        enums: new Map(),
        functions: [],
        triggers: [],
        policies: [],
        sequences: [],
        roles: [],
        extensions: [],
        domains: [],
        compositeTypes: [],
        metadata: {
            parseTime: 0,
            buildTime: 0,
            tableCount: 0,
            relationCount: 0,
            columnCount: 0,
            hasErrors: false,
            errorCount: 0,
            warningCount: 0,
            confidence: 1,
        },
    };
}
