import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRepository } from '@/api/fileRepository';
import { config } from '@/lib/config';
import type { SqlFile } from '@/lib/file-management/api/client';
import { getDocumentSessionStore } from '@/editor/documentSessionStore';
import { useAutosave } from '@/lib/file-management/hooks/useAutosave';

interface UseDocumentSessionOptions {
  file: SqlFile | null;
  userId?: string;
  autosaveEnabled: boolean;
  debounceMs?: number;
}

export function useDocumentStoreVersion(): number {
  const store = getDocumentSessionStore();
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getVersion(),
    () => 0,
  );
}

export function useDocumentSession({
  file,
  userId,
  autosaveEnabled,
  debounceMs = config.autosave.debounceMs,
}: UseDocumentSessionOptions) {
  const queryClient = useQueryClient();
  const store = getDocumentSessionStore();
  const repository = useMemo(
    () => createFileRepository({ userId, queryClient }),
    [userId, queryClient],
  );

  const fileId = file?.id ?? null;
  const snapshot = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(fileId),
    () => store.getSnapshot(fileId),
  );
  const previousFileIdRef = useRef<string | null>(null);
  const previousFileRef = useRef<SqlFile | null>(file);
  const previousUserIdRef = useRef<string | undefined>(userId);

  useEffect(() => {
    if (previousUserIdRef.current !== userId) {
      store.reset();
      previousUserIdRef.current = userId;
    }
  }, [store, userId]);

  useEffect(() => {
    const previousFileId = previousFileIdRef.current;
    const previousFile = previousFileRef.current;

    if (previousFileId && previousFile && previousFileId !== fileId && autosaveEnabled) {
      void store.saveDocument(previousFile, repository);
    }

    previousFileIdRef.current = fileId;
    previousFileRef.current = file;
  }, [file, fileId, autosaveEnabled, repository, store]);

  useEffect(() => {
    if (!file) {
      store.setActiveFile(null);
      return;
    }

    void store.activateDocument(file, repository);
  }, [file, repository, store]);

  useAutosave({
    file,
    repository,
    enabled: autosaveEnabled,
    debounceMs,
  });

  useEffect(() => {
    const flushActiveDocument = () => {
      if (fileId) {
        void store.flushDocument(fileId);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        flushActiveDocument();
      }
    };

    window.addEventListener('pagehide', flushActiveDocument);
    window.addEventListener('beforeunload', flushActiveDocument);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', flushActiveDocument);
      window.removeEventListener('beforeunload', flushActiveDocument);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fileId, store]);

  const setSql = useCallback((nextSql: string) => {
    if (!fileId) return;
    store.updateDraft(fileId, nextSql);
  }, [fileId, store]);

  const saveNow = useCallback(async (contentOverride?: string) => {
    if (!file) return;
    if (typeof contentOverride === 'string') {
      store.updateDraft(file.id, contentOverride);
    }
    await store.saveDocument(file, repository);
  }, [file, repository, store]);

  return {
    session: snapshot.session,
    sql: snapshot.session?.draftContent ?? '',
    loading: snapshot.session?.loading ?? false,
    saving: snapshot.session?.saving ?? false,
    dirty: snapshot.session?.dirty ?? false,
    remoteChanged: snapshot.session?.remoteChanged ?? false,
    error: snapshot.session?.error ?? null,
    lastSavedAt: fileId ? store.getLastSavedAt(fileId) : null,
    setSql,
    saveNow,
  };
}
