/**
 * SqlDiffPanel
 *
 * Full panel wrapper for the SQL diff viewer.
 * Includes connection selector, "Compare" button, diff stats header, and the viewer.
 * Works as a sidebar view alongside editor, ai, connect, graph, compiler.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    X, GitCompareArrows, Loader2, Database,
    Plus, Minus, RefreshCw, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SqlDiffViewer } from './SqlDiffViewer';
import { ConnectionSelector } from '@/components/connection/panel/ConnectionSelector';
import { useConnections } from '@/components/connection/hooks';
import { useProjectConnection } from '@/components/connection/hooks/useProjectConnection';
import { diffSchema } from '@/lib/api/connection/schema';
import { useCurrentFile } from '@/components/connection/CurrentFileContext';
import type { SchemaDiff } from '@/lib/api/connection/types';

// ============================================================================
// Types
// ============================================================================

/** Atlas diff summary as returned by parseAtlasDiffSummary */
interface AtlasSummary {
    totalChanges: number;
    destructiveChanges: number;
    safeChanges: number;
    creates: number;
    alters: number;
    drops: number;
}

/** Normalised result that works for both Atlas and legacy modes */
export interface DiffResult {
    liveSql: string;
    /** Legacy structured diff (absent in Atlas mode) */
    diff?: SchemaDiff;
    liveSchema?: any;
    /** Atlas migration SQL (absent in legacy mode) */
    migrationSql?: string;
    /** Atlas summary (absent in legacy mode) */
    atlasSummary?: AtlasSummary;
    /** True when Atlas reports no changes */
    isEmpty?: boolean;
}

interface SqlDiffPanelProps {
    onClose: () => void;
    /** Raw SQL from the editor (used as right side of diff) */
    editorSql?: string;
    /** Pre-loaded diff result (e.g. from terminal `sw diff`) */
    initialDiff?: DiffResult | null;
}

// ============================================================================
// Main Panel
// ============================================================================

export function SqlDiffPanel({ onClose, editorSql = '', initialDiff = null }: SqlDiffPanelProps) {
    const { schema, sql: fileSql, mergedSql, connectionId: fileLinkedConnectionId, projectId } = useCurrentFile();
    const { linkedConnectionId: projectConnectionId } = useProjectConnection(projectId ?? null);
    // Project connection takes priority over file-level connection
    const linkedConnectionId = projectConnectionId || fileLinkedConnectionId;
    const { data: connections } = useConnections();
    // Auto-select the linked connection so the user doesn't have to pick it every time
    const [selectedId, setSelectedId] = useState<string | null>(linkedConnectionId ?? null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [diffResult, setDiffResult] = useState<DiffResult | null>(initialDiff);
    const [diffLayout, setDiffLayout] = useState<'split' | 'unified'>('unified');

    const selectedConnection = connections?.find((c: any) => c.id === selectedId);

    // Auto-select when project connection loads asynchronously
    useEffect(() => {
        if (linkedConnectionId && !selectedId) {
            setSelectedId(linkedConnectionId);
        }
    }, [linkedConnectionId]);

    // ─── Run diff ────────────────────────────────────────────────────────────

    const handleRunDiff = useCallback(async () => {
        // Prefer mergedSql (the whole project) over raw single-file SQL (Atlas) over structured schema (legacy)
        const payload = mergedSql?.trim() ? mergedSql : fileSql?.trim() ? fileSql : schema;
        if (!selectedId || !payload) return;

        setIsLoading(true);
        setError(null);

        try {
            const result = await diffSchema(selectedId, payload);

            if (!result.success) {
                setError('Failed to fetch diff from server.');
                return;
            }

            // Atlas response: migrationSql + summary + liveSql
            if (result.migrationSql !== undefined || result.isEmpty !== undefined) {
                setDiffResult({
                    liveSql: result.liveSql || '-- Unable to compile live schema',
                    migrationSql: result.migrationSql,
                    atlasSummary: result.summary,
                    isEmpty: result.isEmpty,
                });
                return;
            }

            // Legacy response: diff + liveSchema + liveSql
            setDiffResult({
                liveSql: result.liveSql || '-- Unable to compile live schema',
                diff: result.diff,
                liveSchema: result.liveSchema,
            });
        } catch (e: any) {
            setError(e.message || 'Diff failed');
        } finally {
            setIsLoading(false);
        }
    }, [selectedId, schema, fileSql]);

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <PanelHeader
                onClose={onClose}
                diffResult={diffResult}
                isLoading={isLoading}
            />

            {/* Connection Selector + Action */}
            <div className="px-3 py-2 border-b border-border flex items-center gap-2">
                <div className="flex-1 min-w-0">
                    <ConnectionSelector
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        linkedConnectionId={linkedConnectionId ?? null}
                    />
                </div>

                {/* Layout Toggle */}
                {diffResult && (
                    <div className="flex bg-muted/60 p-0.5 rounded-md border border-border shrink-0 ml-1 mr-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn('h-6 px-2.5 text-[10px] font-medium transition-all', diffLayout === 'unified' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground')}
                            onClick={() => setDiffLayout('unified')}
                        >
                            Unified
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn('h-6 px-2.5 text-[10px] font-medium transition-all', diffLayout === 'split' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground')}
                            onClick={() => setDiffLayout('split')}
                        >
                            Split
                        </Button>
                    </div>
                )}

                <Button
                    size="sm"
                    className="h-7 text-[10px] gap-1.5 shrink-0"
                    onClick={handleRunDiff}
                    disabled={!selectedId || (!schema && !fileSql) || isLoading}
                >
                    {isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                        <GitCompareArrows className="w-3 h-3" />
                    )}
                    {diffResult ? 'Re-compare' : 'Compare'}
                </Button>
            </div>

            {/* Error */}
            {error && (
                <div className="px-3 py-2 text-[10px] text-red-600 bg-red-50 dark:bg-red-900/20 border-b border-red-200">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    {error}
                </div>
            )}

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {diffResult ? (
                    <DiffContent diffResult={diffResult} editorSql={editorSql} layout={diffLayout} />
                ) : (
                    <EmptyState
                        hasConnection={!!selectedId}
                        hasSchema={!!schema || !!fileSql}
                        isLoading={isLoading}
                    />
                )}
            </div>
        </div>
    );
}

