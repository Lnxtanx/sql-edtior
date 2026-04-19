/**
 * Schema Compiler — Main Engine
 * 
 * Orchestrates all 20 compilation layers to produce a unified CompilationResult.
 * Entry point: compileSchema(schema, options?)
 */

import type { ParsedSchema } from '@/lib/sql-parser';
import type {
    CompilationResult, CompilationIssue, CompileOptions,
    LayerSummary, CompilationLayer, LetterGrade,
    DatabaseCompilation, SchemaCompilation,
    StorageCompilation, ReplicationCompilation, ExtensionCompilation,
} from './types';
import { DEFAULT_COMPILE_OPTIONS } from './types';

// Import all compilers
import { compileTables } from './compilers/table-compiler';
import { compileColumns } from './compilers/column-compiler';
import { compileConstraints } from './compilers/constraint-compiler';
import { compileIndexes } from './compilers/index-compiler';
import { compileTypes } from './compilers/type-compiler';
import { compileViews } from './compilers/view-compiler';
import { compileFunctions } from './compilers/function-compiler';
import { compileTriggers } from './compilers/trigger-compiler';
import { compileRLS } from './compilers/rls-compiler';
import { compilePrivileges } from './compilers/privilege-compiler';
import { compilePartitions } from './compilers/partition-compiler';
import { compileSequences } from './compilers/sequence-compiler';
import { compileExtensions } from './compilers/extension-compiler';
import { compileDependencies } from './compilers/dependency-compiler';
import { compileSemantic } from './compilers/semantic-compiler';
import { compileMetrics } from './compilers/metrics-compiler';

/**
 * Compile a ParsedSchema into a full CompilationResult with all 20 layers.
 */
