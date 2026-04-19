// =============================================================================
// Schema API
// Pull live schema, diff against local, compile to SQL
// =============================================================================

import { post } from '../client';
import type { PulledSchema, SchemaDiff } from './types';

/**
 * Pull schema from a saved connection.
 * Returns both the compiled SQL and optionally the introspected schema object.
 * Atlas mode: returns sql + metadata (no schema object).
 * Legacy mode: returns sql + schema object.
 */
export async function pullSchema(
    connectionId: string,
    schemaName: string = 'public'
): Promise<{ success: boolean; schema?: PulledSchema; sql: string; metadata?: { tableCount: number; enumCount: number }; warnings?: string[] }> {
    return post(`/api/connection/${connectionId}/pull`, { schemaName });
}

/**
 * Diff live database schema against a local schema definition.
 * Accepts either rawSql (Atlas mode) or localSchema (legacy mode).
 */
export async function diffSchema(
    connectionId: string,
    schemaOrSql: any,
    schemaName: string = 'public'
): Promise<{ success: boolean; diff?: SchemaDiff; liveSchema?: PulledSchema; liveSql?: string; migrationSql?: string; summary?: any; isEmpty?: boolean }> {
    const body = typeof schemaOrSql === 'string'
        ? { rawSql: schemaOrSql, schemaName }
        : { localSchema: schemaOrSql, schemaName };
    return post(`/api/connection/${connectionId}/diff`, body);
}

/**
 * Detect drift: compare live database against the last stored snapshot.
 * No local schema needed — compares live vs last pull snapshot.
 */
export async function detectDrift(
    connectionId: string,
    schemaName: string = 'public'
): Promise<{
    success: boolean;
    hasDrift: boolean;
    reason: string;
    isFirstCheck?: boolean;
    lastSnapshotAt?: string;
    lastSnapshotTrigger?: string;
    currentHash?: string;
    storedHash?: string;
}> {
    return post(`/api/connection/${connectionId}/drift`, { schemaName });
}
