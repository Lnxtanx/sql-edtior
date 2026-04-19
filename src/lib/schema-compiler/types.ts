/**
 * Schema Compiler Type System
 * 
 * Enterprise PostgreSQL structural compiler and analyzer.
 * Defines all 20 compilation layers, issues, metrics, and the unified CompilationResult.
 */

import type {
    ParsedSchema, Table, Column, Index, View, PostgresFunction,
    Trigger, Policy, Extension, EnumType, CompositeType, Domain,
    Sequence, Relationship, ForeignKeyReference, NamedConstraint,
    DataTypeCategory,
} from '@/lib/sql-parser';

// =============================================================================
// Compilation Layers
// =============================================================================

export type CompilationLayer =
    | 'database'
    | 'schema'
    | 'table'
    | 'column'
    | 'type'
    | 'constraint'
    | 'index'
    | 'partition'
    | 'view'
    | 'function'
    | 'trigger'
    | 'rls'
    | 'privilege'
    | 'sequence'
    | 'extension'
    | 'dependency'
    | 'storage'
    | 'replication'
    | 'semantic'
    | 'metrics';

export type IssueSeverity = 'critical' | 'error' | 'warning' | 'suggestion' | 'info';
export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

// =============================================================================
// Compilation Issues
// =============================================================================

export interface CompilationIssue {
    id: string;
    layer: CompilationLayer;
    severity: IssueSeverity;
    category: string;
    title: string;
    message: string;
    affectedObjects: AffectedObject[];
    remediation?: string;
    sqlFix?: string;
    riskScore: number; // 0-100
}

export interface AffectedObject {
    type: 'table' | 'column' | 'index' | 'view' | 'function' | 'trigger' | 'policy' |
          'sequence' | 'extension' | 'enum' | 'domain' | 'composite_type' | 'schema' | 'constraint';
    schema?: string;
    name: string;
    detail?: string;
}

// =============================================================================
// Layer 1: Database Compilation
// =============================================================================

export interface DatabaseCompilation {
    name?: string;
    owner?: string;
    encoding?: string;
    collation?: string;
    ctype?: string;
    tablespace?: string;
    serverVersion?: string;
    systemIdentifier?: string;
    searchPath: string[];
    extensions: ExtensionCompilation[];
}

// =============================================================================
// Layer 2: Schema Compilation
// =============================================================================

export interface SchemaCompilation {
    name: string;
    owner?: string;
    acl?: string[];
    objectCounts: {
        tables: number;
        views: number;
        functions: number;
        sequences: number;
        types: number;
        indexes: number;
        triggers: number;
        policies: number;
    };
    crossSchemaDependencies: CrossSchemaDependency[];
    publicExposureRisks: string[];
}

export interface CrossSchemaDependency {
    sourceSchema: string;
    sourceObject: string;
    targetSchema: string;
    targetObject: string;
    dependencyType: string;
}

// =============================================================================
// Layer 3: Table Compilation
// =============================================================================

export interface TableCompilation {
    name: string;
    schema: string;
    tableType: 'base' | 'partitioned' | 'foreign' | 'unlogged' | 'temporary' | 'inherited';
    owner?: string;
    tablespace?: string;
    storageParameters?: Record<string, string>;
    replicaIdentity?: 'default' | 'nothing' | 'full' | 'index';
    rlsEnabled: boolean;
    hasRlsPolicies: boolean;
    columnCount: number;
    constraintCount: number;
    inboundFKCount: number;
    outboundFKCount: number;
    dependencyDegree: number;
    cascadeRiskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    indexCount: number;
    triggerCount: number;
    estimatedComplexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
    // Original table reference
    source: Table;
}

// =============================================================================
// Layer 4: Column Compilation
// =============================================================================

export interface ColumnCompilation {
    tableName: string;
    tableSchema: string;
    name: string;
    resolvedType: string;
    originalType: string;
    typeCategory: DataTypeCategory;
    domainResolution?: DomainResolution;
    arrayDimensions: number;
    collation?: string;
    nullable: boolean;
    defaultExpression?: string;
    isGenerated: boolean;
    generatedExpression?: string;
    identityGeneration?: 'ALWAYS' | 'BY DEFAULT';
    storageType?: 'PLAIN' | 'MAIN' | 'EXTENDED' | 'EXTERNAL';
    compression?: string;
    statisticsTarget?: number;
    // Semantic analysis
    isBusinessKeyCandidate: boolean;
    indexCoverage: IndexCoverageInfo;
    constraintParticipation: ConstraintParticipation;
    typeMismatchDetection?: TypeMismatch[];
    implicitCastRisks?: ImplicitCastRisk[];
}

