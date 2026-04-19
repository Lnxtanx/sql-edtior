// =============================================================================
// Connection API - Barrel Export
// All types and API functions re-exported from one place
// =============================================================================

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
    ConnectionCredentials,
    Connection,
    TestResult,
    PulledSchema,
    SchemaDiff,
    MigrationPreview,
    Migration,
    MigrationStatus,
    Permissions,
    Fingerprint,
    BindingResult,
    ConnectionHealth,
    HealthEvent,
    SchemaSnapshot,
    ConnectionEvent,
    LinkedFile,
} from './types';

// ─── CRUD ────────────────────────────────────────────────────────────────────
export {
    testConnection,
    saveConnection,
    updateConnection,
    listConnections,
    deleteConnection,
    getConnectionEvents,
    getLinkedFiles,
} from './crud';

// ─── Schema ──────────────────────────────────────────────────────────────────
export {
    pullSchema,
    diffSchema,
    detectDrift,
} from './schema';

// ─── Migration ───────────────────────────────────────────────────────────────
export {
    previewMigration,
    applyMigration,
    createMigration,
    applySpecificMigration,
    rollbackMigrations,
    getMigrations,
    getMigrationStatus,
} from './migration';

// ─── Security ────────────────────────────────────────────────────────────────
export {
    checkPermissions,
    getFingerprint,
    checkBinding,
    claimBinding,
} from './security';

// ─── Health ──────────────────────────────────────────────────────────────────
export {
    getConnectionHealth,
    getHealthEvents,
} from './health';

// ─── React Query Hooks ───────────────────────────────────────────────────────
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
    useConnectionEventsData,
    useLinkedFiles,
    useUpdateConnection,
} from './hooks';
