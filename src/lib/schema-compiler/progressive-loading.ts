/**
 * Schema Compiler - Progressive Loading Utilities
 * 
 * Extracts lightweight summaries, computes hashes, and manages
 * tiered compilation data to minimize token usage in agent requests.
 */

import type {
    CompilationResult,
    CompilationSummary,
    LayerMetadata,
    TieredIssues,
    CompilationCacheEntry,
    CompilationIssue,
    IssueSeverity,
    CompilationLayer,
} from './types';

// =============================================================================
// Hashing Utilities
// =============================================================================

/**
 * Compute a fast hash of a schema for compilation caching.
 * Uses a simple djb2 hash over the stringified schema structure.
 */
export function hashSchema(schema: unknown): string {
    // Exclude volatile fields that change on every parse but don't affect structure
    const stable = stripVolatileFields(schema as Record<string, unknown>);
    const str = JSON.stringify(stable);
    return djb2Hash(str).toString(36);
}

/**
 * Remove volatile fields from schema before hashing to maximize cache hits
 */
function stripVolatileFields(schema: Record<string, unknown>): Record<string, unknown> {
    const copy = { ...schema };
    // Remove fields that change on every parse regardless of SQL content
    delete copy.parseTime;
    delete copy.errors;    // Error objects may contain stack traces or timestamps
    delete copy.warnings;  // Warnings may contain timestamps
    // Convert Maps to arrays for stable serialization
    if (copy.enums instanceof Map) {
        copy.enums = Array.from(copy.enums.entries());
    }
    if (copy.stats) {
        const stats = copy.stats as Record<string, unknown>;
        if (stats.dataTypes instanceof Map) {
            stats.dataTypes = Array.from(stats.dataTypes.entries());
        }
    }
    return copy;
}

/**
 * Hash a compilation result for deduplication
 */
export function hashCompilation(result: CompilationResult): string {
    // Hash only structural data, not metadata
    const structural = {
        tables: result.tables.map(t => ({ name: t.name, schema: t.schema, columnCount: t.columnCount })),
        indexes: result.indexes.indexes.map(i => ({ name: i.name, table: i.table, columns: i.columns })),
        constraints: result.constraints.foreignKeys.map(fk => ({
            source: fk.sourceTable,
            target: fk.targetTable,
            columns: fk.sourceColumns,
        })),
        totalIssues: result.totalIssues,
        overallGrade: result.overallGrade,
    };
    return djb2Hash(JSON.stringify(structural)).toString(36);
}

/**
 * Simple DJB2 hash function for strings
 */
function djb2Hash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash | 0; // Force 32-bit signed integer
    }
    return Math.abs(hash);
}

// =============================================================================
// Summary Extraction (Tier 1)
// =============================================================================

/**
 * Extract a lightweight compilation summary (~500-1,000 tokens)
 * This is sent with EVERY agent request instead of the full CompilationResult
 */
export function extractCompilationSummary(result: CompilationResult): CompilationSummary {
    const issueCounts = countIssuesBySeverity(result.issues);
    const criticalIssues = result.issues.filter(i => i.severity === 'critical');
    
    return {
        overallScore: result.overallScore,
        overallGrade: result.overallGrade,
        totalObjects: result.totalObjects,
        totalIssues: result.totalIssues,
        schemaName: result.schemaName,
        tableNames: result.tables.map(t => t.name),
        viewNames: result.views.views.map(v => v.name),
        functionNames: result.functions.functions.map(f => f.name),
        issueCountsBySeverity: issueCounts,
        topLayerGrades: result.layerSummaries
            .filter(ls => ls.objectCount > 0 || ls.issueCount > 0)
            .map(ls => ({
                layer: ls.layer as CompilationLayer,
                grade: ls.grade,
                objectCount: ls.objectCount,
                issueCount: ls.issueCount,
            })),
        criticalIssuePreview: criticalIssues.slice(0, 3),  // Top 3 critical
        compilationHash: hashCompilation(result),
        compiledAt: result.compiledAt,
    };
}

/**
 * Count issues by severity
 */
function countIssuesBySeverity(issues: CompilationIssue[]): Record<IssueSeverity, number> {
    const counts: Record<string, number> = {
        critical: 0,
        error: 0,
        warning: 0,
        suggestion: 0,
        info: 0,
    };
    
    for (const issue of issues) {
        counts[issue.severity] = (counts[issue.severity] || 0) + 1;
    }
    
    return counts as Record<IssueSeverity, number>;
}

// =============================================================================
// Layer Metadata Extraction (Tier 2)
// =============================================================================

/**
 * Extract metadata for a specific layer (~2,000-5,000 tokens)
 * Sent on-demand when agent requests layer details
 */