export interface DomainResolution {
    domainName: string;
    domainSchema?: string;
    baseType: string;
    constraints: string[];
}

export interface IndexCoverageInfo {
    isIndexed: boolean;
    isPrimaryKey: boolean;
    indexNames: string[];
    isLeadingColumn: boolean;
    coverageLevel: 'full' | 'partial' | 'none';
}

export interface ConstraintParticipation {
    primaryKey: boolean;
    foreignKey: boolean;
    unique: boolean;
    check: boolean;
    notNull: boolean;
    exclusion: boolean;
}

export interface TypeMismatch {
    localColumn: string;
    localType: string;
    remoteTable: string;
    remoteColumn: string;
    remoteType: string;
    severity: 'error' | 'warning';
    description: string;
}

export interface ImplicitCastRisk {
    fromType: string;
    toType: string;
    context: string;
    riskLevel: 'high' | 'medium' | 'low';
}

// =============================================================================
// Layer 5: Type Compilation
// =============================================================================

export interface TypeCompilation {
    enums: EnumCompilationEntry[];
    domains: DomainCompilationEntry[];
    compositeTypes: CompositeTypeEntry[];
    rangeTypes: RangeTypeEntry[];
    // Analysis
    unusedEnums: string[];
    domainConstraintConflicts: DomainConflict[];
    duplicateEnumSemantics: DuplicateEnum[];
    typeDependencyEdges: TypeDependencyEdge[];
}

export interface EnumCompilationEntry {
    name: string;
    schema?: string;
    values: string[];
    usedByColumns: { table: string; column: string }[];
    isUsed: boolean;
}

export interface DomainCompilationEntry {
    name: string;
    schema?: string;
    baseType: string;
    notNull: boolean;
    default?: string;
    checkExpressions: string[];
    usedByColumns: { table: string; column: string }[];
    isUsed: boolean;
}

export interface CompositeTypeEntry {
    name: string;
    schema?: string;
    attributes: { name: string; type: string }[];
    usedByColumns: { table: string; column: string }[];
}

export interface RangeTypeEntry {
    name: string;
    schema?: string;
    subtype: string;
}

export interface DomainConflict {
    domain: string;
    constraint: string;
    conflictsWith: string;
    description: string;
}

export interface DuplicateEnum {
    enum1: string;
    enum2: string;
    sharedValues: string[];
    similarity: number;
}

export interface TypeDependencyEdge {
    sourceType: string;
    targetType: string;
    dependencyKind: string;
}

// =============================================================================
// Layer 6: Constraint Compilation
// =============================================================================

export interface ConstraintCompilation {
    primaryKeys: PKCompilation[];
    foreignKeys: FKCompilation[];
    uniqueConstraints: UniqueCompilation[];
    checkConstraints: CheckCompilation[];
    exclusionConstraints: ExclusionCompilation[];
    // Analysis
    fkWithoutIndex: FKWithoutIndex[];
    multiColumnUniquenessIssues: string[];
    constraintCycles: string[][];
    invalidConstraints: string[];
    deferredIntegrityRisks: string[];
}

export interface PKCompilation {
    table: string;
    schema?: string;
    columns: string[];
    name?: string;
    isComposite: boolean;
}

export interface FKCompilation {
    name?: string;
    sourceTable: string;
    sourceSchema?: string;
    sourceColumns: string[];
    targetTable: string;
    targetSchema?: string;
    targetColumns: string[];
    onDelete?: string;
    onUpdate?: string;
    isDeferrable: boolean;
    isNotValid: boolean;
    hasIndex: boolean;
    matchType?: string;
}

export interface UniqueCompilation {
    table: string;
    schema?: string;
    columns: string[];
    name?: string;
    isPartial: boolean;
}

export interface CheckCompilation {
    table: string;
    schema?: string;
    name?: string;
    expression: string;
    columns: string[];
    isNotValid: boolean;
}

export interface ExclusionCompilation {
    table: string;
    schema?: string;
    name?: string;
    elements: string[];
    method: string;
}

