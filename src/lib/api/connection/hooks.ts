// =============================================================================
// Connection React Query Hooks
// Centralized connection state management using @tanstack/react-query
// =============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    listConnections,
    testConnection,
    saveConnection,
    updateConnection,
    deleteConnection,
    getConnectionEvents,
    getLinkedFiles,
} from './crud';
import { pullSchema, diffSchema } from './schema';
import {
    previewMigration,
    applyMigration,
    createMigration,
    applySpecificMigration,
    rollbackMigrations,
    getMigrations,
    getMigrationStatus,
} from './migration';
import { checkPermissions, getFingerprint, checkBinding, claimBinding } from './security';
import { getConnectionHealth, getHealthEvents } from './health';
import type { ConnectionCredentials } from './types';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const connectionKeys = {
    all: ['connections'] as const,
    list: ['connections', 'list'] as const,
    detail: (id: string) => ['connections', id] as const,
    health: (id: string) => ['connections', id, 'health'] as const,
    healthEvents: (id: string) => ['connections', id, 'health', 'events'] as const,
    migrations: (id: string) => ['connections', id, 'migrations'] as const,
    migrationStatus: (id: string) => ['connections', id, 'migrations', 'status'] as const,
    permissions: (id: string) => ['connections', id, 'permissions'] as const,
    fingerprint: (id: string) => ['connections', id, 'fingerprint'] as const,
    binding: (id: string) => ['connections', id, 'binding'] as const,
    schema: (id: string) => ['connections', id, 'schema'] as const,
    events: (id: string) => ['connections', id, 'events'] as const,
    linkedFiles: (id: string) => ['connections', id, 'linkedFiles'] as const,
};

// ─── Connection List ─────────────────────────────────────────────────────────

export function useConnections() {
    return useQuery({
        queryKey: connectionKeys.list,
        queryFn: () => listConnections(),
        select: (data) => data.connections,
        staleTime: 30_000, // 30s
    });
}

// ─── Health ──────────────────────────────────────────────────────────────────

export function useConnectionHealth(connectionId: string | null) {
    return useQuery({
        queryKey: connectionKeys.health(connectionId!),
        queryFn: () => getConnectionHealth(connectionId!),
        enabled: !!connectionId,
        refetchInterval: 60_000, // auto-refresh every 60s
        staleTime: 30_000,
    });
}

export function useConnectionEventsData(connectionId: string | null, options?: { limit?: number; eventType?: string }) {
    return useQuery({
        queryKey: [...connectionKeys.events(connectionId!), options],
        queryFn: () => getConnectionEvents(connectionId!, options),
        enabled: !!connectionId,
        select: (data) => data.events,
        refetchInterval: 30_000,
    });
}

export function useLinkedFiles(connectionId: string | null) {
    return useQuery({
        queryKey: connectionKeys.linkedFiles(connectionId!),
        queryFn: () => getLinkedFiles(connectionId!),
        enabled: !!connectionId,
        select: (data) => data.files,
    });
}

export function useHealthEvents(connectionId: string | null, options?: { limit?: number; eventType?: string }) {
    return useQuery({
        queryKey: [...connectionKeys.healthEvents(connectionId!), options],
        queryFn: () => getHealthEvents(connectionId!, options),
        enabled: !!connectionId,
        select: (data) => data.events,
    });
}

// ─── Migrations ──────────────────────────────────────────────────────────────

export function useMigrations(connectionId: string | null, options?: { limit?: number; status?: string }) {
    return useQuery({
        queryKey: [...connectionKeys.migrations(connectionId!), options],
        queryFn: () => getMigrations(connectionId!, options),
        enabled: !!connectionId,
        select: (data) => data.migrations,
    });
}

export function useMigrationStatus(connectionId: string | null) {
    return useQuery({
        queryKey: connectionKeys.migrationStatus(connectionId!),
        queryFn: () => getMigrationStatus(connectionId!),
        enabled: !!connectionId,
        select: (data) => data.status,
    });
}

// ─── Permissions ─────────────────────────────────────────────────────────────

export function usePermissions(connectionId: string | null) {
    return useQuery({
        queryKey: connectionKeys.permissions(connectionId!),
        queryFn: () => checkPermissions(connectionId!),
        enabled: !!connectionId,
        staleTime: 5 * 60_000, // 5min — permissions rarely change
        select: (data) => data.permissions,
    });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useTestConnection() {
    return useMutation({
        mutationFn: (credentials: ConnectionCredentials) => testConnection(credentials),
    });
}

export function useSaveConnection() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ name, credentials }: { name: string; credentials: ConnectionCredentials }) =>
            saveConnection(name, credentials),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: connectionKeys.list });
        },
    });
}

export function useUpdateConnection() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, name, credentials }: { id: string; name: string; credentials: ConnectionCredentials }) =>
            updateConnection(id, name, credentials),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: connectionKeys.list });
        },
    });
}

export function useDeleteConnection() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteConnection(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: connectionKeys.list });
        },
    });
}

export function usePullSchema() {
    return useMutation({
        mutationFn: ({ connectionId, schemaName }: { connectionId: string; schemaName?: string }) =>
            pullSchema(connectionId, schemaName),
    });
}

export function useDiffSchema() {
    return useMutation({
        mutationFn: ({ connectionId, localSchema, schemaName }: {
            connectionId: string; localSchema: any; schemaName?: string;
        }) => diffSchema(connectionId, localSchema, schemaName),
    });
}

export function usePreviewMigration() {
    return useMutation({
        mutationFn: ({ connectionId, localSchema, schemaName }: {
            connectionId: string; localSchema: any; schemaName?: string;
        }) => previewMigration(connectionId, localSchema, schemaName),
    });
}

export function useApplyMigration() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ connectionId, localSchema, schemaName }: {
            connectionId: string; localSchema: any; schemaName?: string;
        }) => applyMigration(connectionId, localSchema, schemaName),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: connectionKeys.migrations(variables.connectionId) });
            queryClient.invalidateQueries({ queryKey: connectionKeys.migrationStatus(variables.connectionId) });
        },
    });
}

export function useCreateMigration() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ connectionId, localSchema, options }: {
            connectionId: string; localSchema: any; options?: { name?: string; schemaName?: string; commitMessage?: string };
        }) => createMigration(connectionId, localSchema, options),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: connectionKeys.migrations(variables.connectionId) });
            queryClient.invalidateQueries({ queryKey: connectionKeys.migrationStatus(variables.connectionId) });
        },
    });
}

export function useApplySpecificMigration() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ connectionId, migrationId, options }: {
            connectionId: string; migrationId: string; options?: { dryRun?: boolean };
        }) => applySpecificMigration(connectionId, migrationId, options),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: connectionKeys.migrations(variables.connectionId) });
            queryClient.invalidateQueries({ queryKey: connectionKeys.migrationStatus(variables.connectionId) });
        },
    });
}

export function useRollbackMigrations() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            connectionId,
            count,
            forceSnapshotRollback,
        }: {
            connectionId: string;
            count?: number;
            forceSnapshotRollback?: boolean;
        }) => rollbackMigrations(connectionId, count, { forceSnapshotRollback }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: connectionKeys.migrations(variables.connectionId) });
            queryClient.invalidateQueries({ queryKey: connectionKeys.migrationStatus(variables.connectionId) });
        },
    });
}

export function useClaimBinding() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ connectionId, fileId }: { connectionId: string; fileId: string }) =>
            claimBinding(connectionId, fileId),
        onSuccess: (_, { connectionId }) => {
            queryClient.invalidateQueries({ queryKey: connectionKeys.binding(connectionId) });
        },
    });
}
