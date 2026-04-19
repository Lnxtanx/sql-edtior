/**
 * Schema Workspace Types
 * 
 * Type definitions for the runtime schema graph that powers the diagram,
 * AI context, and focused views.
 */

import {
    Table,
    Column,
    Relationship,
    Index,
    View,
    EnumType,
    PostgresFunction,
    Trigger,
    Policy,
    Sequence,
    Extension,
    Domain,
    CompositeType,
    ParsedSchema,
    Role,
} from '../sql-parser/types/core-types';

// =============================================================================
// Projection Types
// =============================================================================

export interface ProjectionFlags {
    showViews: boolean;
    showMaterializedViews: boolean;
    showFunctions: boolean;
    showEnums: boolean;
    showDomains?: boolean;
    showRoles?: boolean;
    showSequences?: boolean;
    showExtensions?: boolean;
    showPolicies?: boolean;
}

export interface RenderGraph {
    tables: Table[];
    views: View[];
    matViews: View[];
    functions: PostgresFunction[];
    enums: EnumType[];
    domains: Domain[];
    roles: Role[];
    sequences: Sequence[];
    extensions: Extension[];
    policies: Policy[];
    relationships: Relationship[];
}

// =============================================================================
// Schema Graph Types
// =============================================================================

/**
 * Base properties for any node in the schema graph
 */
export interface BaseNode {
    /** Unique Schema-Qualified ID */
    id: string;

    /** Type of object */
    type: 'TABLE' | 'VIEW' | 'MATERIALIZED_VIEW' | 'FUNCTION' | 'ENUM' | 'DOMAIN' | 'ROLE' | 'SEQUENCE' | 'EXTENSION' | 'POLICY';

    /** Inbound relationships (other objects → this object) */
    inbound: Relationship[];

    /** Outbound relationships (this object → other objects) */
    outbound: Relationship[];

    /** Distance from the focused object(s), -1 if not computed */
    distance: number;

    /** Whether this object is currently in focus */
    isFocused: boolean;
}

/**
 * A node representing a Table
 */
export interface TableNode extends BaseNode {
    type: 'TABLE';
    table: Table;
    foreignKeyColumns: Column[];
    referencedColumns: Column[];
    triggers: Trigger[];
    policies: Policy[];
    indexes: Index[];
}

/**
 * A node representing a View
 */
export interface ViewNode extends BaseNode {
    type: 'VIEW' | 'MATERIALIZED_VIEW';
    view: View;
}

/**
 * A node representing a PG Function or Procedure
 */
export interface FunctionNode extends BaseNode {
    type: 'FUNCTION';
    functionDef: PostgresFunction;
}

/**
 * A node representing an Enum Type
 */
export interface EnumNode extends BaseNode {
    type: 'ENUM';
    enumDef: EnumType;
}

/**
 * A node representing a Domain Type
 */
export interface DomainNode extends BaseNode {
    type: 'DOMAIN';
    domainDef: Domain;
}

/**
 * A node representing a Role
 */
export interface RoleNode extends BaseNode {
    type: 'ROLE';
    roleDef: Role;
}

/**
 * A node representing a Sequence
 */
export interface SequenceNode extends BaseNode {
    type: 'SEQUENCE';
    sequenceDef: Sequence;
}

/**
 * A node representing an Extension
 */
export interface ExtensionNode extends BaseNode {
    type: 'EXTENSION';
    extensionDef: Extension;
}

/**
 * A node representing a Policy
 */
export interface PolicyNode extends BaseNode {
    type: 'POLICY';
    policyDef: Policy;
}

/**
 * Union type for any node in the graph
 */
export type SchemaNode = TableNode | ViewNode | FunctionNode | EnumNode | DomainNode | RoleNode | SequenceNode | ExtensionNode | PolicyNode;

/**
 * The complete schema graph with all tables, views, and relationships
 */
export interface SchemaGraph {
    /** All nodes (tables and views) indexed by qualified ID */
    nodes: Map<string, SchemaNode>;

    /** All relationships in the schema */
    relationships: Relationship[];

    /** Adjacency list for quick traversal: node ID → relationships */
    adjacency: Map<string, Relationship[]>;

    /** Adjacency for outbound connections only (this → target) */
    outboundAdjacency: Map<string, Relationship[]>;

    /** Adjacency for inbound connections only (source → this) */
    inboundAdjacency: Map<string, Relationship[]>;

    /** All indexes */
    indexes: Index[];

    /** All views (raw list) */
    views: View[];

    /** All enum types */
    enums: Map<string, EnumType>;

    /** All functions */
    functions: PostgresFunction[];

    /** All triggers */
    triggers: Trigger[];

    /** All policies */
    policies: Policy[];

    /** All sequences */
    sequences: Sequence[];

    /** All roles */
    roles: Role[];

    /** All extensions */
    extensions: Extension[];

    /** All domains */
    domains: Domain[];