export function extractLayerMetadata(result: CompilationResult, layer: CompilationLayer): LayerMetadata | null {
    const layerSummary = result.layerSummaries.find(ls => ls.layer === layer);
    if (!layerSummary) {
        return null;
    }
    
    const layerIssues = result.issues.filter(i => i.layer === layer);
    const topIssues = layerIssues.slice(0, 5);  // Top 5 issues only
    
    // Extract object names based on layer type
    let objectNames: string[] = [];
    switch (layer) {
        case 'table':
            objectNames = result.tables.map(t => t.name);
            break;
        case 'column':
            objectNames = [...new Set(result.columns.map(c => c.tableName))];
            break;
        case 'index':
            objectNames = result.indexes.indexes.map(i => i.name);
            break;
        case 'constraint':
            objectNames = result.constraints.foreignKeys.map(fk => fk.name || `${fk.sourceTable}_fk`);
            break;
        case 'rls':
            objectNames = result.rls.policies.map(p => p.table);
            break;
        case 'view':
            objectNames = result.views.views.map(v => v.name);
            break;
        case 'function':
            objectNames = result.functions.functions.map(f => f.name);
            break;
        case 'trigger':
            objectNames = result.triggers.triggers.map(t => t.name);
            break;
        case 'semantic':
            objectNames = result.semantic.symbolTable.slice(0, 50).map(s => s.name);
            break;
        case 'dependency':
            objectNames = result.dependencies.nodes.slice(0, 50).map(n => n.name);
            break;
        default:
            objectNames = [];
    }
    
    return {
        layer: layerSummary.layer as CompilationLayer,
        label: layerSummary.label,
        objectCount: layerSummary.objectCount,
        issueCount: layerSummary.issueCount,
        criticalCount: layerSummary.criticalCount,
        warningCount: layerSummary.warningCount,
        grade: layerSummary.grade,
        riskLevel: layerSummary.riskLevel,
        objectNames,
        topIssues,
        summary: `${layerSummary.label}: Grade ${layerSummary.grade}, ${layerSummary.issueCount} issues across ${layerSummary.objectCount} objects`,
    };
}

// =============================================================================
// Tiered Issues Extraction
// =============================================================================

/**
 * Extract tiered issues structure - prioritizes by severity
 * Prevents token explosion from low-severity issues
 */
export function extractTieredIssues(result: CompilationResult): TieredIssues {
    const bySeverity = groupIssuesBySeverity(result.issues);
    const maxWarnings = 10;  // Limit warnings to top 10
    
    return {
        critical: bySeverity.critical,              // ALL critical issues
        error: bySeverity.error,                    // ALL error issues
        warning: bySeverity.warning.slice(0, maxWarnings),  // Top 10 warnings
        warningRemaining: Math.max(0, bySeverity.warning.length - maxWarnings),
        suggestionCount: bySeverity.suggestion.length,
        infoCount: bySeverity.info.length,
    };
}

/**
 * Group issues by severity level
 */
function groupIssuesBySeverity(issues: CompilationIssue[]): Record<IssueSeverity, CompilationIssue[]> {
    const grouped: Record<string, CompilationIssue[]> = {
        critical: [],
        error: [],
        warning: [],
        suggestion: [],
        info: [],
    };
    
    for (const issue of issues) {
        if (!grouped[issue.severity]) {
            grouped[issue.severity] = [];
        }
        grouped[issue.severity].push(issue);
    }
    
    // Sort each group by riskScore (highest first)
    for (const severity of Object.keys(grouped)) {
        grouped[severity].sort((a, b) => b.riskScore - a.riskScore);
    }
    
    return grouped as Record<IssueSeverity, CompilationIssue[]>;
}

// =============================================================================
// Compilation Cache
// =============================================================================

/**
 * Simple in-memory cache for compilation results
 */
class CompilationCache {
    private store: Map<string, CompilationCacheEntry> = new Map();
    private readonly MAX_ENTRIES = 10;  // Prevent memory bloat
    
    /**
     * Get cached entry by hash
     */
    get(hash: string): CompilationCacheEntry | null {
        const entry = this.store.get(hash);
        if (entry) {
            entry.accessCount++;
            return entry;
        }
        return null;
    }
    
    /**
     * Cache a compilation result
     */
    set(result: CompilationResult): CompilationCacheEntry {
        const hash = hashCompilation(result);
        const existing = this.store.get(hash);
        
        if (existing) {
            existing.accessCount++;
            return existing;
        }
        
        const entry: CompilationCacheEntry = {
            hash,
            summary: extractCompilationSummary(result),
            fullResult: result,  // Keep full result for on-demand access
            createdAt: Date.now(),
            accessCount: 1,
        };
        
        this.store.set(hash, entry);
        this.evictIfNecessary();
        
        return entry;
    }
    
    /**
     * Check if a hash exists
     */
    has(hash: string): boolean {
        return this.store.has(hash);
    }
    
    /**
     * Evict least-used entries if cache is too large
     */
    private evictIfNecessary(): void {
        if (this.store.size > this.MAX_ENTRIES) {
            // Find entry with lowest access count
            let minAccess = Infinity;
            let minKey: string | null = null;
            
            for (const [key, entry] of this.store.entries()) {
                if (entry.accessCount < minAccess) {
                    minAccess = entry.accessCount;
                    minKey = key;
                }
            }
            
            if (minKey) {
                this.store.delete(minKey);
            }
        }
    }
    
