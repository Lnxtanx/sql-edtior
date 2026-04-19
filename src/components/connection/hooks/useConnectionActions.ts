// =============================================================================
// useConnectionActions
// Shared action handlers for pull, push, diff, health, delete.
// Encapsulates API calls + toast notifications + CLI logging.
// Used by both ConnectionDialog, ConnectionPanel, and DatabaseDashboardPanel.
//
// Pull: fires editorBus.setSql to set pulled SQL in the active editor
// Diff: calls real diff API then fires editorBus.openDiff to open diff panel
// =============================================================================

import { useCallback } from 'react';
import {
    usePullSchema,
    useDeleteConnection,
    useRollbackMigrations,
    connectionKeys,
} from '@/lib/api/connection';
import { detectDrift, getConnectionHealth, diffSchema } from '@/lib/api/connection';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { editorBus } from '@/lib/editorBus';
import { schemaToSql } from '@/lib/schema-utils/schema-to-sql';
import { splitPulledSql } from '@/lib/file-management/utils/split-pulled-sql';
import type { PullMode } from '../dashboard/PullOptionsDialog';

/** Log callback type for CLI terminal output */
type LogFn = (type: 'command' | 'info' | 'success' | 'error' | 'output', message: string) => void;

interface UseConnectionActionsOptions {
    /** Callback when schema is pulled successfully */
    onSchemaPulled?: (schema: any) => void;
    /** Append a log entry to the CLI terminal */
    log?: LogFn;
    /**
     * If true, dispatch pulled SQL to the global editor via editorBus.
     * Set to true in DatabaseDashboardPanel, leave false in ConnectionPanel
     * (which handles onSchemaPulled itself via SqlEditor).
     */
    dispatchToEditor?: boolean;
    /** FileManager from useFileManager, to enable writing files to the workspace */
    fileManager?: any;
}

