/**
 * useFileCache.ts
 *
 * File resolution and caching orchestration
 * Responsibilities:
 * - Resolve file content from API (lazy loading)
 * - Manage file selection flow (project/root/tab coordination)
 * - Handle preview vs edit modes
 * - Prime DocumentSessionStore with file content
 * - Track recently accessed files
 * - Cache resolved files to minimize API calls
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getDocumentSessionStore } from '@/editor/documentSessionStore';
import {
  getFile as apiGetFile,
  type SqlFile,
} from '@/lib/file-management/api/client';
import {
  addRecentFile,
  getRecentFiles,
  updateUserPreferences,
  type RecentFile,
} from '@/lib/cookies';
import { broadcastSync } from '@/lib/file-management/storage/core';
import { useTabManager } from '@/lib/file-management/hooks/useTabManager';
import { useUpdateFile } from '@/lib/file-management/hooks/useFileMutations';
import { getWorkspaceRootId } from '@/lib/file-management/utils/fileTreeUtils';

interface UseFileCacheParams {
  files: SqlFile[];
  currentFileId: string | null;
  activeProjectId: string | null;
  isGuest: boolean;
  userId?: string;
  onProjectChange?: (projectId: string | null) => void;
  onRootChange?: (rootId: string | null) => void;
}

interface UseFileCacheReturn {
  currentFile: SqlFile | null;
  recentFiles: RecentFile[];
  resolvedFileVersion: number;
  selectFile: (fileId: string, preview?: boolean) => Promise<SqlFile | null>;
  switchToFile: (fileId: string) => Promise<SqlFile | null>;
  previewFile: (fileId: string) => Promise<SqlFile | null>;
  resolveFile: (fileId: string) => Promise<SqlFile | null>;
}

export function useFileCache({
  files,
  currentFileId,
  activeProjectId,
  isGuest,
  userId,
  onProjectChange,
  onRootChange,
}: UseFileCacheParams): UseFileCacheReturn {
  const qc = useQueryClient();
  const tabManager = useTabManager();
  const documentStore = getDocumentSessionStore();
  const authUpdate = useUpdateFile(userId, activeProjectId);

  // Cache for resolved files (content loaded from API)
  const resolvedFilesRef = useRef<Map<string, SqlFile>>(new Map());

  // Track version for reactivity
  const [resolvedFileVersion, setResolvedFileVersion] = useState(0);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(getRecentFiles);

  // Resolve file content (lazy load from API if needed)
  const resolveFile = useCallback(async (fileId: string): Promise<SqlFile | null> => {
    const existing = files.find(file => file.id === fileId) ?? resolvedFilesRef.current.get(fileId);
    
    // Return if already have content
    if (existing && (existing.is_folder || typeof existing.content === 'string')) {
      return existing;
    }
    
    // Guest files always have content in memory
    if (isGuest && existing) return existing;
    if (isGuest) return null;

    // Fetch from API
    try {
      const { file } = await apiGetFile(fileId);
      resolvedFilesRef.current.set(file.id, file);
      setResolvedFileVersion(prev => prev + 1);
      return file;
    } catch (error) {
      console.error('Failed to resolve file:', error);
      return null;
    }
  }, [files, isGuest]);

  // Main file selection orchestration
  const selectFile = useCallback(
    async (fileId: string, preview = false) => {
      const file = await resolveFile(fileId);
      if (!file || file.is_folder) return null;

      // Update project context if needed
      if (file.project_id && onProjectChange) {
        onProjectChange(file.project_id);
      }

      // Update root context for guest mode
      if (isGuest && onRootChange) {
        const rootId = file.parent_id ? getWorkspaceRootId(files, file) : null;
        onRootChange(rootId);
      }

      // Open/preview tab
      if (preview) {
        tabManager.openPreviewTab(file.id);
      } else {
        tabManager.openTab(file.id);
      }

      // Update preferences
      updateUserPreferences({
        lastFileId: file.id,
        lastProjectId: file.project_id ?? activeProjectId ?? undefined,
      });

      // Track in recent files
      addRecentFile({ id: file.id, title: file.title });
      setRecentFiles(getRecentFiles());

      // Prime session store with content
      documentStore.setActiveFile(file.id);

      // Mark as current on server (auth only)
      if (userId) {
        authUpdate.mutate({ id: file.id, is_current: true });
      }

      // Broadcast to other tabs
      broadcastSync({
        type: 'file_switched',
        payload: { fileId: file.id, title: file.title },
      });

      return file;
    },
    [resolveFile, isGuest, files, onProjectChange, onRootChange, tabManager, activeProjectId, documentStore, userId, authUpdate]
  );

  // Convenience wrappers
  const switchToFile = useCallback(
    async (fileId: string) => selectFile(fileId, false),
    [selectFile]
  );

  const previewFile = useCallback(
    async (fileId: string) => selectFile(fileId, true),
    [selectFile]
  );

  // Current file (computed)
  const currentFile = files.find(file => file.id === currentFileId) ?? resolvedFilesRef.current.get(currentFileId ?? '') ?? null;

  return {
    currentFile,
    recentFiles,
    resolvedFileVersion,
    selectFile,
    switchToFile,
    previewFile,
    resolveFile,
  };
}
