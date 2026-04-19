// =============================================================================
// Connection Hooks — Barrel Export
// =============================================================================

export { useLinkedConnection, fileLinkKeys } from './useLinkedConnection';
export { useProjectConnection, projectLinkKeys } from './useProjectConnection';
export { useConnectionActions } from './useConnectionActions';

// Re-export all React Query hooks from the API layer
export {
    connectionKeys,
    useConnections,
    useConnectionHealth,
    useHealthEvents,
    useMigrations,
    useMigrationStatus,
    usePermissions,
    useTestConnection,
    useSaveConnection,
    useDeleteConnection,
    usePullSchema,
    useDiffSchema,
    usePreviewMigration,
    useApplyMigration,
    useCreateMigration,
    useApplySpecificMigration,
    useRollbackMigrations,
    useClaimBinding,
} from '@/lib/api/connection';