export interface FKWithoutIndex {
    table: string;
    columns: string[];
    referencedTable: string;
    suggestedIndex: string;
}

// =============================================================================
// Layer 7: Index Compilation
// =============================================================================

export interface IndexCompilation {
    indexes: IndexEntry[];
    // Analysis
    duplicateIndexes: DuplicateIndex[];
    redundantIndexes: RedundantIndex[];
    missingIndexSuggestions: MissingIndex[];
    fkNotIndexed: FKWithoutIndex[];
    expressionIndexes: string[];
    partialIndexes: string[];
}

export interface IndexEntry {
    name: string;
    schema?: string;
    table: string;
    columns: string[];
    type: string;
    isUnique: boolean;
    isPartial: boolean;
    whereClause?: string;
    includeColumns: string[];
    opclass?: string;
    collation?: string;
    tablespace?: string;
    storageParams?: Record<string, string>;
    isInvalid: boolean;
    isConcurrent: boolean;
    expressionDef?: string;
    backsConstraint: boolean;
    constraintName?: string;
}

export interface DuplicateIndex {
    index1: string;
    index2: string;
    table: string;
    columns: string[];
    recommendation: string;
}

export interface RedundantIndex {
    redundantIndex: string;
    supersededBy: string;
    table: string;
    recommendation: string;
}

export interface MissingIndex {
    table: string;
    columns: string[];
    reason: string;
    suggestedDDL: string;
    priority: 'high' | 'medium' | 'low';
}

// =============================================================================
// Layer 8: Partition Compilation
// =============================================================================

export interface PartitionCompilation {
    trees: PartitionTree[];
    orphanPartitions: string[];
    totalPartitionedTables: number;
    totalPartitions: number;
}

export interface PartitionTree {
    rootTable: string;
    rootSchema?: string;
    strategy: 'range' | 'list' | 'hash' | 'unknown';
    partitionKey: string | string[];
    root: PartitionNode;
    totalPartitions: number;
    maxDepth: number;
}

export interface PartitionNode {
    name: string;
    schema?: string;
    bounds?: string;
    depth: number;
    children: PartitionNode[];
    hasLocalIndexes: boolean;
}

// =============================================================================
// Layer 9: View Compilation
// =============================================================================

export interface ViewCompilation {
    views: ViewEntry[];
    materializedViews: MaterializedViewEntry[];
    // Analysis
    brokenReferences: BrokenReference[];
    circularViewDeps: string[][];
    volatileFunctionDeps: VolatileFunctionDep[];
    unindexedMaterializedViews: string[];
    viewDepthMap: Map<string, number>;
}

export interface ViewEntry {
    name: string;
    schema?: string;
    isMaterialized: boolean;
    isRecursive: boolean;
    securityBarrier: boolean;
    checkOption?: 'LOCAL' | 'CASCADED';
    dependsOn: string[];
    referencedBy: string[];
    depth: number;
    columns?: string[];
    query?: string;
}

export interface MaterializedViewEntry extends ViewEntry {
    isPopulated: boolean;
    hasIndexes: boolean;
    refreshMethod?: string;
    storageParameters?: Record<string, string>;
}

export interface BrokenReference {
    view: string;
    missingObject: string;
    objectType: string;
}

export interface VolatileFunctionDep {
    view: string;
    function: string;
    risk: string;
}

// =============================================================================
// Layer 10: Function Compilation
// =============================================================================

export interface FunctionCompilation {
    functions: FunctionEntry[];
    procedures: FunctionEntry[];
    // Analysis
    unsafeSecurityDefiners: string[];
    volatileInIndex: VolatileInIndex[];
    unusedFunctions: string[];
    recursiveFunctions: string[];
    functionDependencyTree: FunctionDependency[];
}

export interface FunctionEntry {
    name: string;
    schema?: string;
    language: string;
    returnType?: string;
    isProcedure: boolean;
    parameters: { name?: string; type: string; mode?: string; default?: string }[];
    volatility: 'VOLATILE' | 'STABLE' | 'IMMUTABLE';
    securityDefiner: boolean;
    leakproof: boolean;
    parallelSafety: 'SAFE' | 'RESTRICTED' | 'UNSAFE';
    cost: number;
    isStrict: boolean;
    bodySize: number;
    complexity: 'simple' | 'moderate' | 'complex';
    referencedTables: string[];
    calledByTriggers: string[];
    calledByViews: string[];
}

