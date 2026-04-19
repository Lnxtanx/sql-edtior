import { useEffect, useCallback } from 'react';
import type { SqlFile } from '../api/client';
import type { DocumentRepository } from '@/editor/documentSessionTypes';
import { getDocumentSessionStore } from '@/editor/documentSessionStore';

interface UseAutosaveOptions {
  file: SqlFile | null;
  repository: DocumentRepository;
  enabled: boolean;
  debounceMs: number;
}

export function useAutosave({
  file,
  repository,
  enabled,
  debounceMs,
}: UseAutosaveOptions): void {
  const store = getDocumentSessionStore();

  // Memoize the save function to prevent unnecessary config updates
  const handleSave = useCallback(async () => {
    if (!file) return;
    await store.saveDocument(file, repository);
  }, [file, repository, store]);

  useEffect(() => {
    if (!file) return;

    store.setAutosaveConfig(file.id, {
      enabled,
      debounceMs,
      save: handleSave,
    });
  }, [file, enabled, debounceMs, handleSave, store]);
}
