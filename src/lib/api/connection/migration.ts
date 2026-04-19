// =============================================================================
// Migration API
// Preview, create, apply, rollback, history, status
// =============================================================================

import { post, get } from '../client';
import type { MigrationPreview, Migration, MigrationStatus, SchemaDiff } from './types';

/**
 * Preview migration SQL that would be generated from diff.
 * Accepts either rawSql (Atlas mode) or localSchema (legacy mode).
 */
export async function previewMigration(
    connectionId: string,
    schemaOrSql: any,
    schemaName: string = 'public',
    options?: { safeMode?: boolean; batchSize?: number }
): Promise<{ success: boolean; preview: MigrationPreview; diff?: SchemaDiff; destructiveAnalysis?: any }> {
    const body = typeof schemaOrSql === 'string'
        ? { rawSql: schemaOrSql, schemaName, safeMode: options?.safeMode || false, batchSize: options?.batchSize }
        : { localSchema: schemaOrSql, schemaName, safeMode: options?.safeMode || false, batchSize: options?.batchSize };
    return post(`/api/connection/${connectionId}/migrate/preview`, body);
}

/**
 * Apply migration directly (non-versioned, requires confirm: true).
 * Accepts either rawSql (Atlas mode) or localSchema (legacy mode).
 */
export async function applyMigration(
    connectionId: string,
    schemaOrSql: any,
    schemaName: string = 'public',
    options?: { force?: boolean; safeMode?: boolean; batchSize?: number }
): Promise<{ success: boolean; applied: boolean; message: string; statementCount?: number; warnings?: string[]; blocked?: boolean; reason?: string; structuralApplied?: boolean; structuralEmpty?: boolean; behavioralApplied?: any[]; behavioralErrors?: any[]; }> {
    const body = typeof schemaOrSql === 'string'
        ? { rawSql: schemaOrSql, schemaName, confirm: true, force: options?.force || false, safeMode: options?.safeMode || false, batchSize: options?.batchSize }
        : { localSchema: schemaOrSql, schemaName, confirm: true, force: options?.force || false, safeMode: options?.safeMode || false, batchSize: options?.batchSize };
    return post(`/api/connection/${connectionId}/migrate/apply`, body);
}

/**
 * Create a versioned migration (without applying).
 * rawSql: the full desired schema SQL (Atlas mode).
 */
export async function createMigration(
    connectionId: string,
    rawSql: string,
    options?: { name?: string; schemaName?: string; commitMessage?: string }
): Promise<{
    success: boolean;
    created: boolean;
    migration?: Migration;
    preview?: { up: string; down: string | null };
    signature?: string;
    message?: string;
}> {
    return post(`/api/connection/${connectionId}/migrations/create`, {
        rawSql,
        name: options?.name || 'schema_update',
        schemaName: options?.schemaName || 'public',
        commitMessage: options?.commitMessage || null,
    });
}

/**
 * Apply a specific versioned migration by ID
 */
export async function applySpecificMigration(
    connectionId: string,
    migrationId: string,
    options?: { dryRun?: boolean }
): Promise<{
    success: boolean;
    applied: boolean;
    executionTimeMs?: number;
    version?: string;
}> {
    return post(`/api/connection/${connectionId}/migrations/${migrationId}/apply`, {
        dryRun: options?.dryRun || false,
    });
}

/**
 * Rollback N most recent migrations.
 * Always sends confirm:true (user confirmed via UI).
 * forceSnapshotRollback: true required when migration has no down_sql
 * (triggers nuclear DROP SCHEMA + recreate rollback).
 */
export async function rollbackMigrations(
    connectionId: string,
    count: number = 1,
    options?: { forceSnapshotRollback?: boolean }
): Promise<{
    success: boolean;
    rolledBack: number;
    results: Array<{
        version: string;
        name?: string;
        success: boolean;
        error?: string;
        irreversible?: boolean;
        mode?: 'down_sql' | 'snapshot';
        executionTimeMs?: number;
    }>;
    requiresForce?: boolean;
}> {
    return post(`/api/connection/${connectionId}/migrations/rollback`, {
        count,
        confirm: true,
        forceSnapshotRollback: options?.forceSnapshotRollback ?? false,
    });
}

/**
 * Get migration history for a connection
 */
export async function getMigrations(
    connectionId: string,
    options?: { limit?: number; status?: string }
): Promise<{ success: boolean; migrations: Migration[] }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.status) params.set('status', options.status);

    const query = params.toString() ? `?${params.toString()}` : '';
    return get(`/api/connection/${connectionId}/migrations${query}`);
}

/**
 * Get migration status summary (counts by state)
 */
export async function getMigrationStatus(
    connectionId: string
): Promise<{ success: boolean; status: MigrationStatus }> {
    return get(`/api/connection/${connectionId}/migrations/status`);
}