    /** All composite types */
    compositeTypes: CompositeType[];

    /** Metadata about the graph */
    metadata: SchemaGraphMetadata;
}

/**
 * Metadata about the schema graph
 */
export interface SchemaGraphMetadata {
    /** Time taken to parse the SQL (ms) */
    parseTime: number;

    /** Time taken to build the graph (ms) */
    buildTime: number;

    /** Total number of tables */
    tableCount: number;

    /** Total number of relationships */
    relationCount: number;

    /** Total number of columns across all tables */
    columnCount: number;

    /** Whether there were parse errors */
    hasErrors: boolean;

    /** Number of parse errors */
    errorCount: number;

    /** Number of parse warnings */
    warningCount: number;

    /** Overall parse confidence (0-1) */
    confidence: number;
}

// =============================================================================
// Subgraph Types
// =============================================================================

/**
 * Options for extracting a subgraph
 */
export interface SubgraphOptions {
    /** Maximum depth from focus tables (default: 2) */
    maxDepth?: number;

    /** Direction to traverse (default: 'both') */
    direction?: 'inbound' | 'outbound' | 'both';

    /** Include partition child tables */
    includePartitions?: boolean;

    /** Minimum relationship confidence to include (0-1, default: 0) */
    minConfidence?: number;
}

/**
 * Default subgraph extraction options
 */
export const DEFAULT_SUBGRAPH_OPTIONS: Required<SubgraphOptions> = {
    maxDepth: 2,
    direction: 'both',
    includePartitions: true,
    minConfidence: 0,
};

/**
 * A subgraph focused on specific tables/views
 */
export interface SchemaSubgraph {
    /** Tables in the subgraph (for legacy compatibility) */
    tables: Table[];

    /** All nodes (tables and views) in the subgraph with distance info */
    nodes: SchemaNode[];

    /** Relationships between tables in the subgraph */
    relationships: Relationship[];

    /** The focal table names that defined this subgraph */
    focus: string[];

    /** The options used to extract this subgraph */
    options: Required<SubgraphOptions>;

    /** Statistics about the subgraph */
    stats: {
        /** Total tables in subgraph */
        tableCount: number;
        /** Tables at each depth level */
        depthCounts: Map<number, number>;
        /** Whether the subgraph was truncated (hit max depth) */
        wasTruncated: boolean;
    };
}

// =============================================================================
// Workspace State Types
// =============================================================================

/**
 * Cursor position in the SQL editor
 */
export interface EditorCursor {
    line: number;
    column: number;
    offset: number;
}

/**
 * Selection range in the SQL editor
 */
export interface EditorSelection {
    start: EditorCursor;
    end: EditorCursor;
    text: string;
}

/**
 * Context derived from the editor state
 */
export interface EditorContext {
    /** Current cursor position */
    cursor?: EditorCursor;

    /** Current selection (if any) */
    selection?: EditorSelection;

    /** The table name at or near the cursor (if any) */
    tableAtCursor?: string;

    /** The column name at or near the cursor (if any) */
    columnAtCursor?: string;

    /** Tables referenced in the current selection */
    tablesInSelection?: string[];
}

/**
 * The complete schema workspace state
 */
export interface SchemaWorkspace {
    /** The full schema graph */
    graph: SchemaGraph;

    /** The original parsed schema */
    parsedSchema: ParsedSchema;

    /** Current editor context */
    editorContext?: EditorContext;

    /** Currently focused tables (for subgraph) */
    focusedTables: string[];

    /** The current subgraph (if focus is set) */
    currentSubgraph?: SchemaSubgraph;

    /** Selected table (for UI highlighting) */
    selectedTable?: string;

    /** Whether the workspace is being updated */
    isUpdating: boolean;

    /** Last update timestamp */
    lastUpdate: number;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Events that can be emitted by the workspace
 */
export type WorkspaceEvent =
    | { type: 'GRAPH_UPDATED'; graph: SchemaGraph }
    | { type: 'FOCUS_CHANGED'; tables: string[]; subgraph: SchemaSubgraph }
    | { type: 'SELECTION_CHANGED'; table?: string }
    | { type: 'CONTEXT_CHANGED'; context: EditorContext }
    | { type: 'ERROR'; error: Error };

/**
 * Listener for workspace events
 */
export type WorkspaceEventListener = (event: WorkspaceEvent) => void;

/**
 * Statistics about the graph for impact analysis
 */
export interface GraphStats {
    tableCount: number;
    relationshipCount: number;
    cascadeRiskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    highRiskTableCount: number;
    avgConfidence: number;
    depthCounts?: Map<number, number>;

    // Focused table detail (only populated when focusTable is set)
    focusedTable?: string;
    isViewFocus?: boolean;
    sourceTableCount?: number;
    indexCount?: number;
    policyCount?: number;
    triggerCount?: number;
    dependentViewCount?: number;
    inboundFkCount?: number;
    outboundFkCount?: number;
}
