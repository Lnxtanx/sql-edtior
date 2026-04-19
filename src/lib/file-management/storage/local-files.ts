// =============================================================================
// Guest Files Compatibility Layer
// Async IndexedDB-backed guest storage with legacy localStorage migration.
// =============================================================================

export type { GuestFileRecord as LocalFile } from './filesRepository';
export {
  MAX_CONTENT_SIZE,
  MAX_LOCAL_FILES,
  canCreateFile as canCreateLocalFile,
  clearAllFiles as clearLocalFiles,
  completeMigration,
  createFile as createLocalFile,
  deleteFile as deleteLocalFile,
  getAllFiles as getLocalFiles,
  getFileById as getLocalFile,
  getFileCount as getLocalFileCount,
  getFilesForMigration,
  getRemainingSlots,
  hasFiles as hasLocalFiles,
  migrateLocalStorageToIndexedDb,
  updateFile as updateLocalFile,
} from './filesRepository';
