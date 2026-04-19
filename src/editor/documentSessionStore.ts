import type { SqlFile } from '@/lib/file-management/api/client';
import { AutosaveQueue } from './autosaveQueue';
import type {
  AutosaveConfig,
  DocumentRepository,
  DocumentSession,
  DocumentSessionSnapshot,
  DocumentSaveSnapshot,
} from './documentSessionTypes';

function createLoadToken(): string {
  return `load_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function cloneSession(session: DocumentSession): DocumentSession {
  return { ...session };
}

export class DocumentSessionStore {
  private sessions = new Map<string, DocumentSession>();
  private autosaveConfigs = new Map<string, AutosaveConfig>();
  private listeners = new Set<() => void>();
  private autosaveQueue = new AutosaveQueue();
  private version = 0;
  private activeFileId: string | null = null;
  private snapshotCache: { fileId: string | null; version: number; snapshot: DocumentSessionSnapshot } | null = null;
  private sessionCache = new Map<string, { version: number; session: DocumentSession | null }>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(fileId: string | null): DocumentSessionSnapshot {
    if (
      this.snapshotCache &&
      this.snapshotCache.fileId === fileId &&
      this.snapshotCache.version === this.version
    ) {
      return this.snapshotCache.snapshot;
    }

    const snapshot = {
      version: this.version,
      activeFileId: this.activeFileId,
      session: fileId ? this.getSession(fileId) : null,
    };

    this.snapshotCache = { fileId, version: this.version, snapshot };
    return snapshot;
  }

  getVersion(): number {
    return this.version;
  }

  getActiveFileId(): string | null {
    return this.activeFileId;
  }

  getSession(fileId: string): DocumentSession | null {
    const cached = this.sessionCache.get(fileId);
    if (cached && cached.version === this.version) {
      return cached.session;
    }

    const session = this.sessions.get(fileId);
    const cloned = session ? cloneSession(session) : null;
    this.sessionCache.set(fileId, { version: this.version, session: cloned });
    return cloned;
  }

  getDraftContent(fileId: string, fallback = ''): string {
    const session = this.sessions.get(fileId);
    return session?.draftContent ?? fallback;
  }

  getLastSavedAt(fileId: string): Date | null {
    const session = this.sessions.get(fileId);
    return session?.lastSavedAt ? new Date(session.lastSavedAt) : null;
  }

  setActiveFile(fileId: string | null): void {
    if (this.activeFileId === fileId) return;
    this.activeFileId = fileId;
    this.emit();
  }

  ensureSession(file: SqlFile): DocumentSession {
    const existing = this.sessions.get(file.id);
    if (existing) {
      return existing;
    }

    const session: DocumentSession = {
      fileId: file.id,
      serverContent: file.content ?? '',
      draftContent: file.content ?? '',
      serverRevision: file.updated_at ?? null,
      localRevision: 0,
      dirty: false,
      loading: false,
      isLoaded: false,
      saving: false,
      remoteChanged: false,
      error: null,
      lastSavedAt: null,
    };

    this.sessions.set(file.id, session);
    return session;
  }

  primeSession(file: SqlFile, content?: string): void {
    const session = this.ensureSession(file);
    const nextContent = content ?? file.content ?? '';

    session.serverContent = nextContent;
    session.serverRevision = file.updated_at ?? null;

    if (!session.dirty) {
      session.draftContent = nextContent;
      session.isLoaded = true;
    }

    session.error = null;
    this.emit();
  }

  removeSession(fileId: string): void {
    this.autosaveQueue.cancel(fileId);
    this.autosaveConfigs.delete(fileId);
    this.sessions.delete(fileId);
    if (this.activeFileId === fileId) {
      this.activeFileId = null;
    }
    this.emit();
  }

  reset(): void {
    this.autosaveQueue.clear();
    this.autosaveConfigs.clear();
    this.sessions.clear();
    this.activeFileId = null;
    this.emit();
  }

  setAutosaveConfig(fileId: string, config: AutosaveConfig): void {
    this.autosaveConfigs.set(fileId, config);
    // DO NOT schedule autosave here - it causes infinite loops when configs update
    // Autosave is scheduled only when:
    // 1. Draft content changes (updateDraft)
    // 2. After successful save if still dirty (saveDocument)
  }

  clearAutosaveConfig(fileId: string): void {
    this.autosaveQueue.cancel(fileId);
    this.autosaveConfigs.delete(fileId);
  }

  updateDraft(fileId: string, draftContent: string): void {
    const session = this.sessions.get(fileId);
    if (!session) return;
    if (session.draftContent === draftContent) return;

    session.draftContent = draftContent;
    session.localRevision += 1;
    session.dirty = session.draftContent !== session.serverContent;
    session.error = null;
    this.emit();

    if (session.dirty) {
      this.scheduleAutosave(fileId);
    } else {
      this.autosaveQueue.cancel(fileId);
    }
  }

  markRemoteChanged(fileId: string): void {
    const session = this.sessions.get(fileId);
    if (!session) return;

    session.remoteChanged = true;
    this.emit();
  }

  async activateDocument(file: SqlFile, repository: DocumentRepository): Promise<void> {
    const session = this.ensureSession(file);
    this.activeFileId = file.id;

    const needsReload =
      !session.loadToken &&
      (
        !session.isLoaded ||
        session.serverRevision !== (file.updated_at ?? null) ||
        (!session.dirty && session.serverContent !== (file.content ?? ''))
      );

    if (!session.dirty) {
      session.serverRevision = file.updated_at ?? null;
      session.serverContent = file.content ?? session.serverContent;
      session.draftContent = session.serverContent;
      session.remoteChanged = false;
    }

    session.error = null;

    if (!needsReload) {
      this.emit();
      return;
    }

    const token = createLoadToken();
    const revisionAtLoadStart = session.localRevision;
    session.loading = true;
    session.loadToken = token;
    this.emit();

    try {
      // Add 10-second timeout to prevent hanging loads
      const loadTimeoutMs = 10000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('File load timeout')),
          loadTimeoutMs,
        ),
      );
      const result = await Promise.race([repository.loadFile(file), timeoutPromise]);
      const current = this.sessions.get(file.id);
      if (!current || current.loadToken !== token) {
        return;
      }

      current.loading = false;
      current.loadToken = undefined;
      current.serverContent = result.content;
      current.serverRevision = result.revision;
      current.isLoaded = true;

      if (!current.dirty || current.localRevision === revisionAtLoadStart) {
        current.draftContent = result.content;
        current.dirty = false;
        current.remoteChanged = false;
      } else if (current.draftContent !== result.content) {
        current.remoteChanged = true;
      }

      current.error = null;
      this.emit();
    } catch (error) {
      const current = this.sessions.get(file.id);
      if (!current || current.loadToken !== token) {
        return;
      }

      current.loading = false;
      current.loadToken = undefined;
      current.error = error instanceof Error ? error.message : 'Failed to load file';
      this.emit();
    }
  }

  async flushDocument(fileId: string): Promise<void> {
    const config = this.autosaveConfigs.get(fileId);
    if (!config) return;

    this.autosaveQueue.cancel(fileId);
    await config.save();
  }

  async saveDocument(file: SqlFile, repository: DocumentRepository): Promise<void> {
    const session = this.sessions.get(file.id);
    if (!session || !session.dirty || session.saving) {
      return;
    }

    // Prevent saving if load failed or is in progress
    if (session.error || session.loading) {
      return;
    }

    // Validate content is not empty when server has content (prevents data loss)
    if (!session.draftContent && session.serverContent) {
      session.error = 'Content is empty. Prevented save to avoid data loss.';
      this.emit();
      return;
    }

    // Validate content size (prevent excessively large saves)
    const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB limit
    if (session.draftContent.length > MAX_CONTENT_SIZE) {
      session.error = `Content exceeds maximum size (${Math.round(MAX_CONTENT_SIZE / 1024 / 1024)}MB)`;
      this.emit();
      return;
    }

    // Additional safety: content must be a string
    if (typeof session.draftContent !== 'string') {
      session.error = 'Invalid content type';
      this.emit();
      return;
    }

    const snapshot: DocumentSaveSnapshot = {
      fileId: file.id,
      draftContent: session.draftContent,
      baseServerRevision: session.serverRevision,
      localRevision: session.localRevision,
    };

    session.saving = true;
    session.inFlightSaveRevision = snapshot.localRevision;
    session.error = null;
    this.emit();

    try {
      const result = await repository.saveFile(file, snapshot);
      const current = this.sessions.get(file.id);
      if (!current) return;

      current.saving = false;
      current.inFlightSaveRevision = undefined;
      current.serverContent = result.content;
      current.serverRevision = result.revision;
      current.lastSavedAt = Date.now();
      current.error = null;

      if (current.localRevision === snapshot.localRevision) {
        current.draftContent = result.content;
        current.dirty = false;
        current.remoteChanged = false;
      } else {
        current.dirty = current.draftContent !== current.serverContent;
      }

      this.emit();

      if (current.dirty) {
        this.scheduleAutosave(file.id, 0);
      }
    } catch (error) {
      const current = this.sessions.get(file.id);
      if (!current) return;

      current.saving = false;
      current.inFlightSaveRevision = undefined;
      current.error = error instanceof Error ? error.message : 'Failed to save file';
      current.remoteChanged = true;
      this.emit();
    }
  }

  private scheduleAutosave(fileId: string, delayOverride?: number): void {
    const config = this.autosaveConfigs.get(fileId);
    const session = this.sessions.get(fileId);

    // Prevent autosave while file is loading (fixes race condition)
    if (!config || !config.enabled || !session?.dirty || session.loading) {
      return;
    }

    this.autosaveQueue.schedule(
      fileId,
      delayOverride ?? config.debounceMs,
      () => {
        void config.save();
      },
    );
  }

  private emit(): void {
    this.version += 1;
    for (const listener of this.listeners) {
      listener();
    }
  }
}

const documentSessionStore = new DocumentSessionStore();

export function getDocumentSessionStore(): DocumentSessionStore {
  return documentSessionStore;
}