export function compileSchema(
    schema: ParsedSchema,
    options: CompileOptions = {},
): CompilationResult {
    const start = performance.now();
    const opts = { ...DEFAULT_COMPILE_OPTIONS, ...options };
    const skip = new Set(opts.skipLayers || []);

    const allIssues: CompilationIssue[] = [];

    // --- Layer 1: Database (metadata from introspection, stub for SQL editor) ---
    const database: DatabaseCompilation = compileDatabaseLayer(schema);

    // --- Layer 2: Schemas ---
    const schemas: SchemaCompilation[] = compileSchemaLayer(schema);

    // --- Layer 3: Tables ---
    const tableResult = skip.has('table') ? { tables: [], issues: [] } : compileTables(schema);
    allIssues.push(...tableResult.issues);

    // --- Layer 4: Columns ---
    const columnResult = skip.has('column') ? { columns: [], issues: [] } : compileColumns(schema);
    allIssues.push(...columnResult.issues);

    // --- Layer 5: Types ---
    const typeResult = skip.has('type') ? { types: { enums: [], domains: [], compositeTypes: [], rangeTypes: [], unusedEnums: [], domainConstraintConflicts: [], duplicateEnumSemantics: [], typeDependencyEdges: [] }, issues: [] } : compileTypes(schema);
    allIssues.push(...typeResult.issues);

    // --- Layer 6: Constraints ---
    const constraintResult = skip.has('constraint') ? { constraints: { primaryKeys: [], foreignKeys: [], uniqueConstraints: [], checkConstraints: [], exclusionConstraints: [], fkWithoutIndex: [], multiColumnUniquenessIssues: [], constraintCycles: [], invalidConstraints: [], deferredIntegrityRisks: [] }, issues: [] } : compileConstraints(schema);
    allIssues.push(...constraintResult.issues);

    // --- Layer 7: Indexes ---
    const indexResult = skip.has('index') ? { indexes: { indexes: [], duplicateIndexes: [], redundantIndexes: [], missingIndexSuggestions: [], fkNotIndexed: [], expressionIndexes: [], partialIndexes: [] }, issues: [] } : compileIndexes(schema);
    allIssues.push(...indexResult.issues);

    // --- Layer 8: Partitions ---
    const partitionResult = skip.has('partition') ? { partitions: { trees: [], orphanPartitions: [], totalPartitionedTables: 0, totalPartitions: 0 }, issues: [] } : compilePartitions(schema);
    allIssues.push(...partitionResult.issues);

    // --- Layer 9: Views ---
    const viewResult = skip.has('view') ? { views: { views: [], materializedViews: [], brokenReferences: [], circularViewDeps: [], volatileFunctionDeps: [], unindexedMaterializedViews: [], viewDepthMap: new Map() }, issues: [] } : compileViews(schema);
    allIssues.push(...viewResult.issues);

    // --- Layer 10: Functions ---
    const functionResult = skip.has('function') ? { functions: { functions: [], procedures: [], unsafeSecurityDefiners: [], volatileInIndex: [], unusedFunctions: [], recursiveFunctions: [], functionDependencyTree: [] }, issues: [] } : compileFunctions(schema);
    allIssues.push(...functionResult.issues);

    // --- Layer 11: Triggers ---
    const triggerResult = skip.has('trigger') ? { triggers: { triggers: [], orderingConflicts: [], partitionedParentTriggers: [], missingTriggerFunctions: [], disabledTriggers: [], highDensityTables: [] }, issues: [] } : compileTriggers(schema);
    allIssues.push(...triggerResult.issues);

    // --- Layer 12: RLS ---
    const rlsResult = skip.has('rls') ? { rls: { policies: [], enabledWithoutPolicies: [], overPermissivePolicies: [], policyConflicts: [], sensitiveSansRLS: [], coverage: { totalTables: 0, tablesWithRLS: 0, tablesWithoutRLS: 0, coveragePercent: 0, sensitiveTables: 0, sensitiveTablesWithRLS: 0 } }, issues: [] } : compileRLS(schema);
    allIssues.push(...rlsResult.issues);

    // --- Layer 13: Privileges ---
    const privilegeResult = skip.has('privilege') ? { privileges: { grants: [], risks: [], publicSchemaWritable: false, superuserFunctions: [], exposureScore: 0 }, issues: [] } : compilePrivileges(schema);
    allIssues.push(...privilegeResult.issues);

    // --- Layer 14: Sequences ---
    const sequenceResult = skip.has('sequence') ? { sequences: { sequences: [], orphanSequences: [], sharedSequences: [], totalSequences: 0 }, issues: [] } : compileSequences(schema);
    allIssues.push(...sequenceResult.issues);

    // --- Layer 15: Extensions ---
    const extensionResult = skip.has('extension') ? { extensions: [] as ExtensionCompilation[], issues: [] as CompilationIssue[] } : compileExtensions(schema);
    allIssues.push(...extensionResult.issues);

    // --- Layer 16: Dependencies ---
    const dependencyResult = skip.has('dependency') ? { dependencies: { nodes: [], edges: [], cycles: [], centrality: [], cascadeChains: [], totalNodes: 0, totalEdges: 0 }, issues: [] } : compileDependencies(schema);
    allIssues.push(...dependencyResult.issues);

    // --- Layer 17: Storage (introspection-only) ---
    const storage: StorageCompilation = compileStorageStub();

    // --- Layer 18: Replication (introspection-only) ---
    const replication: ReplicationCompilation = compileReplicationStub();

    // --- Layer 19: Semantic ---
    const semanticResult = skip.has('semantic') ? { semantic: { symbolTable: [], unresolvedReferences: [], shadowedNames: [], typeDrift: [], namingAnomalies: [], crossSchemaCoupling: [], totalSymbols: 0 }, issues: [] } : compileSemantic(schema);
    allIssues.push(...semanticResult.issues);

    // --- Layer 20: Metrics (aggregates all prior issues) ---
    const metricsResult = skip.has('metrics') ? { metrics: { objectCounts: { tables: 0, views: 0, functions: 0, triggers: 0, indexes: 0, sequences: 0, policies: 0, extensions: 0, columns: 0, relationships: 0, enums: 0, domains: 0, compositeTypes: 0, schemas: 0 }, densityMetrics: {} as any, qualityScores: {} as any, issueDistribution: { bySeverity: { error: 0, warning: 0, info: 0 }, byLayer: {}, totalIssues: 0 }, readinessScore: 0, overallGrade: 'F' as LetterGrade }, issues: [] } : compileMetrics(schema, allIssues);
    allIssues.push(...metricsResult.issues);

    // --- Compute Layer Summaries ---
    const layerSummaries = buildLayerSummaries(allIssues, {
        table: tableResult.tables?.length || 0,
        column: columnResult.columns?.length || 0,
        type: (typeResult.types?.enums?.length || 0) + (typeResult.types?.domains?.length || 0) + (typeResult.types?.compositeTypes?.length || 0),
        constraint: (constraintResult.constraints?.primaryKeys?.length || 0) + (constraintResult.constraints?.foreignKeys?.length || 0) + (constraintResult.constraints?.uniqueConstraints?.length || 0) + (constraintResult.constraints?.checkConstraints?.length || 0),
        index: indexResult.indexes?.indexes?.length || 0,
        partition: partitionResult.partitions?.totalPartitions || 0,
        view: viewResult.views?.views?.length || 0,
        function: functionResult.functions?.functions?.length || 0,
        trigger: triggerResult.triggers?.triggers?.length || 0,
        rls: rlsResult.rls?.policies?.length || 0,
        privilege: privilegeResult.privileges?.grants?.length || 0,
        sequence: sequenceResult.sequences?.sequences?.length || 0,
        extension: extensionResult.extensions?.length || 0,
        dependency: dependencyResult.dependencies?.totalNodes || 0,
        semantic: semanticResult.semantic?.totalSymbols || 0,
        metrics: 0,
        database: 1,
        schema: schemas.length,
        storage: 0,
        replication: 0,
    });

    const totalObjects = layerSummaries.reduce((sum, s) => sum + s.objectCount, 0);
    const compilationTime = performance.now() - start;

    const overallScore = metricsResult.metrics?.readinessScore ?? 0;
    const overallGrade = metricsResult.metrics?.overallGrade ?? scoreToGrade(overallScore);

    return {
        compiledAt: Date.now(),
        compilationTime,
        sourceType: 'sql_editor',
        schemaName: schema.schemas[0] || 'public',

        database,
        schemas,
        tables: tableResult.tables || [],
        columns: columnResult.columns || [],
        types: typeResult.types,
        constraints: constraintResult.constraints,
        indexes: indexResult.indexes,
        partitions: partitionResult.partitions,
        views: viewResult.views,
        functions: functionResult.functions,
        triggers: triggerResult.triggers,
        rls: rlsResult.rls,
        privileges: privilegeResult.privileges,
        sequences: sequenceResult.sequences,
        extensions: extensionResult.extensions || [],
        dependencies: dependencyResult.dependencies,
        storage,
        replication,
        semantic: semanticResult.semantic,
        metrics: metricsResult.metrics,

        issues: allIssues,
        layerSummaries,
        overallScore,
        overallGrade,
        totalObjects,
        totalIssues: allIssues.length,
    };
}

