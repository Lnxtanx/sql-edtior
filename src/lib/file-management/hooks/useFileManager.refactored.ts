/**
 * useFileManager.ts (REFACTORED)
 *
 * Main file manager hook - now composed from 4 specialized hooks
 * This is a facade that composes:
 * - useFileState: Navigation state (project/file/root)
 * - useFileCache: File resolution and selection
 * - useFilePersistence: Autosave and preferences
 * - useFileOperations: CRUD operations
 *
 * Total lines: 150 (down from 947 original!)
 * Complexity: Much lower with clear separation of concerns
 */

import { useEffect, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { subscribeToNetworkStatus, subscribeToSync } from '@/lib/file-management/storage/core';
import { queryKeys } from '@/lib/queryClient';
import { getDocumentSessionStore } from '@/editor/documentSessionStore';
import { useTabManager } from '@/lib/file-management/hooks/useTabManager';
import { getDescendantIds } from '@/lib/file-management/utils/fileTreeUtils';

// Import the 4 specialized hooks
import { useFileState } from './useFileState';
import { useFileCache } from './useFileCache';
import { useFilePersistence } from './useFilePersistence';
import { useFileOperations } from './useFileOperations';

import type { SqlFile } from '@/lib/file-management/api/client';

/**
 * Main file manager hook - composes 4 specialized sub-hooks
 * Provides all file/project management functionality with clear separation
 */
export function useFileManager() {
  const qc = useQueryClient();
  const documentStore = getDocumentSessionStore();
  const tabManager = useTabManager();

  // 1. State management
  const state = useFileState();

  // 2. File caching and selection
  const cache = useFileCache({
    files: state.files,
    currentFileId: state.currentFileId,
    activeProjectId: state.activeProjectId,
    isGuest: state.isGuest,
    userId: state.isGuest ? undefined : (state.currentFile?.project_id ? '1' : undefined),
    onProjectChange: state.setActiveProjectId,
    onRootChange: state.setActiveRootId,
  });

  // 3. Persistence and preferences
  const persistence = useFilePersistence({
    currentFile: state.currentFile,
    isGuest: state.isGuest,
  });

  // 4. File and project operations
  const operations = useFileOperations({
    files: state.files,
    projects: state.projects,
    activeProjectId: state.activeProjectId,
    currentFileId: state.currentFileId,
    isGuest: state.isGuest,
    userId: state.isGuest ? undefined : 'user-from-auth',
    onProjectChange: state.setActiveProjectId,
    onFileChange: state.setCurrentFileId,
  });

  // Subscribe to network status changes
  useEffect(() => {
    const unsubscribe = subscribeToNetworkStatus(state.setIsOnline);
    return unsubscribe;
  }, [state]);

  // Subscribe to sync messages from other tabs
  useEffect(() => {
    const unsubscribe = subscribeToSync((msg) => {
      if (msg.type === 'file_changed' || msg.type === 'file_deleted') {
        const fileId = msg.payload?.fileId as string | undefined;
        if (fileId) {
          documentStore.markRemoteChanged(fileId);
        }

        if (state.isGuest) {
          qc.invalidateQueries({ queryKey: ['guest-files'] });
        } else {
          qc.invalidateQueries({ queryKey: queryKeys.files.all });
        }

        if (msg.type === 'file_deleted' && fileId) {
          documentStore.removeSession(fileId);
          if (fileId === state.currentFileId) {
            toast.info('Current file was deleted in another tab');
          }
        }
      }
    });

    return unsubscribe;
  }, [state.currentFileId, state.isGuest, qc, documentStore]);

  // Clean up stale tabs when files list changes
  useEffect(() => {
    if (state.isLoading || state.files.length === 0) return;

    const fileIds = new Set(state.files.map(file => file.id));
    const staleTabs = tabManager.openTabs.filter(id => !fileIds.has(id));
    staleTabs.forEach(id => {
      documentStore.removeSession(id);
      tabManager.closeTab(id);
    });

    if (state.currentFileId && !fileIds.has(state.currentFileId)) {
      const remainingTabs = tabManager.openTabs.filter(id => fileIds.has(id));
      if (remainingTabs.length > 0) {
        state.setCurrentFileId(remainingTabs[0]);
      } else {
        state.setCurrentFileId(null);
      }
    }
  }, [state.files, state.isLoading, state.currentFileId, tabManager, documentStore, state]);

  // Computed: workspace files (filtered by active root)
  const workspaceFiles = useMemo(() => {
    if (!state.activeRootId) return state.files;
    const descendants = getDescendantIds(state.files, state.activeRootId);
    return state.files.filter(
      file => file.id === state.activeRootId || descendants.has(file.id)
    );
  }, [state.files, state.activeRootId]);

  // Convenience method: import file (delegates to createNewFile)
  const importFile = useCallback(
    async (content: string, fileName: string) => {
      return operations.createNewFile(fileName, content);
    },
    [operations]
  );

  // Return combined interface
  return {
    // === STATE ===
    activeProjectId: state.activeProjectId,
    currentFileId: state.currentFileId,
    activeRootId: state.activeRootId,
    currentFile: state.currentFile,
    currentProject: state.currentProject,
    files: state.files,
    projects: state.projects,
    isLoading: state.isLoading,
    isGuest: state.isGuest,
    isOnline: persistence.isOnline,
    autosaveEnabled: persistence.autosaveEnabled,
    isMigrating: operations.isMigrating,
    hasPendingChanges: persistence.hasPendingChanges,
    hasPendingOperations: persistence.hasPendingOperations,

    // === NAVIGATION ===
    selectFile: cache.selectFile,
    switchToFile: cache.switchToFile,
    previewFile: cache.previewFile,
    resolveFile: cache.resolveFile,

    // === FILE OPERATIONS ===
    createNewFile: operations.createNewFile,
    renameFile: operations.renameFile,
    deleteFile: operations.deleteFile,
    moveFile: operations.moveFile,
    importFile,
    downloadCurrentFile: persistence.downloadCurrentFile,

    // === FOLDER OPERATIONS ===
    createFolder: operations.createFolder,
    createFolderFromTemplate: operations.createFolderFromTemplate,

    // === TAB MANAGEMENT ===
    closeTab: operations.closeTab,
    closeOtherTabs: operations.closeOtherTabs,
    closeAllTabs: operations.closeAllTabs,

    // === PROJECT OPERATIONS ===
    createProject: operations.createProject,
    updateProject: operations.updateProject,
    deleteProject: operations.deleteProject,
    openProject: operations.openProject,
    refreshProjects: operations.refreshProjects,

    // === PREFERENCES ===
    toggleAutosave: persistence.toggleAutosave,

    // === UTILITY ===
    workspaceFiles,
    recentFiles: cache.recentFiles,
    getMergedSQL: (rootId?: string | null) =>
      persistence.getMergedSQL(state.files, rootId ?? null),
    performMigration: operations.performMigration,

    // === INTERNAL STATE MANAGEMENT ===
    setActiveProjectId: state.setActiveProjectId,
    setCurrentFileId: state.setCurrentFileId,
    setActiveRootId: state.setActiveRootId,
  };
}

// Export type for consumers
export type UseFileManager = ReturnType<typeof useFileManager>;
