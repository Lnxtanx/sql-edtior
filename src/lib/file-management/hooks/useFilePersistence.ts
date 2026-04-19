/**
 * useFilePersistence.ts
 *
 * Persistence, preferences, and sync management
 * Responsibilities:
 * - Autosave toggle and state
 * - User preferences tracking
 * - Network status monitoring
 * - Sync subscription and cache invalidation
 * - File import/export operations
 * - Pending operations awareness
 */

import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getDocumentSessionStore } from '@/editor/documentSessionStore';
import {
  getUserPreferences,
  updateUserPreferences,
} from '@/lib/cookies';
import {
  subscribeToSync,
  getNetworkStatus,
  subscribeToNetworkStatus,
  hasPendingOperations as checkPendingOps,
} from '@/lib/file-management/storage/core';
import { queryKeys } from '@/lib/queryClient';
import type { SqlFile } from '@/lib/file-management/api/client';

interface UseFilePersistenceParams {
  currentFile: SqlFile | null;
  isGuest: boolean;
}

interface UseFilePersistenceReturn {
  // Autosave
  autosaveEnabled: boolean;
  toggleAutosave: () => void;
  hasPendingChanges: boolean;

  // Network
  isOnline: boolean;
  hasPendingOperations: boolean;

  // File operations
  downloadCurrentFile: () => void;
  importFile: (content: string, fileName: string) => Promise<SqlFile | null>;
  getMergedSQL: (files: SqlFile[], activeRootId: string | null) => string;
}

export function useFilePersistence({
  currentFile,
  isGuest,
}: UseFilePersistenceParams): UseFilePersistenceReturn {
  const qc = useQueryClient();
  const documentStore = getDocumentSessionStore();

  // Autosave state
  const [autosaveEnabled, setAutosaveEnabled] = useState(
    () => getUserPreferences()?.autosaveEnabled ?? true
  );

  // Network state
  const [isOnline, setIsOnline] = useState(getNetworkStatus());
  const [hasPendingOperations, setHasPendingOperations] = useState(false);

  // Subscribe to network status
  useEffect(() => {
    const unsubscribe = subscribeToNetworkStatus(setIsOnline);
    return unsubscribe;
  }, []);

  // Check for pending operations periodically
  useEffect(() => {
    const checkPending = async () => {
      const pending = await checkPendingOps();
      setHasPendingOperations(pending);
    };

    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, []);

  // Track pending changes in current file
  const hasPendingChanges = currentFile
    ? documentStore.getDraftContent(currentFile.id, currentFile.content ?? '') !==
      (currentFile.content ?? '')
    : false;

  // Toggle autosave
  const toggleAutosave = useCallback(() => {
    setAutosaveEnabled(prev => {
      const nextValue = !prev;
      updateUserPreferences({ autosaveEnabled: nextValue });
      toast.success(nextValue ? 'Autosave enabled' : 'Autosave disabled');
      return nextValue;
    });
  }, []);

  // Download current file as text
  const downloadCurrentFile = useCallback(() => {
    const file = currentFile;
    if (!file) return;

    const content = documentStore.getDraftContent(file.id, file.content ?? '');
    const fileName = file.title || 'schema.sql';

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded "${fileName}"`);
  }, [currentFile, documentStore]);

  // Import file (stub - actual implementation in useFileOperations)
  const importFile = useCallback(async (
    content: string,
    fileName: string
  ): Promise<SqlFile | null> => {
    // This is a stub - actual creation is handled by createNewFile in useFileOperations
    // This just validates and accepts the import
    if (!content || !fileName) {
      toast.error('Invalid file to import');
      return null;
    }
    return null; // Real implementation returns created file
  }, []);

  // Merge SQL from multiple files
  const getMergedSQL = useCallback((
    files: SqlFile[],
    activeRootId: string | null
  ): string => {
    let scopeFiles = files;

    // If in workspace mode, get only files in that workspace
    if (activeRootId) {
      const workspaceRoot = files.find(f => f.id === activeRootId);
      if (workspaceRoot) {
        scopeFiles = files.filter(f => {
          if (f.id === activeRootId) return true;
          let current: SqlFile | undefined = f;
          while (current) {
            if (current.id === activeRootId) return true;
            current = files.find(file => file.id === current!.parent_id);
          }
          return false;
        });
      }
    }

    return scopeFiles
      .filter(f => !f.is_folder && f.content)
      .map(f => f.content ?? '')
      .join('\n\n');
  }, []);

  return {
    // Autosave
    autosaveEnabled,
    toggleAutosave,
    hasPendingChanges,

    // Network
    isOnline,
    hasPendingOperations,

    // File operations
    downloadCurrentFile,
    importFile,
    getMergedSQL,
  };
}