export function useConnectionActions(options: UseConnectionActionsOptions = {}) {
    const { onSchemaPulled, log, dispatchToEditor = false, fileManager } = options;
    const queryClient = useQueryClient();

    const pullMutation = usePullSchema();
    const deleteMutation = useDeleteConnection();
    const rollbackMutation = useRollbackMigrations();

    // ─── Pull Schema ─────────────────────────────────────────────────────────

    const handlePull = useCallback(async (connectionId: string, mode: PullMode = 'single') => {
        log?.('info', `Connecting to database (pull mode: ${mode})...`);

        try {
            const result = await pullMutation.mutateAsync({ connectionId });

            if (result.success && (result.schema || result.sql)) {
                // Use metadata from backend (works for both Atlas and legacy)
                const tableCount = result.metadata?.tableCount ?? result.schema?.tables?.length ?? 0;
                const enumCount = result.metadata?.enumCount ?? 0;
                const viewCount = (result.metadata as any)?.viewCount ?? 0;
                const functionCount = (result.metadata as any)?.functionCount ?? 0;

                // Build a compact summary showing all pulled object types
                const parts: string[] = [`${tableCount} table${tableCount !== 1 ? 's' : ''}`];
                if (enumCount > 0) parts.push(`${enumCount} enum${enumCount !== 1 ? 's' : ''}`);
                if (viewCount > 0) parts.push(`${viewCount} view${viewCount !== 1 ? 's' : ''}`);
                if (functionCount > 0) parts.push(`${functionCount} function${functionCount !== 1 ? 's' : ''}`);
                log?.('output', `✓ Introspected schema: ${parts.join(', ')}`);
                if ((result as any).snapshotId) {
                    log?.('info', `  Snapshot saved (${(result as any).snapshotId.slice(0, 8)}…)`);
                }

                // Show warnings if any (e.g. history save failed)
                if (result.warnings && result.warnings.length > 0) {
                    log?.('info', '⚠ Pull completed with warnings:');
                    result.warnings.forEach((w: string) => {
                        log?.('info', `  - ${w}`);
                        toast.warning(w);
                    });
                }

                const rawSql = result.sql || (result.schema ? schemaToSql(result.schema as any) : null);

                // ── Dispatch SQL to the workspace (Split Mode) ────────
                if (mode !== 'single' && fileManager && rawSql) {
                    log?.('info', `Splitting output into project files...`);
                    const splits = splitPulledSql(rawSql, mode);

                    // Folder state map so we can reference parent_id
                    const folderIds = new Map<string, string>(); // schemaName -> folderId

                    // Promise execution step-by-step to honor foreign keys / parents
                    for (const split of splits) {
                        try {
                            if (split.isFolder && mode === 'split-by-table') {
                                // Create schema folder
                                const folder = await fileManager.createFolder(split.fileName, null);
                                folderIds.set(split.fileName, folder.id);
                            } else {
                                // Find parent if this goes into a folder
                                const parentName = split.folderPath?.[0];
                                const parentId = parentName ? folderIds.get(parentName) : null;

                                await fileManager.createNewFile(split.fileName, split.content, {
                                    parent_id: parentId,
                                    connection_id: connectionId,
                                });
                            }
                        } catch (e) {
                            console.error('Failed to create split file/folder', e);
                        }
                    }

                    toast.success(`Generated ${splits.length} files from pull`);
                    log?.('success', `Created ${splits.length} files in the workspace.`);
                    return;
                }

                // ── Dispatch SQL to the active editor (Single Mode) ────────
                if (dispatchToEditor) {
                    if (rawSql) {
                        editorBus.setSql(rawSql);
                        log?.('success', 'Schema loaded into SQL editor.');
                        toast.success(`Pulled ${tableCount} tables — SQL editor updated`);
                    } else {
                        log?.('success', 'Schema pulled and written to file.');
                        toast.success(`Pulled ${tableCount} tables`);
                    }
                } else {
                    log?.('success', 'Schema pulled and written to file.');
                    toast.success(`Pulled ${tableCount} tables`);
                    onSchemaPulled?.(result);
                }
            } else {
                log?.('error', '✗ Failed to pull schema');
                toast.error('Failed to pull schema');
            }
        } catch (err: any) {
            log?.('error', `✗ ${err.message}`);
            toast.error(err.message || 'Pull failed');
        }
    }, [pullMutation, onSchemaPulled, log, dispatchToEditor, fileManager]);

    // ─── Diff / Schema Compare ────────────────────────────────────────────────
    // Priority 2 fix: call real diff API, then open the diff panel via editorBus.

    const handleDiff = useCallback(async (connectionId: string, localSql?: string) => {
        log?.('info', 'Fetching live schema diff...');

        try {
            if (!dispatchToEditor) {
                // Legacy mode (ConnectionPanel CLI): just check drift hash
                const result = await detectDrift(connectionId);
                if (result.isFirstCheck) {
                    log?.('info', 'No previous snapshot found. Run "sw pull" first to create a baseline.');
                } else if (result.hasDrift) {
                    log?.('error', `✗ Drift detected: ${result.reason}`);
                    if (result.lastSnapshotAt) {
                        log?.('info', `  Last snapshot: ${new Date(result.lastSnapshotAt).toLocaleString()}`);
                    }
                    if (result.storedHash && result.currentHash) {
                        log?.('info', `  Stored hash: ${result.storedHash.slice(0, 12)}…`);
                        log?.('info', `  Live hash:   ${result.currentHash.slice(0, 12)}…`);
                    }
                    log?.('info', '  Run "sw pull" to update your local file.');
                } else {
                    log?.('success', '✓ No drift — live database matches last snapshot.');
                }
                return;
            }

            // ── Dashboard mode: call real diff API → open diff panel ─────────
            // localSql can be omitted — server will diff against last snapshot SQL
            const result = await diffSchema(connectionId, localSql ?? '-- placeholder');

            if (!result.success) {
                log?.('error', '✗ Diff failed on server');
                toast.error('Failed to fetch schema diff');
                return;
            }

            const diffPayload = {
                liveSql: result.liveSql || '',
                migrationSql: result.migrationSql,
                atlasSummary: result.summary,
                isEmpty: result.isEmpty,
            };

            // Signal SqlEditor to switch to 'diff' view with pre-loaded result
            editorBus.openDiff(diffPayload, connectionId);

            if (result.isEmpty) {
                log?.('success', '✓ Schemas are in sync — no differences found');
                toast.success('Schemas in sync');
            } else {
                const changes = result.summary?.totalChanges ?? '?';
                const destructive = result.summary?.destructiveChanges ?? 0;
                log?.('info', `Found ${changes} change(s)${destructive > 0 ? `, ${destructive} destructive` : ''}`);
                toast.info(`Diff panel opened — ${changes} changes`);
            }
        } catch (err: any) {
            log?.('error', `✗ Diff check failed: ${err.message}`);
            toast.error(err.message || 'Diff failed');
        }
    }, [log, dispatchToEditor]);

    // ─── Health Check ────────────────────────────────────────────────────────

    const handleHealthCheck = useCallback(async (connectionId: string) => {
        log?.('info', 'Checking connection health...');

        try {
            const result = await getConnectionHealth(connectionId);
            // Invalidate the cached health query so UI updates
            queryClient.invalidateQueries({ queryKey: connectionKeys.health(connectionId) });

            if (result.status === 'healthy') {
                log?.('success', `Connected • Latency: ${result.latencyMs}ms`);
                toast.success(`Connected! Latency: ${result.latencyMs}ms`);
            } else {
                log?.('error', `Connection unhealthy: ${result.error}`);
                toast.error(`Unhealthy: ${result.error}`);
            }
        } catch (err: any) {
            log?.('error', `✗ Health check failed: ${err.message}`);
            toast.error(err.message || 'Health check failed');
        }
    }, [log, queryClient]);

    // ─── Delete ──────────────────────────────────────────────────────────────

    const handleDelete = useCallback(async (connectionId: string) => {
        try {
            await deleteMutation.mutateAsync(connectionId);
            toast.success('Connection deleted');
        } catch (err: any) {
            toast.error('Failed to delete connection');
        }
    }, [deleteMutation]);

    // ─── Rollback ────────────────────────────────────────────────────────────

    const handleRollback = useCallback(async (
        connectionId: string,
        count = 1,
        forceSnapshotRollback = false
    ) => {
        log?.('info', `Rolling back ${count} migration(s)...`);

        try {
            const result = await rollbackMutation.mutateAsync({ connectionId, count, forceSnapshotRollback });
            const mode = result.results[0]?.mode;
            const modeNote = mode ? ` (${mode === 'down_sql' ? 'down_sql' : 'snapshot'})` : '';
            log?.('success', `Rolled back ${result.rolledBack} migration(s)${modeNote}`);
            toast.success(`Rolled back ${result.rolledBack} migration(s)`);
        } catch (err: any) {
            const msg: string = err.message || 'Rollback failed';
            log?.('error', msg);
            // Surface useful hint for CLI users when snapshot rollback is needed
            if (msg.includes('SNAPSHOT_ROLLBACK_REQUIRES_CONFIRMATION') || msg.includes('forceSnapshotRollback')) {
                log?.('info', 'Hint: migration has no down_sql. Use the UI to confirm snapshot-based rollback.');
            }
            toast.error(msg);
        }
    }, [rollbackMutation, log]);

    return {
        handlePull,
        handleDiff,
        handleHealthCheck,
        handleDelete,
        handleRollback,
        isPulling: pullMutation.isPending,
        isDeleting: deleteMutation.isPending,
        isRollingBack: rollbackMutation.isPending,
        isBusy: pullMutation.isPending || deleteMutation.isPending || rollbackMutation.isPending,
    };
}