// =============================================================================
// Internal Helpers
// =============================================================================

function compileDatabaseLayer(schema: ParsedSchema): DatabaseCompilation {
    return {
        name: undefined,
        owner: undefined,
        encoding: undefined,
        collation: undefined,
        ctype: undefined,
        tablespace: undefined,
        serverVersion: undefined,
        systemIdentifier: undefined,
        searchPath: schema.schemas.length > 0 ? schema.schemas : ['public'],
        extensions: [],
    };
}

function compileSchemaLayer(schema: ParsedSchema): SchemaCompilation[] {
    const schemaNames = schema.schemas.length > 0 ? schema.schemas : ['public'];
    return schemaNames.map(name => {
        const tablesInSchema = schema.tables.filter(t => (t.schema || 'public') === name);
        const viewsInSchema = schema.views.filter(v => (v.schema || 'public') === name);
        const funcsInSchema = schema.functions.filter(f => (f.schema || 'public') === name);
        const seqsInSchema = schema.sequences.filter(s => (s.schema || 'public') === name);
        const idxInSchema = schema.indexes.filter(i => {
            const table = schema.tables.find(t => t.name === i.table);
            return (table?.schema || 'public') === name;
        });
        const triggersInSchema = schema.triggers.filter(t => (t.schema || 'public') === name);
        const policiesInSchema = schema.policies.filter(p => {
            const table = schema.tables.find(t => t.name === p.table);
            return (table?.schema || 'public') === name;
        });

        return {
            name,
            objectCounts: {
                tables: tablesInSchema.length,
                views: viewsInSchema.length,
                functions: funcsInSchema.length,
                sequences: seqsInSchema.length,
                types: schema.enumTypes.filter(e => (e.schema || 'public') === name).length +
                    schema.domains.filter(d => (d.schema || 'public') === name).length +
                    schema.compositeTypes.filter(c => (c.schema || 'public') === name).length,
                indexes: idxInSchema.length,
                triggers: triggersInSchema.length,
                policies: policiesInSchema.length,
            },
            crossSchemaDependencies: [],
            publicExposureRisks: [],
        };
    });
}