export interface VolatileInIndex {
    function: string;
    index: string;
    table: string;
    risk: string;
}

export interface FunctionDependency {
    caller: string;
    callee: string;
    dependencyType: 'direct_call' | 'trigger' | 'view' | 'default_value';
}

// =============================================================================
// Layer 11: Trigger Compilation
// =============================================================================

export interface TriggerCompilation {
    triggers: TriggerEntry[];
    // Analysis
    orderingConflicts: TriggerConflict[];
    partitionedParentTriggers: string[];
    missingTriggerFunctions: string[];
    disabledTriggers: string[];
    highDensityTables: HighDensityTable[];
}

export interface TriggerEntry {
    name: string;
    schema?: string;
    table: string;
    timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
    events: string[];
    level: 'ROW' | 'STATEMENT';
    functionName: string;
    functionSchema?: string;
    condition?: string;
    isConstraintTrigger: boolean;
    isDeferrable: boolean;
    isEnabled: boolean;
}

export interface TriggerConflict {
    table: string;
    event: string;
    timing: string;
    triggers: string[];
    risk: string;
}

export interface HighDensityTable {
    table: string;
    triggerCount: number;
    events: string[];
    risk: 'high' | 'medium';
}

// =============================================================================
// Layer 12: RLS Compilation
// =============================================================================

export interface RLSCompilation {
    policies: RLSPolicyEntry[];
    enabledWithoutPolicies: string[];
    overPermissivePolicies: OverPermissivePolicy[];
    policyConflicts: PolicyConflict[];
    sensitiveSansRLS: string[];
    coverage: RLSCoverage;
}

export interface RLSPolicyEntry {
    name: string;
    schema?: string;
    table: string;
    command: string;
    roles: string[];
    using?: string;
    withCheck?: string;
    isPermissive: boolean;
}

export interface RLSCoverage {
    totalTables: number;
    tablesWithRLS: number;
    tablesWithoutRLS: number;
    coveragePercent: number;
    sensitiveTables: number;
    sensitiveTablesWithRLS: number;
}

export interface OverPermissivePolicy {
    table: string;
    policy: string;
    reason: string;
    risk: 'high' | 'medium';
}

export interface PolicyConflict {
    table: string;
    command: string;
    permissivePolicies: string[];
    restrictivePolicies: string[];
    risk: string;
}

// =============================================================================
// Layer 13: Privilege Compilation
// =============================================================================

export interface PrivilegeCompilation {
    grants: GrantEntry[];
    risks: PrivilegeRisk[];
    publicSchemaWritable: boolean;
    superuserFunctions: string[];
    exposureScore: number;
}

export interface GrantEntry {
    grantee: string;
    grantor?: string;
    privilege: string;
    objectType: 'TABLE' | 'SCHEMA' | 'FUNCTION' | 'SEQUENCE' | 'COLUMN' | 'DATABASE' | 'TYPE';
    objectName: string;
    withGrantOption: boolean;
    isDefault: boolean;
}

export interface PrivilegeRisk {
    type: string;
    severity: 'warning' | 'info' | 'error';
    description: string;
    affectedObjects: string[];
}

// =============================================================================
// Layer 14: Sequence Compilation
// =============================================================================

export interface SequenceCompilation {
    sequences: SequenceEntry[];
    orphanSequences: string[];
    sharedSequences: string[];
    totalSequences: number;
}

export interface SequenceEntry {
    name: string;
    schema?: string;
    dataType?: string;
    start?: number;
    increment?: number;
    minValue?: number;
    maxValue?: number;
    isCyclic: boolean;
    ownedByTable?: string;
    ownedByColumn?: string;
    isOrphan: boolean;
}

// =============================================================================
// Layer 15: Extension Compilation
// =============================================================================

export interface ExtensionCompilation {
    name: string;
    schema?: string;
    version?: string;
    category: string;
    description: string;
    isCritical: boolean;
}

// =============================================================================
// Layer 16: Dependency Graph Compilation
// =============================================================================

export interface DependencyCompilation {
    nodes: DependencyNode[];
    edges: DependencyEdge[];
    cycles: DependencyCycle[];
    centrality: CentralityEntry[];
    cascadeChains: CascadeChainEntry[];
    totalNodes: number;
    totalEdges: number;
}

