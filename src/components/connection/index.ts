// =============================================================================
// Connection Module — Barrel Export
// =============================================================================

// ─── Main components (slim shells) ───────────────────────────────────────────
export { ConnectionManager } from './ConnectionManager';
export { ConnectionManager as ConnectionDialog } from './ConnectionManager'; // for backward compat during migration
export { ConnectionPanel } from './panel/ConnectionPanel';
export { DatabaseDashboard } from './panel/DatabaseDashboard';

// ─── Sub-components ──────────────────────────────────────────────────────────
export { ConnectionForm } from './shared/ConnectionForm';
export { ConnectionSelector } from './panel/ConnectionSelector';
export { ConnectionHealthBadge } from './shared/ConnectionHealthBadge';
export { FileLinkButton } from './shared/FileLinkButton';
export { MigrationHistory } from './panel/MigrationHistory';
export { MigrationItem } from './panel/MigrationItem';

// ─── Hooks ───────────────────────────────────────────────────────────────────
export { useLinkedConnection, fileLinkKeys } from './hooks/useLinkedConnection';
export { useConnectionActions } from './hooks/useConnectionActions';
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
} from './hooks';

// ─── Utilities ───────────────────────────────────────────────────────────────
export { ConnectionCLI, type CLILog, type ConnectionCLIHandle } from './ConnectionCLI';
export { CurrentFileProvider, useCurrentFile } from './CurrentFileContext';
export { onConnectionEvent, emitConnectionEvent } from './useConnectionEvents';
export { runConnectionSetup } from './useConnectionSetup';
