/**
 * useFileOperations.ts
 *
 * File and project CRUD operations
 * Responsibilities:
 * - File creation/deletion/renaming/moving
 * - Folder operations
 * - Project lifecycle (create/update/delete)
 * - Guest mode operations
 * - Demo bootstrap (auth & guest)
 * - Local to cloud migration
 * - Tab lifecycle orchestration
 * - Project/workspace switching
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/AuthProvider';
import { SAMPLE_SQL } from '@/lib/sql-parser';
import { queryKeys } from '@/lib/queryClient';
import {
  getUserPreferences,
  updateUserPreferences,
  addRecentFile,
  getRecentFiles,
} from '@/lib/cookies';
import { getDocumentSessionStore } from '@/editor/documentSessionStore';
import {
  createFile as apiCreateFile,
  createProject as apiCreateProject,
  type SqlFile,
  type Project,
} from '@/lib/file-management/api/client';
import {
  MAX_LOCAL_FILES,
  getFilesForMigration,
  completeMigration,
  hasLocalFiles,
  createLocalFile as createLocalFileDirectly,
} from '@/lib/file-management/storage/local-files';
import { broadcastSync } from '@/lib/file-management/storage/core';
import {
  useCreateFile,
  useUpdateFile,
  useDeleteFile,
  useRenameFile,
  useCreateFolder,
  useCreateFolderFromTemplate,
  useMoveFile,
  useCreateProject,
  useBootstrapProject,
  useUpdateProject,
  useDeleteProject,
} from '@/lib/file-management/hooks/useFileMutations';
import {
  useGuestCreateFile,
  useGuestDeleteFile,
  useGuestRenameFile,
  useGuestCreateFolder,
  useGuestMoveFile,
} from '@/lib/file-management/hooks/useGuestFiles';
import { useTabManager } from '@/lib/file-management/hooks/useTabManager';
import { getWorkspaceRootId } from '@/lib/file-management/utils/fileTreeUtils';
import type { CreateFileLocation } from '@/lib/file-management/utils/fileTreeUtils';

interface UseFileOperationsParams {
  files: SqlFile[];
  projects: Project[];
  activeProjectId: string | null;
  currentFileId: string | null;
  isGuest: boolean;
  userId?: string;
  onProjectChange?: (id: string | null) => void;
  onFileChange?: (id: string | null) => void;
}

interface UseFileOperationsReturn {
  // File operations
  createNewFile: (title?: string, content?: string, location?: CreateFileLocation, projectId?: string | null) => Promise<SqlFile>;
  renameFile: (fileId: string, newTitle: string) => Promise<any>;
  deleteFile: (fileId: string) => Promise<void>;
  moveFile: (fileId: string, parentId: string | null, sortOrder?: number) => Promise<any>;

  // Folder operations
  createFolder: (title?: string, parentId?: string | null, projectId?: string | null) => Promise<any>;
  createFolderFromTemplate: (title: string, parentId: string | null, subfolders: string[], projectId?: string | null) => Promise<void>;

  // Tab management
  closeTab: (fileId: string) => void;
  closeOtherTabs: (keepId: string) => void;
  closeAllTabs: () => void;

  // Project operations
  createProject: (params: { name: string; description?: string; connectionId?: string; teamId?: string }) => Promise<SqlFile | Project>;
  updateProject: (id: string, params: { name?: string; description?: string; teamId?: string | null }) => Promise<any>;
  deleteProject: (id: string) => Promise<void>;
  openProject: (rootId: string | null, projectId?: string | null) => void;
  refreshProjects: () => Promise<void>;

  // Migration
  isMigrating: boolean;
  performMigration: () => Promise<void>;
}

export function useFileOperations({
  files,
  projects,
  activeProjectId,
  currentFileId,
  isGuest,
  userId,
  onProjectChange,
  onFileChange,
}: UseFileOperationsParams): UseFileOperationsReturn {
  const { user } = useAuth();
  const qc = useQueryClient();
  const documentStore = getDocumentSessionStore();
  const tabManager = useTabManager();

  // Auth mutations
  const authCreate = useCreateFile(userId, activeProjectId);
  const authUpdate = useUpdateFile(userId, activeProjectId);
  const authDelete = useDeleteFile(userId, activeProjectId);
  const authRename = useRenameFile(userId, activeProjectId);
  const authCreateFolder = useCreateFolder(userId, activeProjectId);
  const authCreateFolderFromTemplate = useCreateFolderFromTemplate(userId, activeProjectId);
  const authMoveFile = useMoveFile(userId, activeProjectId);
  const authCreateProject = useCreateProject(userId);
  const authBootstrapProject = useBootstrapProject(userId);
  const authUpdateProject = useUpdateProject(userId);
  const authDeleteProject = useDeleteProject(userId);

  // Guest mutations
  const guestCreate = useGuestCreateFile();
  const guestDelete = useGuestDeleteFile();
  const guestRename = useGuestRenameFile();
  const guestCreateFolder = useGuestCreateFolder();
  const guestMoveFile = useGuestMoveFile();

  // Migration state
  const [isMigrating, setIsMigrating] = useState(false);
  const migrationInProgressRef = useRef(false);
  const bootstrappedProjectRef = useRef<string | null>(null);

  // Create file
  const createNewFile = useCallback(
    async (
      title?: string,
      content?: string,
      location?: CreateFileLocation,
      projectId?: string | null
    ) => {
      const newTitle = title || `Schema ${new Date().toLocaleDateString()}`;
      const newContent = content ?? '';

      let parentId: string | null = null;
      let targetProjectId: string | null = projectId ?? activeProjectId ?? null;
      let fileExtension: string | undefined = undefined;

      if (typeof location === 'string') {
        parentId = location;
      } else if (location && typeof location === 'object') {
        parentId = location.parent_id ?? null;
        targetProjectId = location.project_id ?? targetProjectId;
        fileExtension = location.file_extension;
      } else if (location === null) {
        parentId = null;
      }

      const file = isGuest
        ? await guestCreate.mutateAsync({
            title: newTitle,
            parent_id: parentId,
            file_extension: fileExtension,
          })
        : await authCreate.mutateAsync({
            title: newTitle,
            parent_id: parentId,
            project_id: targetProjectId,
            file_extension: fileExtension,
          });

      // Prime session store
      documentStore.primeSession(file, newContent);
      onFileChange?.(file.id);
      tabManager.openTab(file.id);
      documentStore.setActiveFile(file.id);
      updateUserPreferences({
        lastFileId: file.id,
        lastProjectId: file.project_id ?? targetProjectId ?? undefined,
      });
      addRecentFile({ id: file.id, title: file.title });

      return file;
    },
    [isGuest, activeProjectId, guestCreate, authCreate, documentStore, tabManager, onFileChange]
  );

  // Rename file
  const renameFile = useCallback(
    async (fileId: string, newTitle: string) => {
      if (isGuest) {
        return guestRename.mutateAsync({ id: fileId, title: newTitle });
      }
      return authRename.mutateAsync({ id: fileId, title: newTitle });
    },
    [isGuest, guestRename, authRename]
  );

  // Delete file
  const deleteFile = useCallback(
    async (fileId: string) => {
      const remaining = files.filter(file => file.id !== fileId && !file.is_folder);

      if (isGuest) {
        await guestDelete.mutateAsync(fileId);
      } else {
        await authDelete.mutateAsync(fileId);
      }

      documentStore.removeSession(fileId);
      tabManager.closeTab(fileId);

      if (currentFileId === fileId) {
        if (remaining.length > 0) {
          onFileChange?.(remaining[0].id);
        } else {
          onFileChange?.(null);
          documentStore.setActiveFile(null);
          updateUserPreferences({ lastFileId: undefined });
        }
      }
    },
    [files, isGuest, guestDelete, authDelete, documentStore, tabManager, currentFileId, onFileChange]
  );

  // Move file
  const moveFile = useCallback(
    async (fileId: string, parentId: string | null, sortOrder?: number) => {
      if (isGuest) {
        return guestMoveFile.mutateAsync({ id: fileId, parent_id: parentId, sort_order: sortOrder });
      }
      return authMoveFile.mutateAsync({ id: fileId, parent_id: parentId, sort_order: sortOrder });
    },
    [isGuest, guestMoveFile, authMoveFile]
  );

  // Create folder
  const createFolder = useCallback(
    async (title?: string, parentId?: string | null, projectId?: string | null) => {
      const folderTitle = title || 'New Folder';

      if (isGuest) {
        return guestCreateFolder.mutateAsync({ title: folderTitle, parent_id: parentId });
      }

      return authCreateFolder.mutateAsync({
        title: folderTitle,
        parent_id: parentId,
        project_id: projectId || activeProjectId,
      });
    },
    [isGuest, activeProjectId, guestCreateFolder, authCreateFolder]
  );

  // Create folder from template
  const createFolderFromTemplate = useCallback(
    async (
      title: string,
      parentId: string | null,
      subfolders: string[],
      projectId?: string | null
    ) => {
      if (isGuest) {
        const rootFolder = await createLocalFileDirectly({
          title,
          content: '',
          is_folder: true,
          parent_id: parentId,
        });

        for (const sub of subfolders) {
          await createLocalFileDirectly({
            title: sub,
            content: '',
            is_folder: true,
            parent_id: rootFolder.id,
          });
        }

        await qc.invalidateQueries({ queryKey: ['guest-files'] });
        broadcastSync({ type: 'file_changed', payload: { fileId: rootFolder.id } });
        toast.success(`Project "${title}" created with ${subfolders.length} subfolders`);
        return;
      }

      await authCreateFolderFromTemplate.mutateAsync({
        title,
        parent_id: parentId,
        project_id: projectId || activeProjectId,
        subfolders,
      });
    },
    [isGuest, activeProjectId, qc, authCreateFolderFromTemplate]
  );

  // Tab management
  const closeTab = useCallback(
    (fileId: string) => {
      tabManager.closeTab(fileId);

      if (currentFileId === fileId) {
        const remainingTabs = tabManager.openTabs.filter(id => id !== fileId);
        const nextId = remainingTabs.length > 0
          ? remainingTabs[Math.min(tabManager.openTabs.indexOf(fileId), remainingTabs.length - 1)]
          : null;

        onFileChange?.(nextId);
        documentStore.setActiveFile(nextId);

        if (nextId) {
          updateUserPreferences({
            lastFileId: nextId,
            lastProjectId: files.find(f => f.id === nextId)?.project_id ?? activeProjectId ?? undefined,
          });
        } else {
          updateUserPreferences({ lastFileId: undefined });
        }
      }
    },
    [tabManager, currentFileId, documentStore, files, activeProjectId, onFileChange]
  );

  const closeOtherTabs = useCallback(
    (keepId: string) => {
      tabManager.closeOtherTabs(keepId);
      if (currentFileId !== keepId) {
        onFileChange?.(keepId);
        documentStore.setActiveFile(keepId);
        updateUserPreferences({
          lastFileId: keepId,
          lastProjectId: files.find(f => f.id === keepId)?.project_id ?? activeProjectId ?? undefined,
        });
      }
    },
    [tabManager, currentFileId, documentStore, files, activeProjectId, onFileChange]
  );

  const closeAllTabs = useCallback(() => {
    tabManager.closeAllTabs();
    onFileChange?.(null);
    documentStore.setActiveFile(null);
    updateUserPreferences({ lastFileId: undefined });
  }, [tabManager, documentStore, onFileChange]);

  // Project operations
  const openProject = useCallback(
    (rootId: string | null, projectId?: string | null) => {
      tabManager.closeAllTabs();
      onFileChange?.(null);
      documentStore.setActiveFile(null);
      onProjectChange?.(projectId ?? null);
      updateUserPreferences({
        lastFileId: undefined,
        lastProjectId: projectId ?? undefined,
      });
    },
    [tabManager, documentStore, onProjectChange, onFileChange]
  );

  const createProject = useCallback(
    async (params: { name: string; description?: string; connectionId?: string; teamId?: string }) => {
      if (isGuest) {
        const projectFolder = await createLocalFileDirectly({
          title: params.name.trim() || 'New Project',
          content: '',
          is_folder: true,
        });
        const mainFolder = await createLocalFileDirectly({
          title: 'Main',
          content: '',
          is_folder: true,
          parent_id: projectFolder.id,
        });
        const schemaFile = await createLocalFileDirectly({
          title: 'schema.sql',
          content: files.length === 0 ? SAMPLE_SQL : '',
          parent_id: mainFolder.id,
          file_extension: 'sql',
        });

        await qc.invalidateQueries({ queryKey: ['guest-files'] });
        const guestFile: SqlFile = {
          id: schemaFile.id,
          title: schemaFile.title,
          content: schemaFile.content,
          parent_id: schemaFile.parent_id,
          is_folder: schemaFile.is_folder,
          file_extension: schemaFile.file_extension,
          sort_order: schemaFile.sort_order,
          created_at: schemaFile.createdAt,
          updated_at: schemaFile.updatedAt,
        };

        documentStore.primeSession(guestFile, guestFile.content);
        broadcastSync({ type: 'file_changed', payload: { fileId: schemaFile.id } });
        tabManager.closeAllTabs();
        onFileChange?.(schemaFile.id);
        documentStore.setActiveFile(schemaFile.id);
        tabManager.openTab(schemaFile.id);
        updateUserPreferences({
          lastFileId: schemaFile.id,
          lastProjectId: undefined,
        });
        addRecentFile({ id: schemaFile.id, title: schemaFile.title });
        toast.success(`Project "${projectFolder.title}" created`);
        return projectFolder;
      }

      return authCreateProject.mutateAsync(params);
    },
    [isGuest, files.length, qc, documentStore, tabManager, authCreateProject, onFileChange]
  );

  const updateProject = useCallback(
    async (id: string, params: { name?: string; description?: string; teamId?: string | null }) => {
      return authUpdateProject.mutateAsync({ id, params });
    },
    [authUpdateProject]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      await authDeleteProject.mutateAsync(id);
      toast.success('Project deleted');

      if (activeProjectId === id) {
        onProjectChange?.(null);
        onFileChange?.(null);
        documentStore.setActiveFile(null);
        updateUserPreferences({ lastFileId: undefined, lastProjectId: undefined });
      }
    },
    [authDeleteProject, activeProjectId, documentStore, onProjectChange, onFileChange]
  );

  // Refresh projects
  const refreshProjects = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: queryKeys.projects.all });
  }, [qc]);

  // Migration
  const performMigration = useCallback(async () => {
    if (!userId || migrationInProgressRef.current) return;

    const migrationFlag = `sw_migrated_${userId}`;
    if (localStorage.getItem(migrationFlag)) return;
    if (!(await hasLocalFiles())) return;

    const toSync = await getFilesForMigration();
    if (toSync.length === 0) {
      await completeMigration();
      return;
    }

    migrationInProgressRef.current = true;
    setIsMigrating(true);
    toast.info(`Syncing ${toSync.length} local files to cloud...`);

    let synced = 0;
    let migrationProjectId: string | null = null;
    const migrationProjectName = `Imported Workspace ${new Date().toLocaleDateString()}`;

    try {
      const existingImportedProject = projects.find(
        p => p.name.startsWith('Imported Workspace') && p.owner_id === userId
      );

      if (existingImportedProject) {
        migrationProjectId = existingImportedProject.id;
      } else {
        try {
          const { project } = await apiCreateProject({
            name: migrationProjectName,
            description: 'Migrated from guest workspace',
          });
          migrationProjectId = project.id;
        } catch (err: any) {
          if (err?.code === '23505' || err?.status === 500) {
            const uniqueName = `${migrationProjectName} (${new Date().toLocaleTimeString()})`;
            const { project } = await apiCreateProject({
              name: uniqueName,
              description: 'Migrated from guest workspace',
            });
            migrationProjectId = project.id;
          } else {
            migrationProjectId = activeProjectId;
          }
        }
      }
    } catch (err) {
      migrationProjectId = activeProjectId;
    }

    if (!migrationProjectId) {
      toast.error('Could not create a project for migrated local files');
      migrationInProgressRef.current = false;
      setIsMigrating(false);
      return;
    }

    for (const file of toSync) {
      try {
        await apiCreateFile({
          title: file.title,
          content: file.content,
          file_extension: file.file_extension,
          project_id: migrationProjectId,
        });
        synced++;
      } catch {
        // Best effort migration
      }
    }

    if (synced > 0) {
      await completeMigration();
      localStorage.setItem(migrationFlag, 'true');
      documentStore.reset();
      updateUserPreferences({ lastProjectId: migrationProjectId });
      onProjectChange?.(migrationProjectId);
      toast.success(`Synced ${synced} files to your account`);
      qc.invalidateQueries({ queryKey: queryKeys.files.all });
      qc.invalidateQueries({ queryKey: queryKeys.projects.all });
    }

    migrationInProgressRef.current = false;
    setIsMigrating(false);
  }, [userId, activeProjectId, projects, qc, documentStore, onProjectChange]);

  return {
    // File operations
    createNewFile,
    renameFile,
    deleteFile,
    moveFile,

    // Folder operations
    createFolder,
    createFolderFromTemplate,

    // Tab management
    closeTab,
    closeOtherTabs,
    closeAllTabs,

    // Project operations
    createProject,
    updateProject,
    deleteProject,
    openProject,
    refreshProjects,

    // Migration
    isMigrating,
    performMigration,
  };
}