    /**
     * Clear the cache
     */
    clear(): void {
        this.store.clear();
    }
    
    /**
     * Get cache statistics
     */
    stats(): { size: number; maxEntries: number } {
        return {
            size: this.store.size,
            maxEntries: this.MAX_ENTRIES,
        };
    }
}

// Singleton cache instance
export const compilationCache = new CompilationCache();

// =============================================================================
// Delta Computation
// =============================================================================

/**
 * Compute delta between two compilation results
 * Only sends what changed - useful for incremental updates
 */
export function computeCompilationDelta(
    previous: CompilationResult,
    current: CompilationResult,
): { delta: CompilationDelta; hasChanges: boolean } {
    const previousTables = new Set(previous.tables.map(t => t.name));
    const currentTables = new Set(current.tables.map(t => t.name));
    
    const modifiedTableNames = [...new Set([
        ...detectModifiedTables(previous.tables, current.tables),
        ...[...currentTables].filter(t => !previousTables.has(t)),  // New tables
    ])];
    
    const newIssues = detectNewIssues(previous.issues, current.issues);
    const resolvedIssueIds = detectResolvedIssues(previous.issues, current.issues);
    
    const changedLayers = detectChangedLayers(previous, current);
    
    const delta = {
        hash: hashCompilation(current),
        previousHash: hashCompilation(previous),
        changedLayers,
        newIssues,
        resolvedIssueIds,
        modifiedTableNames,
        hasSchemaChanges: modifiedTableNames.length > 0 || newIssues.length > 0,
    };
    
    return {
        delta,
        hasChanges: delta.hasSchemaChanges,
    };
}

/**
 * Detect which tables have changed
 */
function detectModifiedTables(
    previous: CompilationResult['tables'],
    current: CompilationResult['tables'],
): string[] {
    const modified: string[] = [];
    
    for (const currTable of current) {
        const prevTable = previous.find(t => t.name === currTable.name);
        if (!prevTable) continue;
        
        // Check if table structure changed
        if (
            prevTable.columnCount !== currTable.columnCount ||
            prevTable.indexCount !== currTable.indexCount ||
            prevTable.inboundFKCount !== currTable.inboundFKCount ||
            prevTable.outboundFKCount !== currTable.outboundFKCount
        ) {
            modified.push(currTable.name);
        }
    }
    
    return modified;
}

/**
 * Detect new issues
 */
function detectNewIssues(
    previous: CompilationIssue[],
    current: CompilationIssue[],
): CompilationIssue[] {
    const previousIds = new Set(previous.map(i => i.id));
    return current.filter(issue => !previousIds.has(issue.id));
}

/**
 * Detect resolved issues (existed before, gone now)
 */
function detectResolvedIssues(
    previous: CompilationIssue[],
    current: CompilationIssue[],
): string[] {
    const currentIds = new Set(current.map(i => i.id));
    return previous.filter(issue => !currentIds.has(issue.id)).map(i => i.id);
}

/**
 * Detect which layers have changed
 */
function detectChangedLayers(
    previous: CompilationResult,
    current: CompilationResult,
): CompilationLayer[] {
    const changed: CompilationLayer[] = [];
    
    // Check table layer
    if (previous.tables.length !== current.tables.length) {
        changed.push('table');
    }
    
    // Check index layer
    if (previous.indexes.indexes.length !== current.indexes.indexes.length) {
        changed.push('index');
    }
    
    // Check constraint layer
    if (previous.constraints.foreignKeys.length !== current.constraints.foreignKeys.length) {
        changed.push('constraint');
    }
    
    // Check if issue counts changed per layer
    const layers = new Set([
        ...previous.issues.map(i => i.layer),
        ...current.issues.map(i => i.layer),
    ]);
    
    for (const layer of layers) {
        const prevIssues = previous.issues.filter(i => i.layer === layer).length;
        const currIssues = current.issues.filter(i => i.layer === layer).length;
        
        if (prevIssues !== currIssues) {
            if (!changed.includes(layer as CompilationLayer)) {
                changed.push(layer as CompilationLayer);
            }
        }
    }
    
    return changed;
}

// =============================================================================
// Size Estimation (for token budgeting)
// =============================================================================

/**
 * Estimate token count for a compilation result
 * Rule of thumb: 1 token ≈ 4 characters for English text
 */
export function estimateTokenCount(result: CompilationResult): number {
    const jsonSize = JSON.stringify(result).length;
    return Math.ceil(jsonSize / 4);
}

/**
 * Estimate token count for a summary
 */
export function estimateSummaryTokenCount(summary: CompilationSummary): number {
    const jsonSize = JSON.stringify(summary).length;
    return Math.ceil(jsonSize / 4);
}

/**
 * Estimate token count for tiered issues
 */
export function estimateTieredIssuesTokenCount(tiered: TieredIssues): number {
    const jsonSize = JSON.stringify(tiered).length;
    return Math.ceil(jsonSize / 4);
}