export interface DependencyNode {
    name: string;
    type: string;
    schema?: string;
    inDegree: number;
    outDegree: number;
}

export interface DependencyEdge {
    source: string;
    target: string;
    sourceType: string;
    targetType: string;
    relation: string;
}

export interface DependencyCycle {
    id: string;
    nodes: { name: string; type: string }[];
    risk: string;
}

export interface CentralityEntry {
    name: string;
    type: string;
    inDegree: number;
    outDegree: number;
    totalDegree: number;
}

export interface CascadeChainEntry {
    root: string;
    rootType: string;
    affectedCount: number;
    affected: string[];
}

// =============================================================================
// Layer 17: Storage & Size Metadata (placeholder for introspected data)
// =============================================================================

export interface StorageCompilation {
    totalSize?: string;
    tableSizes: TableStorageInfo[];
    indexSizes: { name?: string; table?: string; size?: string }[];
    tablespaces: string[];
}

export interface TableStorageInfo {
    table: string;
    schema?: string;
    estimatedRowCount?: number;
    tableSize?: string;
    indexSize?: string;
    toastSize?: string;
    fillfactor?: number;
    autovacuumEnabled?: boolean;
}

// =============================================================================
// Layer 18: Replication & Advanced Features
// =============================================================================

export interface ReplicationCompilation {
    publicationTables: string[];
    subscriptions: string[];
    logicalSlots: string[];
}

// =============================================================================
// Layer 19: Semantic Compilation (Cross-Object Intelligence)
// =============================================================================

export interface SemanticCompilation {
    symbolTable: SymbolEntry[];
    unresolvedReferences: UnresolvedReference[];
    shadowedNames: ShadowedName[];
    typeDrift: TypeDrift[];
    namingAnomalies: NamingAnomaly[];
    crossSchemaCoupling: CrossSchemaCoupling[];
    totalSymbols: number;
}

export interface SymbolEntry {
    name: string;
    type: string;
    schema?: string;
    definedIn?: string;
}

export interface UnresolvedReference {
    source: string;
    sourceType: string;
    target: string;
    targetType: string;
    referenceType: string;
}

export interface ShadowedName {
    name: string;
    definitions: { type: string; schema?: string }[];
    risk?: string;
}

export interface TypeDrift {
    columnName: string;
    variations: { table: string; type: string }[];
    isSemantic: boolean;
}

export interface NamingAnomaly {
    name: string;
    type: string;
    expectedConvention: string;
    actualPattern: string;
}

export interface CrossSchemaCoupling {
    sourceSchema: string;
    targetSchema: string;
    edgeCount: number;
}

// =============================================================================
// Layer 20: Metrics
// =============================================================================

export interface CompilationMetrics {
    objectCounts: {
        tables: number;
        views: number;
        functions: number;
        triggers: number;
        indexes: number;
        sequences: number;
        policies: number;
        extensions: number;
        columns: number;
        relationships: number;
        enums: number;
        domains: number;
        compositeTypes: number;
        schemas: number;
    };
    densityMetrics: {
        constraintDensity: MetricValue;
        indexDensity: MetricValue;
        columnDensity: MetricValue;
        couplingScore: MetricValue;
    };
    qualityScores: {
        normalization: MetricValue;
        security: MetricValue;
        naming: MetricValue;
        documentation: MetricValue;
    };
    issueDistribution: {
        bySeverity: { error: number; warning: number; info: number };
        byLayer: Record<string, number>;
        totalIssues: number;
    };
    readinessScore: number;
    overallGrade: LetterGrade;
}

export interface MetricValue {
    name: string;
    value: number;
    unit: string;
    status: 'good' | 'warning' | 'critical';
}

// =============================================================================
// Layer Summaries (for sidebar display)
// =============================================================================

export interface LayerSummary {
    layer: CompilationLayer;
    label: string;
    icon: string;
    objectCount: number;
    issueCount: number;
    criticalCount: number;
    warningCount: number;
    riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';
    grade: LetterGrade;
}

// =============================================================================
// Main Compilation Result
// =============================================================================

export interface CompilationResult {
    // Metadata
    compiledAt: number;
    compilationTime: number;
    sourceType: 'sql_editor' | 'introspection' | 'file_import';
    schemaName: string;
    
