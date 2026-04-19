// =============================================================================
// ExecutionEngine
// Maps parsed commands to connection actions.
// Accepts an OutputWriter for streaming-style line-by-line output.
// =============================================================================

import { useCallback, useRef, useState } from 'react';
import { useConnectionActions } from '../hooks/useConnectionActions';
import { parseCommand, COMMAND_HELP } from './CommandParser';
import type { OutputWriter, ParsedCommand } from './types';
import { previewMigration, applyMigration } from '@/lib/api/connection/migration';
import { diffSchema } from '@/lib/api/connection/schema';
import { useCurrentFile } from '../CurrentFileContext';

interface ExecutionEngineOptions {
    connectionId: string | null;
    onSchemaPulled?: (schema: any) => void;
}

/**
 * Hook that provides an `execute(raw)` function.
 *
 * The engine writes output lines through the `OutputWriter` passed to `execute`
 * so the terminal can render them incrementally (streaming-style).
 */
export function useExecutionEngine(options: ExecutionEngineOptions) {
    const { connectionId, onSchemaPulled } = options;
    const { schema, sql, mergedSql } = useCurrentFile();
    const [isExecuting, setIsExecuting] = useState(false);

    // Keep a stable ref to the writer so async callbacks always see the latest
    const writerRef = useRef<OutputWriter | null>(null);

    // Build connection actions with a log bridge into the current writer
    const actions = useConnectionActions({
        onSchemaPulled,
        log: (type, message) => {
            // Map CLILog type → TerminalLine type (they're the same strings except 'command')
            const mapped = type === 'command' ? 'output' : type;
            writerRef.current?.(mapped as any, message);
        },
    });

    const execute = useCallback(
        async (raw: string, write: OutputWriter): Promise<void> => {
            writerRef.current = write;
            const parsed = parseCommand(raw);

            // ───── No connection guard ───────────────────────────────────────
            if (
                parsed.command &&
                parsed.command !== 'help' &&
                parsed.command !== 'clear' &&
                !connectionId
            ) {
                write('error', 'No connection selected. Select one above first.');
                return;
            }

            setIsExecuting(true);

            try {
                switch (parsed.command) {
                    // ── Schema ───────────────────────────────────────────────
                    case 'pull':
                        await actions.handlePull(connectionId!);
                        break;

                    case 'push': {
                        const pushInput = mergedSql || sql || schema;
                        if (!pushInput) {
                            write('error', 'No local schema found to push. Try analyzing the file first.');
                            break;
                        }

                        const isApply = parsed.args.includes('--apply') || parsed.args.includes('-y');
                        const isForce = parsed.args.includes('--force') || parsed.args.includes('-f');
                        const isSafe = parsed.args.includes('--safe');
                        const batchSizeArg = parsed.args.find(a => a.startsWith('--batch-size='));
                        const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : undefined;

                        if (isApply) {
                            write('info', isForce ? 'Applying migration (force mode)...' : 'Applying migration...');
                            try {
                                const result = await applyMigration(connectionId!, pushInput, 'public', { force: isForce, safeMode: isSafe, batchSize });
                                if (result.blocked) {
                                    write('error', `✗ ${result.message}`);
                                    if (result.warnings?.length) {
                                        result.warnings.forEach((w: string) => write('info', `  - ${w}`));
                                    }
                                    write('info', '\nTo apply anyway, run: sw push --apply --force');
                                } else {
                                    if (result.structuralApplied) {
                                        write('success', `✓ Structural migration applied successfully.`);
                                        if (result.statementCount) write('info', `  ${result.statementCount} statements executed.`);
                                    } else if (result.structuralEmpty) {
                                        write('info', `No structural changes to apply.`);
                                    }

                                    if (result.behavioralApplied?.length) {
                                        write('success', `✓ Applied ${result.behavioralApplied.length} behavioral object(s).`);
                                    }

                                    const hasErrors = result.behavioralErrors?.length > 0;
                                    if (hasErrors) {
                                        const fatal = result.behavioralErrors.filter((e: any) => e.severity === 'fatal');
                                        const warnings = result.behavioralErrors.filter((e: any) => e.severity === 'warning');

                                        if (fatal.length) {
                                            write('error', `✗ Failed to apply ${fatal.length} behavioral object(s):`);
                                            fatal.forEach((e: any) => write('error', `  - [${e.pgCode || 'UNKNOWN'}] ${e.name}: ${e.error}`));
                                        }
                                        if (warnings.length) {
                                            write('info', `⚠ Warnings for ${warnings.length} behavioral object(s):`);
                                            warnings.forEach((e: any) => write('info', `  - [${e.pgCode || 'UNKNOWN'}] ${e.name}: ${e.error}`));
                                        }
                                    }

                                    if (result.warnings?.length) {
                                        write('info', '⚠ General Warnings:');
                                        result.warnings.forEach((w: string) => write('info', `  - ${w}`));
                                    }

                                    if (!result.structuralApplied && !result.structuralEmpty && !result.behavioralApplied?.length && !result.behavioralErrors?.length) {
                                        write('info', result.message || 'No changes to apply.');
                                    }
                                }
                            } catch (e: any) {
                                write('error', `✗ Push failed: ${e.message}`);
                            }
                        } else {
                            write('info', 'Generating migration preview...');
                            try {
                                const result = await previewMigration(connectionId!, pushInput, 'public', { safeMode: isSafe, batchSize });
                                if (result.success) {
                                    if (result.preview.hasDestructiveChanges) {
                                        write('info', '⚠ Destructive changes detected!');
                                    }

                                    const upSql = result.preview.sql;
                                    if (!upSql || !upSql.trim()) {
                                        write('success', '✓ No changes detected. Database is up to date.');
                                    } else {
                                        write('output', 'Proposed Changes:\n');
                                        write('output', upSql);

                                        if (result.preview.hasIncompatibleChanges) {
                                            write('info', 'ℹ Smart Migration details:');
                                            result.preview.incompatibleDetails?.forEach((d: any) => {
                                                write('info', `  - ${d.table}.${d.column} (${d.fromType} → ${d.toType})`);
                                            });
                                        }

                                        write('info', '\nTo apply these changes, run: sw push --apply');
                                        if (result.preview.hasIncompatibleChanges) {
                                            write('info', 'To use safe step-wise execution, append --safe (and optionally --batch-size=N)');
                                        }
                                    }
                                } else {
                                    write('error', '✗ Failed to generate preview.');
                                }
                            } catch (e: any) {
                                write('error', `✗ Preview failed: ${e.message}`);
                            }
                        }
                        break;
                    }

                    case 'diff': {
                        const diffInput = mergedSql || sql || schema;
                        if (!diffInput) {
                            write('error', 'No local schema found. Open a SQL file first.');
                            break;
                        }

                        write('info', 'Comparing local file with live database...');
                        try {
                            const result = await diffSchema(connectionId!, diffInput);
                            if (!result.success) {
                                write('error', '✗ Diff failed.');
                                break;
                            }

                            // Atlas-mode response: { migrationSql, liveSql, summary, isEmpty }
                            const { migrationSql, summary, isEmpty } = result as any;

                            if (isEmpty || !migrationSql?.trim()) {
                                write('success', '✓ No differences — local file matches live database.');
                                break;
                            }

                            if (summary) {
                                write('info', `Found ${summary.totalChanges} change(s) (${summary.destructiveChanges} destructive, ${summary.safeChanges} safe):`);
                                if (summary.creates) write('success', `  + ${summary.creates} object(s) to create`);
                                if (summary.alters) write('info', `  ~ ${summary.alters} object(s) to alter`);
                                if (summary.drops) write('error', `  - ${summary.drops} object(s) to drop`);
                            }

                            write('output', '\nMigration SQL:\n');
                            write('output', migrationSql);

                            write('info', '\nRun "sw push" to preview the migration SQL.');
                        } catch (e: any) {
                            write('error', `✗ Diff failed: ${e.message}`);
                        }
                        break;
                    }

                    // ── Status / Health ───────────────────────────────────────
                    case 'status':
                    case 'health':
                        await actions.handleHealthCheck(connectionId!);
                        break;

                    // ── Rollback ──────────────────────────────────────────────
                    case 'rollback': {
                        const count = parseInt(parsed.args[0]) || 1;
                        actions.handleRollback(connectionId!, count);
                        break;
                    }

                    // ── Built-ins ────────────────────────────────────────────
                    case 'clear':
                        // Handled by the terminal itself (special case)
                        break;

                    case 'help':
                        write('info', 'Available commands:\n');
                        for (const h of COMMAND_HELP) {
                            write(
                                'info',
                                `  ${h.alias.padEnd(14)} ${h.description}`
                            );
                        }
                        break;

                    // ── Unknown ──────────────────────────────────────────────
                    default:
                        write(
                            'error',
                            `Unknown command: "${raw}". Type "help" for available commands.`
                        );
                }
            } catch (err: any) {
                write('error', `✗ ${err.message || 'Unexpected error'}`);
            } finally {
                setIsExecuting(false);
                writerRef.current = null;
            }
        },
        [connectionId, actions]
    );

    return {
        execute,
        isExecuting,
        /** Expose isBusy from underlying actions (mutation in-flight) */
        isBusy: actions.isBusy || isExecuting,
    };
}