// ============================================================================
// Panel Header
// ============================================================================

function PanelHeader({
    onClose,
    diffResult,
    isLoading,
}: {
    onClose: () => void;
    diffResult: DiffResult | null;
    isLoading: boolean;
}) {
    // Derive totalChanges and destructiveChanges from whichever mode is active
    const totalChanges = diffResult?.atlasSummary
        ? diffResult.atlasSummary.totalChanges
        : diffResult?.diff?.summary?.totalChanges ?? null;
    const destructiveChanges = diffResult?.atlasSummary
        ? diffResult.atlasSummary.destructiveChanges
        : diffResult?.diff?.summary?.destructiveChanges ?? 0;
    const isEmpty = diffResult?.isEmpty ?? (totalChanges === 0);

    return (
        <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/40">
            <div className="flex items-center gap-2">
                <GitCompareArrows className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-medium">Schema Diff</span>
                {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                {diffResult && !isLoading && totalChanges !== null && (
                    <>
                        {isEmpty ? (
                            <Badge variant="outline" className="text-[9px] px-1.5 h-4 bg-green-50 text-green-700 border-green-200">
                                In Sync
                            </Badge>
                        ) : (
                            <>
                                <Badge variant="outline" className="text-[9px] px-1.5 h-4">
                                    {totalChanges} changes
                                </Badge>
                                {destructiveChanges > 0 && (
                                    <Badge variant="outline" className="text-[9px] px-1.5 h-4 bg-red-50 text-red-700 border-red-200">
                                        {destructiveChanges} destructive
                                    </Badge>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={onClose}>
                <X className="w-3 h-3" />
            </Button>
        </div>
    );
}

// ============================================================================
// Diff Content — Stats bar + Viewer
// ============================================================================

function DiffContent({ diffResult, editorSql, layout }: { diffResult: DiffResult; editorSql: string; layout: 'split' | 'unified' }) {
    // ── Atlas mode: use atlasSummary ─────────────────────────────────────────
    if (diffResult.atlasSummary !== undefined) {
        const summary = diffResult.atlasSummary!;

        if (diffResult.isEmpty || summary.totalChanges === 0) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full">
                    <CheckCircle2 className="w-10 h-10 mb-3 text-green-500/40" />
                    <p className="text-sm font-medium text-green-700">Schemas are in sync</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                        No differences found between local file and live database.
                    </p>
                </div>
            );
        }

        return (
            <div className="flex flex-col h-full">
                {/* Atlas stats strip */}
                <AtlasDiffStatsBar summary={summary} />

                {/* Enhanced Side labels / Legend */}
                <div className="flex border-b border-border text-[10px]">
                    <div className="flex-1 px-3 py-1.5 border-r border-border flex items-center gap-1.5 bg-red-50/30 dark:bg-red-900/10">
                        <Database className="w-3 h-3 text-red-500" />
                        <span className="font-semibold text-red-700 dark:text-red-400">Live Database</span>
                        <span className="text-muted-foreground ml-auto opacity-70">Removed</span>
                    </div>
                    <div className="flex-1 px-3 py-1.5 flex items-center gap-1.5 bg-green-50/30 dark:bg-green-900/10">
                        <Database className="w-3 h-3 text-green-500" />
                        <span className="font-semibold text-green-700 dark:text-green-400">Local File</span>
                        <span className="text-muted-foreground ml-auto opacity-70">Added</span>
                    </div>
                </div>

                {/* Diff viewer */}
                <div className="flex-1 min-h-0 bg-background">
                    <SqlDiffViewer original={diffResult.liveSql} modified={editorSql} layout={layout} />
                </div>
            </div>
        );
    }

    // ── Legacy mode: use structured diff ─────────────────────────────────────
    const { diff, liveSql } = diffResult;
    const summary = diff!.summary;

    if (summary.totalChanges === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full">
                <CheckCircle2 className="w-10 h-10 mb-3 text-green-500/40" />
                <p className="text-sm font-medium text-green-700">Schemas are in sync</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                    No differences found between local file and live database.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Stats strip */}
            <DiffStatsBar diff={diff!} />

            {/* Enhanced Side labels / Legend */}
            <div className="flex border-b border-border text-[10px]">
                <div className="flex-1 px-3 py-1.5 border-r border-border flex items-center gap-1.5 bg-red-50/30 dark:bg-red-900/10">
                    <Database className="w-3 h-3 text-red-500" />
                    <span className="font-semibold text-red-700 dark:text-red-400">Live Database</span>
                    <span className="text-muted-foreground ml-auto opacity-70">Removed</span>
                </div>
                <div className="flex-1 px-3 py-1.5 flex items-center gap-1.5 bg-green-50/30 dark:bg-green-900/10">
                    <Database className="w-3 h-3 text-green-500" />
                    <span className="font-semibold text-green-700 dark:text-green-400">Local File</span>
                    <span className="text-muted-foreground ml-auto opacity-70">Added</span>
                </div>
            </div>

            {/* Diff viewer */}
            <div className="flex-1 min-h-0 bg-background">
                <SqlDiffViewer original={liveSql} modified={editorSql} layout={layout} />
            </div>
        </div>
    );
}

// ============================================================================
// Diff Stats Bar
// ============================================================================

function DiffStatsBar({ diff }: { diff: SchemaDiff }) {
    const stats = useMemo(() => {
        const added = diff.tables.added.length + diff.columns.added.length +
            (diff.enums?.added?.length || 0) + (diff.indexes?.added?.length || 0);
        const removed = diff.tables.removed.length + diff.columns.removed.length +
            (diff.enums?.removed?.length || 0) + (diff.indexes?.removed?.length || 0);
        const modified = diff.columns.modified.length + (diff.enums?.modified?.length || 0);
        return { added, removed, modified };
    }, [diff]);

    return (
        <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-muted/20 text-[9px]">
            {stats.added > 0 && (
                <span className="flex items-center gap-0.5 text-green-700">
                    <Plus className="w-2.5 h-2.5" />
                    {stats.added} added
                </span>
            )}
            {stats.removed > 0 && (
                <span className="flex items-center gap-0.5 text-red-600">
                    <Minus className="w-2.5 h-2.5" />
                    {stats.removed} removed
                </span>
            )}
            {stats.modified > 0 && (
                <span className="flex items-center gap-0.5 text-yellow-600">
                    <RefreshCw className="w-2.5 h-2.5" />
                    {stats.modified} modified
                </span>
            )}
            {diff.summary.destructiveChanges > 0 && (
                <span className="flex items-center gap-0.5 text-red-600 ml-auto">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {diff.summary.destructiveChanges} destructive
                </span>
            )}
        </div>
    );
}

// ============================================================================
// Atlas Diff Stats Bar
// ============================================================================

function AtlasDiffStatsBar({ summary }: { summary: AtlasSummary }) {
    return (
        <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-muted/20 text-[9px]">
            {summary.creates > 0 && (
                <span className="flex items-center gap-0.5 text-green-700">
                    <Plus className="w-2.5 h-2.5" />
                    {summary.creates} create
                </span>
            )}
            {summary.drops > 0 && (
                <span className="flex items-center gap-0.5 text-red-600">
                    <Minus className="w-2.5 h-2.5" />
                    {summary.drops} drop
                </span>
            )}
            {summary.alters > 0 && (
                <span className="flex items-center gap-0.5 text-yellow-600">
                    <RefreshCw className="w-2.5 h-2.5" />
                    {summary.alters} alter
                </span>
            )}
            {summary.destructiveChanges > 0 && (
                <span className="flex items-center gap-0.5 text-red-600 ml-auto">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {summary.destructiveChanges} destructive
                </span>
            )}
        </div>
    );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState({
    hasConnection,
    hasSchema,
    isLoading,
}: {
    hasConnection: boolean;
    hasSchema: boolean;
    isLoading: boolean;
}) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full">
            <GitCompareArrows className="w-10 h-10 mb-3 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">
                {isLoading ? 'Comparing schemas...' : 'Compare Schema Changes'}
            </p>
            <p className="text-[11px] text-muted-foreground/70 mt-1 max-w-[240px]">
                {!hasSchema
                    ? 'Write SQL in the editor first, then compare against a live database.'
                    : !hasConnection
                        ? 'Select a database connection above to compare.'
                        : 'Click "Compare" to see differences between your local file and the live database.'}
            </p>
        </div>
    );
}

export default SqlDiffPanel;
