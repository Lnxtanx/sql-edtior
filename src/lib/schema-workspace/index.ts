/**
 * Schema Workspace Module
 * 
 * Provides a runtime schema graph layer for efficient traversal,
 * subgraph extraction, and AI context building.
 */

// Types
export type {
    // Types
    SchemaGraph,
    SchemaNode,
    TableNode,
    SchemaGraphMetadata,
    SchemaSubgraph,
    SubgraphOptions,
    EditorCursor,
    EditorSelection,
    EditorContext,
    SchemaWorkspace,
    WorkspaceEvent,
    WorkspaceEventListener,
    GraphStats,
    ProjectionFlags,
    RenderGraph,
} from './types';

export { DEFAULT_SUBGRAPH_OPTIONS } from './types';

// Graph building
export {
    buildSchemaGraph,
    createEmptyGraph,
    getNodeIds,
    getNode,
    getTables,
    getNodeRelationships,
    getReferencingNodes,
    areNodesConnected,
    getGraphStats,
} from './build-graph';

// Subgraph extraction
export {
    extractSubgraph,
    extractTableSubgraph,
    extractDirectConnections,
    extractConnectingSubgraph,
    extractByRelationshipType,
    getIsolatedTables,
    getHubTables,
} from './core/subgraph';

// Projection
export { applyProjection } from './core/projection';

// Adjacency utilities
export {
    buildAdjacencyLists,
    getConnectedTables,
    getDirectedConnections,
    findPaths,
    detectCycles,
    calculateDegrees,
    getShortestPath,
    getWeightedShortestPath,
    calculateEdgeWeight,
    buildWeightedAdjacencyLists,
} from './core/adjacency';
export {
    analyzeCascadeRisks,
    type CascadeRisk
} from './core/danger-analysis';
