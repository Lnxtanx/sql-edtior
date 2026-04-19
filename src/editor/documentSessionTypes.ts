import type { SqlFile } from '@/lib/file-management/api/client';

export type DocumentRevision = string | number | null;

export interface DocumentSession {
  fileId: string;
  serverContent: string;
  draftContent: string;
  serverRevision: DocumentRevision;
  localRevision: number;
  dirty: boolean;
  loading: boolean;
  isLoaded: boolean;
  saving: boolean;
  loadToken?: string;
  inFlightSaveRevision?: number;
  remoteChanged?: boolean;
  error?: string | null;
  lastSavedAt?: number | null;
}

export interface DocumentLoadResult {
  content: string;
  revision: DocumentRevision;
}

export interface DocumentSaveSnapshot {
  fileId: string;
  draftContent: string;
  baseServerRevision: DocumentRevision;
  localRevision: number;
}

export interface DocumentSaveResult {
  content: string;
  revision: DocumentRevision;
}

export interface DocumentRepository {
  loadFile(file: SqlFile): Promise<DocumentLoadResult>;
  saveFile(file: SqlFile, snapshot: DocumentSaveSnapshot): Promise<DocumentSaveResult>;
}

export interface AutosaveConfig {
  enabled: boolean;
  debounceMs: number;
  save: () => Promise<void>;
}

export interface DocumentSessionSnapshot {
  version: number;
  activeFileId: string | null;
  session: DocumentSession | null;
}