    // All 20 layers
    database: DatabaseCompilation;
    schemas: SchemaCompilation[];
    tables: TableCompilation[];
    columns: ColumnCompilation[];
    types: TypeCompilation;
    constraints: ConstraintCompilation;
    indexes: IndexCompilation;
    partitions: PartitionCompilation;
    views: ViewCompilation;
    functions: FunctionCompilation;
    triggers: TriggerCompilation;
    rls: RLSCompilation;
    privileges: PrivilegeCompilation;
    sequences: SequenceCompilation;
    extensions: ExtensionCompilation[];
    dependencies: DependencyCompilation;
    storage: StorageCompilation;
    replication: ReplicationCompilation;
    semantic: SemanticCompilation;
    metrics: CompilationMetrics;
    
    // Aggregated
    issues: CompilationIssue[];
    layerSummaries: LayerSummary[];
    
    // Overall scores
    overallScore: number;
    overallGrade: LetterGrade;
    totalObjects: number;
    totalIssues: number;
}

// =============================================================================
// Compilation Options
// =============================================================================

export interface CompileOptions {
    /** Skip layers that are slow or irrelevant */
    skipLayers?: CompilationLayer[];
    /** Include storage metadata (only from introspection) */
    includeStorage?: boolean;
    /** Include replication info (only from introspection) */
    includeReplication?: boolean;
    /** Maximum depth for dependency graph traversal */
    maxDependencyDepth?: number;
    /** Sensitive table name patterns for security analysis */
    sensitiveTablePatterns?: string[];
    /** Custom schema search path */
    searchPath?: string[];
}

export const DEFAULT_COMPILE_OPTIONS: CompileOptions = {
    skipLayers: [],
    includeStorage: false,
    includeReplication: false,
    maxDependencyDepth: 10,
    sensitiveTablePatterns: [
        'user', 'account', 'profile', 'credential', 'secret',
        'token', 'session', 'payment', 'card', 'billing',
        'password', 'auth', 'permission', 'role',
    ],
    searchPath: ['public'],
};

// =============================================================================
// Progressive Loading Types (Optimization)
// =============================================================================

/**
 * Tier 1: Lightweight summary sent with EVERY request (~500-1,000 tokens)
 * Replaces the full CompilationResult in the initial agent request
 */
export interface CompilationSummary {
    overallScore: number;
    overallGrade: LetterGrade;
    totalObjects: number;
    totalIssues: number;
    schemaName: string;
    tableNames: string[];                          // Just names, not full objects
    viewNames: string[];
    functionNames: string[];
    issueCountsBySeverity: Record<IssueSeverity, number>;
    topLayerGrades: Array<{
        layer: CompilationLayer;
        grade: LetterGrade;
        objectCount: number;
        issueCount: number;
    }>;
    criticalIssuePreview: CompilationIssue[];      // Top 3 critical issues
    compilationHash: string;                       // For caching/dedup
    compiledAt: number;
}

/**
 * Tier 2: Layer metadata sent on demand (~2,000-5,000 tokens per layer)
 * Used when agent requests specific layer details
 */
export interface LayerMetadata {
    layer: CompilationLayer;
    label: string;
    objectCount: number;
    issueCount: number;
    criticalCount: number;
    warningCount: number;
    grade: LetterGrade;
    riskLevel: string;
    objectNames: string[];                         // Just names for discovery
    topIssues: CompilationIssue[];                 // Top 5 issues only
    summary: string;
}

/**
 * Tiered issues structure - prioritizes by severity
 * Prevents token explosion from low-severity issues
 */
export interface TieredIssues {
    critical: CompilationIssue[];                  // ALWAYS send all critical
    error: CompilationIssue[];                     // ALWAYS send all errors
    warning: CompilationIssue[];                   // Send top 10 only
    warningRemaining: number;                      // Count of truncated warnings
    suggestionCount: number;                       // Don't send details
    infoCount: number;                             // Don't send details
}

/**
 * Compilation cache entry for deduplication
 */
export interface CompilationCacheEntry {
    hash: string;
    summary: CompilationSummary;
    fullResult?: CompilationResult;                // Only kept if needed
    createdAt: number;
    accessCount: number;
}

/**
 * Delta update structure - only sends what changed
 */
export interface CompilationDelta {
    hash: string;
    previousHash: string;
    changedLayers: CompilationLayer[];
    newIssues: CompilationIssue[];
    resolvedIssueIds: string[];
    modifiedTableNames: string[];
    hasSchemaChanges: boolean;
}
