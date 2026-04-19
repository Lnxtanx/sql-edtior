// =============================================================================
// API Client - Central Export
// All API functions exported from one place
// =============================================================================

// Re-export client utilities
export {
    API_BASE_URL,
    ApiError,
    apiRequest,
    get,
    post,
    patch,
    del,
} from './client';

// Re-export Auth API
export {
    loginWithGoogle,
    logout,
    validateSession,
    getCurrentUser,
    getAIUsage,
    getAIModels,
    refreshSession,
    type User,
    type Usage,
    type AuthResponse,
    type SessionResponse,
    type UserProfileResponse,
    type AIQuotaStatus,
    type AIModelInfo,
} from './auth';

// Re-export Files API
export {
    getFiles,
    getFile,
    createFile,
    updateFile,
    deleteFile,
    type SqlFile,
    type FilesListResponse,
    type FileResponse,
} from '../file-management/api/client';

// Re-export Schema API
export {
    parseSchema,
    analyzeSchema,
    exportSchema,
    getSupportedFormats,
    type ParsedSchema,
    type SchemaIssue,
    type SchemaAnalysis,
    type ExportFormat,
    type ExportResult,
    type SupportedFormats,
} from './schema';

// Re-export Payments API
export {
    getPlans,
    createOrder,
    verifyPayment,
    getUsage,
    getPaymentHistory,
    getPaymentStatus,
    requestRefund,
    type Plan,
    type CreateOrderResponse,
    type VerifyPaymentParams,
    type VerifyPaymentResponse,
    type UsageResponse,
    type PaymentHistoryItem,
    type PaymentHistoryResponse,
} from './payments';

export {
    listSQLChatSessions,
    getSQLChatSessionMessages,
    deleteSQLChatSession,
    getProjectLatestChat,
    type SQLChatSessionSummary,
    type SQLChatHistoryMessage,
} from './sql-editor-history';

// Re-export Connection API
export {
    testConnection,
    saveConnection,
    listConnections,
    deleteConnection,
    pullSchema,
    diffSchema,
    detectDrift,
    previewMigration,
    applyMigration,
    checkPermissions,
    createMigration,
    applySpecificMigration,
    rollbackMigrations,
    getMigrations,
    getMigrationStatus,
    getConnectionHealth,
    getHealthEvents,
    getFingerprint,
    checkBinding,
    claimBinding,
    type ConnectionCredentials,
    type Connection,
    type TestResult,
    type SchemaDiff,
    type MigrationPreview,
    type PulledSchema,
    type Migration,
    type MigrationStatus,
    type Permissions,
    type Fingerprint,
    type BindingResult,
    type ConnectionHealth,
    type HealthEvent,
    type SchemaSnapshot,
} from './connection';

// Re-export Connection React Query hooks
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
} from './connection/hooks';
export {
    submitFeedback,
    type FeedbackSubmission,
} from './feedback';