function compileStorageStub(): StorageCompilation {
    return {
        totalSize: undefined,
        tableSizes: [],
        indexSizes: [],
        tablespaces: [],
    };
}

function compileReplicationStub(): ReplicationCompilation {
    return {
        publicationTables: [],
        subscriptions: [],
        logicalSlots: [],
    };
}

const LAYER_LABELS: Record<CompilationLayer, { label: string; icon: string }> = {
    database: { label: 'Database', icon: 'database' },
    schema: { label: 'Schemas', icon: 'layers' },
    table: { label: 'Tables', icon: 'table' },
    column: { label: 'Columns', icon: 'columns' },
    type: { label: 'Types', icon: 'tag' },
    constraint: { label: 'Constraints', icon: 'lock' },
    index: { label: 'Indexes', icon: 'search' },
    partition: { label: 'Partitions', icon: 'grid' },
    view: { label: 'Views', icon: 'eye' },
    function: { label: 'Functions', icon: 'code' },
    trigger: { label: 'Triggers', icon: 'zap' },
    rls: { label: 'Row Security', icon: 'shield' },
    privilege: { label: 'Privileges', icon: 'key' },
    sequence: { label: 'Sequences', icon: 'hash' },
    extension: { label: 'Extensions', icon: 'puzzle' },
    dependency: { label: 'Dependencies', icon: 'git-branch' },
    storage: { label: 'Storage', icon: 'hard-drive' },
    replication: { label: 'Replication', icon: 'refresh-cw' },
    semantic: { label: 'Semantic', icon: 'brain' },
    metrics: { label: 'Metrics', icon: 'bar-chart-2' },
};

function buildLayerSummaries(
    issues: CompilationIssue[],
    objectCounts: Record<CompilationLayer, number>,
): LayerSummary[] {
    const layers: CompilationLayer[] = [
        'database', 'schema', 'table', 'column', 'type', 'constraint',
        'index', 'partition', 'view', 'function', 'trigger', 'rls',
        'privilege', 'sequence', 'extension', 'dependency', 'storage',
        'replication', 'semantic', 'metrics',
    ];

    return layers.map(layer => {
        const layerIssues = issues.filter(i => i.layer === layer);
        const criticalCount = layerIssues.filter(i => i.severity === 'critical' || i.severity === 'error').length;
        const warningCount = layerIssues.filter(i => i.severity === 'warning').length;
        const info = LAYER_LABELS[layer];

        let riskLevel: LayerSummary['riskLevel'] = 'none';
        if (criticalCount >= 3) riskLevel = 'critical';
        else if (criticalCount >= 1) riskLevel = 'high';
        else if (warningCount >= 5) riskLevel = 'high';
        else if (warningCount >= 2) riskLevel = 'medium';
        else if (warningCount >= 1 || layerIssues.length >= 3) riskLevel = 'low';

        const issueScore = Math.max(0, 100 - (criticalCount * 20) - (warningCount * 5) - (layerIssues.length * 2));

        return {
            layer,
            label: info.label,
            icon: info.icon,
            objectCount: objectCounts[layer] || 0,
            issueCount: layerIssues.length,
            criticalCount,
            warningCount,
            riskLevel,
            grade: scoreToGrade(issueScore),
        };
    });
}

function scoreToGrade(score: number): LetterGrade {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
}

// Re-export types and compiler options
export type { CompilationResult, CompilationIssue, CompileOptions, LayerSummary, CompilationLayer, LetterGrade } from './types';
export { DEFAULT_COMPILE_OPTIONS } from './types';

// Export progressive loading utilities
export {
    extractCompilationSummary,
    extractLayerMetadata,
    extractTieredIssues,
    hashCompilation,
    hashSchema,
    computeCompilationDelta,
    compilationCache,
    estimateTokenCount,
    estimateSummaryTokenCount,
    estimateTieredIssuesTokenCount,
} from './progressive-loading';
export type {
    CompilationSummary,
    LayerMetadata,
    TieredIssues,
    CompilationCacheEntry,
    CompilationDelta,
} from './types';
