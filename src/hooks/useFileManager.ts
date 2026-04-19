import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  type RecentFile,
} from '@/lib/cookies';
import { getDocumentSessionStore } from '@/editor/documentSessionStore';
import {
  subscribeToSync,
  getNetworkStatus,
  subscribeToNetworkStatus,
  hasPendingOperations as checkPendingOps,
  broadcastSync,
} from '@/lib/file-management/storage/core';
import {
  createFile as apiCreateFile,
  getFile as apiGetFile,
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
import { useFilesList, useProjects } from '@/lib/file-management/hooks/useFiles';
import {
  useCreateFile,
  useUpdateFile,
  useDeleteFile,
  useRenameFile,
  useCreateFolder,
  useCreateFolderFromTemplate,
  useMoveFile,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from '@/lib/file-management/hooks/useFileMutations';
import {
  useGuestFilesList,
  useGuestCreateFile,
  useGuestDeleteFile,
  useGuestRenameFile,
  useGuestCreateFolder,
  useGuestMoveFile,
} from '@/lib/file-management/hooks/useGuestFiles';
import { useTabManager } from '@/lib/file-management/hooks/useTabManager';

function getDescendantIds(files: SqlFile[], rootId: string): Set<string> {
  const descendantIds = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const file of files) {
      if (file.parent_id === currentId && !descendantIds.has(file.id)) {
        descendantIds.add(file.id);
        queue.push(file.id);
      }
    }
  }
  return descendantIds;
}

function getWorkspaceRootId(files: SqlFile[], file: SqlFile): string | null {
  let cursor = file.parent_id ?? null;
  let rootId = cursor;

  while (cursor) {
    const parent = files.find(candidate => candidate.id === cursor);
    if (!parent?.parent_id) {
      rootId = parent?.id ?? cursor;
      break;
    }
    cursor = parent.parent_id;
    rootId = cursor;
  }

  return rootId;
}

function sortWorkspaceItems(a: SqlFile, b: SqlFile): number {
  if (a.is_folder && !b.is_folder) return -1;
  if (!a.is_folder && b.is_folder) return 1;

  const sortA = a.sort_order ?? 0;
  const sortB = b.sort_order ?? 0;
  if (sortA !== sortB) {
    return sortA - sortB;
  }

  return a.title.localeCompare(b.title);
}

function orderFilesForMerge(files: SqlFile[]): SqlFile[] {
  const byParent = new Map<string | null, SqlFile[]>();

  for (const file of files) {
    const key = file.parent_id ?? null;
    const siblings = byParent.get(key) ?? [];
    siblings.push(file);
    byParent.set(key, siblings);
  }

  for (const siblings of byParent.values()) {
    siblings.sort(sortWorkspaceItems);
  }

  const ordered: SqlFile[] = [];
  const visit = (parentId: string | null) => {
    const siblings = byParent.get(parentId) ?? [];
    for (const item of siblings) {
      if (item.is_folder) {
        visit(item.id);
      } else {
        ordered.push(item);
      }
    }
  };

  visit(null);
  return ordered;
}

type CreateFileLocation =
  | string
  | null
  | {
      parent_id?: string | null;
      project_id?: string | null;
      file_extension?: string;
      connection_id?: string | null;
    };

export function useFileManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;
  const isGuest = !user;
  const documentStore = getDocumentSessionStore();

  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => getUserPreferences()?.lastProjectId || null);
  const [currentFileId, setCurrentFileId] = useState<string | null>(() => getUserPreferences()?.lastFileId || null);
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [autosaveEnabled, setAutosaveEnabled] = useState(() => getUserPreferences()?.autosaveEnabled ?? true);
  const [isOnline, setIsOnline] = useState(getNetworkStatus);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(getRecentFiles);
  const [resolvedFileVersion, setResolvedFileVersion] = useState(0);

  const previousUserRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);

  const resolvedFilesRef = useRef<Map<string, SqlFile>>(new Map());
  const lastActiveProjectIdRef = useRef<string | null>(activeProjectId);
  const lastActiveRootIdRef = useRef<string | null>(activeRootId);

  const [isMigrating, setIsMigrating] = useState(false);
  const migrationInProgressRef = useRef(false);

  useEffect(() => subscribeToNetworkStatus(setIsOnline), []);

  useEffect(() => {
    if (lastActiveProjectIdRef.current !== activeProjectId || lastActiveRootIdRef.current !== activeRootId) {
      hydratedRef.current = false;
      lastActiveProjectIdRef.current = activeProjectId;
      lastActiveRootIdRef.current = activeRootId;
    }
  }, [activeProjectId, activeRootId]);

  useEffect(() => {
    if (isGuest) {
      setActiveProjectId(null);
      return;
    }

    if (!activeProjectId) {
      const preferredProjectId = getUserPreferences()?.lastProjectId || null;
      if (preferredProjectId) {
        setActiveProjectId(preferredProjectId);
      }
    }
  }, [isGuest, activeProjectId]);

  const projectsQuery = useProjects(userId);
  const projects: Project[] = projectsQuery.data ?? [];

  const currentProject = useMemo(
    () => projects.find(p => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const authQuery = useFilesList(userId, activeProjectId);
  const guestQuery = useGuestFilesList();

  const files: SqlFile[] = isGuest
    ? guestQuery.data ?? []
    : authQuery.data ?? [];

  const isLoading = isGuest
    ? guestQuery.isLoading
    : projectsQuery.isLoading || (!!activeProjectId && authQuery.isLoading);


  const currentFile = useMemo(
    () => files.find(file => file.id === currentFileId) ?? resolvedFilesRef.current.get(currentFileId ?? '') ?? null,
    [files, currentFileId, resolvedFileVersion],
  );

  const authCreate = useCreateFile(userId, activeProjectId);
  const authUpdate = useUpdateFile(userId, activeProjectId);
  const authDelete = useDeleteFile(userId, activeProjectId);
  const authRename = useRenameFile(userId, activeProjectId);

  const guestCreate = useGuestCreateFile();
  const guestDelete = useGuestDeleteFile();
  const guestRename = useGuestRenameFile();

  const authCreateFolder = useCreateFolder(userId, activeProjectId);
  const authCreateFolderFromTemplate = useCreateFolderFromTemplate(userId, activeProjectId);
  const authMoveFile = useMoveFile(userId, activeProjectId);

  const authCreateProject = useCreateProject(userId);
  const authUpdateProject = useUpdateProject(userId);
  const authDeleteProject = useDeleteProject(userId);

  const guestCreateFolder = useGuestCreateFolder();
  const guestMoveFile = useGuestMoveFile();

  const tabManager = useTabManager();

  const resolveFile = useCallback(async (fileId: string): Promise<SqlFile | null> => {
    const existing = files.find(file => file.id === fileId) ?? resolvedFilesRef.current.get(fileId);
    if (existing && (existing.is_folder || typeof existing.content === 'string')) return existing;
    if (isGuest && existing) return existing; // Guest files in memory always have content
    if (isGuest) return null;

    const { file } = await apiGetFile(fileId);
    resolvedFilesRef.current.set(file.id, file);
    setResolvedFileVersion(prev => prev + 1);
    return file;
  }, [files, isGuest]);

  const selectFile = useCallback(async (fileId: string, preview = false) => {
    const file = await resolveFile(fileId);
    if (!file || file.is_folder) return null;

    if (file.project_id) {
      setActiveProjectId(file.project_id);
    }

    if (isGuest) {
      setActiveRootId(file.parent_id ? getWorkspaceRootId(files, file) : null);
    } else {
      setActiveRootId(null);
    }

    setCurrentFileId(file.id);

    if (preview) {
      tabManager.openPreviewTab(file.id);
    } else {
      tabManager.openTab(file.id);
    }

    updateUserPreferences({
      lastFileId: file.id,
      lastProjectId: file.project_id ?? activeProjectId ?? undefined,
    });
    addRecentFile({ id: file.id, title: file.title });
    setRecentFiles(getRecentFiles());

    documentStore.setActiveFile(file.id);

    if (userId) {
      authUpdate.mutate({ id: file.id, is_current: true });
    }

    broadcastSync({ type: 'file_switched', payload: { fileId: file.id, title: file.title } });
    return file;
  }, [resolveFile, isGuest, files, tabManager, activeProjectId, documentStore, userId, authUpdate]);

  useEffect(() => {
    if (isLoading) return;

    if (isGuest) {
      const hasCreatedDemo = localStorage.getItem('sw_demo_created_v2');
      if (files.length === 0 && !hasCreatedDemo) {
        localStorage.setItem('sw_demo_created_v2', 'true');

        void (async () => {
          try {
            const projectFolder = await createLocalFileDirectly({ title: 'My Project', content: '', is_folder: true });
            const mainFolder = await createLocalFileDirectly({ title: 'Main', content: '', is_folder: true, parent_id: projectFolder.id });
            const schemaFile = await createLocalFileDirectly({
              title: 'schema.sql',
              content: SAMPLE_SQL,
              parent_id: mainFolder.id,
              file_extension: 'sql',
            });

            await qc.invalidateQueries({ queryKey: ['guest-files'] });
            documentStore.primeSession({
              id: schemaFile.id,
              title: schemaFile.title,
              content: schemaFile.content,
              parent_id: schemaFile.parent_id,
              is_folder: schemaFile.is_folder,
              file_extension: schemaFile.file_extension,
              sort_order: schemaFile.sort_order,
              created_at: schemaFile.createdAt,
              updated_at: schemaFile.updatedAt,
            });
            broadcastSync({ type: 'file_changed', payload: { fileId: schemaFile.id } });
          } catch (error) {
            localStorage.removeItem('sw_demo_created_v2');
            console.error('Failed to create demo project (Guest)', error);
          }
        })();
      }
      return;
    }

    // NOTE: No auth bootstrapper needed — the backend DB trigger
    // `handle_new_user_default_project` automatically creates 'My Project'
    // for every new user on sign-up.
  }, [isLoading, isGuest, files.length, projects.length, userId, qc, documentStore, isMigrating]);

  useEffect(() => {
    if (isLoading || isGuest || activeProjectId || projects.length === 0) return;

    const firstProjectId = projects[0].id;
    setActiveProjectId(firstProjectId);
    updateUserPreferences({ lastProjectId: firstProjectId });
  }, [isLoading, isGuest, activeProjectId, projects]);

  useEffect(() => {
    if (isLoading) return;
    if (files.length === 0) return;
    if (hydratedRef.current) return;

    if (currentFileId) {
      const savedFile = files.find(file => file.id === currentFileId && !file.is_folder);
      if (savedFile) {
        tabManager.openTab(savedFile.id);

        if (!isGuest) {
          setActiveProjectId(savedFile.project_id ?? activeProjectId);
        }

        if (savedFile.parent_id) {
          const rootId = getWorkspaceRootId(files, savedFile);
          if (rootId) {
            setActiveRootId(rootId);
          }
        }

        hydratedRef.current = true;
        documentStore.setActiveFile(savedFile.id);
        return;
      }
    }

    const nonFolderFiles = files.filter(file => !file.is_folder);
    if (nonFolderFiles.length === 0) return;

    const serverCurrent = nonFolderFiles.find(file => file.is_current);
    const preferredId = getUserPreferences()?.lastFileId;
    const preferredFile = preferredId ? nonFolderFiles.find(file => file.id === preferredId) : null;
    const target = serverCurrent ?? preferredFile ?? nonFolderFiles[0];

    if (target) {
      setCurrentFileId(target.id);
      tabManager.openTab(target.id);
      updateUserPreferences({
        lastFileId: target.id,
        lastProjectId: target.project_id ?? activeProjectId ?? undefined,
      });
      addRecentFile({ id: target.id, title: target.title });
      setRecentFiles(getRecentFiles());

      if (target.parent_id) {
        const rootId = getWorkspaceRootId(files, target);
        if (rootId) {
          setActiveRootId(rootId);
        }
      }

      documentStore.setActiveFile(target.id);
    }

    hydratedRef.current = true;
  }, [isLoading, files, currentFileId, tabManager, isGuest, activeProjectId, documentStore]);

  useEffect(() => {
    if (!userId || previousUserRef.current === userId || migrationInProgressRef.current) return;
    previousUserRef.current = userId;

    void (async () => {
      // Check for migration flag in localStorage to avoid double-migration in case of race
      const migrationFlag = `sw_migrated_${userId}`;
      if (localStorage.getItem(migrationFlag)) return;

      if (!await hasLocalFiles()) {
        // No local files to migrate — mark as done permanently
        localStorage.setItem(migrationFlag, 'true');
        return;
      }
      
      const toSync = await getFilesForMigration();
      if (toSync.length === 0) {
        // Local files exist but are all folders (no content to sync)
        await completeMigration();
        localStorage.setItem(migrationFlag, 'true');
        return;
      }

      migrationInProgressRef.current = true;
      setIsMigrating(true);
      toast.info(`Syncing ${toSync.length} local files to cloud...`);

      let synced = 0;
      let migrationProjectId: string | null = null;

      try {
        // Use the user's existing default project instead of creating a new one
        const existingProject = projects.find(p => p.owner_id === userId);
        
        if (existingProject) {
          migrationProjectId = existingProject.id;
        } else if (activeProjectId) {
          migrationProjectId = activeProjectId;
        }
      } catch (err) {
        migrationProjectId = activeProjectId;
      }

      if (!migrationProjectId) {
        // If somehow there's no project, mark as done to prevent infinite loop
        console.warn('No project available for migration, skipping');
        await completeMigration();
        localStorage.setItem(migrationFlag, 'true');
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
          // Best effort migration.
        }
      }

      // Always mark migration as complete to prevent re-running
      await completeMigration();
      localStorage.setItem(migrationFlag, 'true');

      if (synced > 0) {
        documentStore.reset();
        updateUserPreferences({ lastProjectId: migrationProjectId });
        setActiveProjectId(migrationProjectId);
        toast.success(`Synced ${synced} files to your account`);
        qc.invalidateQueries({ queryKey: queryKeys.files.all });
        qc.invalidateQueries({ queryKey: ['projects', userId] });
      }
      
      migrationInProgressRef.current = false;
      setIsMigrating(false);
    })();
  }, [userId, activeProjectId, qc, documentStore, projects]);

  useEffect(() => {
    const unsubscribe = subscribeToSync((msg) => {
      if (msg.type === 'file_changed' || msg.type === 'file_deleted') {
        const fileId = msg.payload?.fileId as string | undefined;
        if (fileId) {
          documentStore.markRemoteChanged(fileId);
        }

        // Clear resolved files cache so fresh data is fetched
        resolvedFilesRef.current.clear();
        setResolvedFileVersion(prev => prev + 1);

        if (isGuest) {
          qc.invalidateQueries({ queryKey: ['guest-files'] });
        } else {
          qc.invalidateQueries({ queryKey: queryKeys.files.all });
        }

        if (msg.type === 'file_deleted' && fileId) {
          documentStore.removeSession(fileId);
          if (fileId === currentFileId) {
            toast.info('Current file was deleted in another tab');
          }
        }
      }
    });

    return unsubscribe;
  }, [currentFileId, isGuest, qc, documentStore]);

  useEffect(() => {
    if (isLoading || files.length === 0) return;

    const fileIds = new Set(files.map(file => file.id));
    const staleTabs = tabManager.openTabs.filter(id => !fileIds.has(id));
    staleTabs.forEach(id => {
      documentStore.removeSession(id);
      tabManager.closeTab(id);
    });

    if (currentFileId && !fileIds.has(currentFileId)) {
      const remainingTabs = tabManager.openTabs.filter(id => fileIds.has(id));
      if (remainingTabs.length > 0) {
        setCurrentFileId(remainingTabs[0]);
      } else {
        setCurrentFileId(null);
      }
    }
  }, [files, isLoading, currentFileId, tabManager, documentStore]);

  const switchToFile = useCallback(async (fileId: string) => {
    return selectFile(fileId, false);
  }, [selectFile]);

  const previewFile = useCallback(async (fileId: string) => {
    return selectFile(fileId, true);
  }, [selectFile]);

  const createNewFile = useCallback(async (
    title?: string,
    content?: string,
    location?: CreateFileLocation,
    projectId?: string | null,
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

    // Create file with metadata only - content is managed by DocumentSessionStore
    const file = isGuest
      ? await guestCreate.mutateAsync({ title: newTitle, parent_id: parentId, file_extension: fileExtension })
      : await authCreate.mutateAsync({
          title: newTitle,
          parent_id: parentId,
          project_id: targetProjectId,
          file_extension: fileExtension,
        });

    // Prime the DocumentSessionStore with initial content
    documentStore.primeSession(file, newContent);
    setCurrentFileId(file.id);
    tabManager.openTab(file.id);
    documentStore.setActiveFile(file.id);
    updateUserPreferences({
      lastFileId: file.id,
      lastProjectId: file.project_id ?? targetProjectId ?? undefined,
    });
    addRecentFile({ id: file.id, title: file.title });
    setRecentFiles(getRecentFiles());

    return file;
  }, [isGuest, guestCreate, authCreate, activeProjectId, documentStore, tabManager]);

  const renameFile = useCallback(async (fileId: string, newTitle: string) => {
    if (isGuest) {
      return guestRename.mutateAsync({ id: fileId, title: newTitle });
    }

    return authRename.mutateAsync({ id: fileId, title: newTitle });
  }, [isGuest, guestRename, authRename]);

  const deleteFile = useCallback(async (fileId: string) => {
    const remaining = files.filter(file => file.id !== fileId && !file.is_folder);

    if (isGuest) {
      await guestDelete.mutateAsync(fileId);
    } else {
      await authDelete.mutateAsync(fileId);
    }

    documentStore.removeSession(fileId);
    tabManager.closeTab(fileId);

    // Refresh the file list to ensure UI is in sync with server state
    if (!isGuest && userId) {
      qc.invalidateQueries({ queryKey: queryKeys.files.list(userId) });
    } else if (isGuest) {
      qc.invalidateQueries({ queryKey: ['guest-files'] });
    }

    if (currentFileId === fileId) {
      if (remaining.length > 0) {
        await switchToFile(remaining[0].id);
      } else {
        setCurrentFileId(null);
        documentStore.setActiveFile(null);
        updateUserPreferences({ lastFileId: undefined });
      }
    }
  }, [files, isGuest, guestDelete, authDelete, documentStore, tabManager, currentFileId, switchToFile, userId, qc]);

  const toggleAutosave = useCallback(() => {
    setAutosaveEnabled(prev => {
      const nextValue = !prev;
      updateUserPreferences({ autosaveEnabled: nextValue });
      toast.success(nextValue ? 'Autosave enabled' : 'Autosave disabled');
      return nextValue;
    });
  }, []);

  const importFile = useCallback(async (content: string, fileName: string) => {
    await createNewFile(fileName, content);
  }, [createNewFile]);

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

  const createFolder = useCallback(async (title?: string, parentId?: string | null, projectId?: string | null) => {
    const folderTitle = title || 'New Folder';

    if (isGuest) {
      return guestCreateFolder.mutateAsync({ title: folderTitle, parent_id: parentId });
    }

    return authCreateFolder.mutateAsync({
      title: folderTitle,
      parent_id: parentId,
      project_id: projectId || activeProjectId,
    });
  }, [isGuest, guestCreateFolder, authCreateFolder, activeProjectId]);

  const createFolderFromTemplate = useCallback(async (
    title: string,
    parentId: string | null,
    subfolders: string[],
    projectId?: string | null,
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
  }, [isGuest, qc, authCreateFolderFromTemplate, activeProjectId]);

  const moveFile = useCallback(async (fileId: string, parentId: string | null, sortOrder?: number) => {
    if (isGuest) {
      return guestMoveFile.mutateAsync({ id: fileId, parent_id: parentId, sort_order: sortOrder });
    }

    return authMoveFile.mutateAsync({ id: fileId, parent_id: parentId, sort_order: sortOrder });
  }, [isGuest, guestMoveFile, authMoveFile]);

  const closeTab = useCallback((fileId: string) => {
    tabManager.closeTab(fileId);

    if (currentFileId === fileId) {
      const remainingTabs = tabManager.openTabs.filter(id => id !== fileId);
      const nextId = remainingTabs.length > 0 ? remainingTabs[Math.min(tabManager.openTabs.indexOf(fileId), remainingTabs.length - 1)] : null;

      setCurrentFileId(nextId);
      documentStore.setActiveFile(nextId);

      if (nextId) {
        updateUserPreferences({
          lastFileId: nextId,
          lastProjectId: files.find(file => file.id === nextId)?.project_id ?? activeProjectId ?? undefined,
        });
      } else {
        updateUserPreferences({ lastFileId: undefined });
      }
    }
  }, [tabManager, currentFileId, documentStore, files, activeProjectId]);

  const closeOtherTabs = useCallback((keepId: string) => {
    tabManager.closeOtherTabs(keepId);
    if (currentFileId !== keepId) {
      setCurrentFileId(keepId);
      documentStore.setActiveFile(keepId);
      updateUserPreferences({
        lastFileId: keepId,
        lastProjectId: files.find(file => file.id === keepId)?.project_id ?? activeProjectId ?? undefined,
      });
    }
  }, [tabManager, currentFileId, documentStore, files, activeProjectId]);

  const closeAllTabs = useCallback(() => {
    tabManager.closeAllTabs();
    setCurrentFileId(null);
    documentStore.setActiveFile(null);
    updateUserPreferences({ lastFileId: undefined });
  }, [tabManager, documentStore]);

  const openProject = useCallback((rootId: string | null, projectId?: string | null) => {
    tabManager.closeAllTabs();
    setCurrentFileId(null);
    documentStore.setActiveFile(null);
    setActiveRootId(rootId);
    setActiveProjectId(projectId ?? null);
    updateUserPreferences({
      lastFileId: undefined,
      lastProjectId: projectId ?? undefined,
    });
  }, [tabManager, documentStore]);

  const createProject = useCallback(async (params: { name: string; description?: string; connectionId?: string; teamId?: string }) => {
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
      setActiveRootId(projectFolder.id);
      setActiveProjectId(null);
      setCurrentFileId(schemaFile.id);
      documentStore.setActiveFile(schemaFile.id);
      tabManager.openTab(schemaFile.id);
      updateUserPreferences({
        lastFileId: schemaFile.id,
        lastProjectId: undefined,
      });
      addRecentFile({ id: schemaFile.id, title: schemaFile.title });
      setRecentFiles(getRecentFiles());
      toast.success(`Project "${projectFolder.title}" created`);
      return projectFolder;
    }

    return authCreateProject.mutateAsync(params);
  }, [isGuest, files.length, qc, documentStore, tabManager, authCreateProject]);

  const updateProject = useCallback(async (
    id: string,
    params: { name?: string; description?: string; teamId?: string | null },
  ) => {
    return authUpdateProject.mutateAsync({ id, params });
  }, [authUpdateProject]);

  const deleteProject = useCallback(async (id: string) => {
    await authDeleteProject.mutateAsync(id);
    toast.success('Project deleted');

    if (activeProjectId === id) {
      setActiveProjectId(null);
      setActiveRootId(null);
      setCurrentFileId(null);
      documentStore.setActiveFile(null);
      updateUserPreferences({ lastFileId: undefined, lastProjectId: undefined });
    }
  }, [authDeleteProject, activeProjectId, documentStore]);

  const workspaceFiles = useMemo(() => {
    if (!activeRootId) return files;
    const descendants = getDescendantIds(files, activeRootId);
    return files.filter(file => file.id === activeRootId || descendants.has(file.id));
  }, [files, activeRootId]);

  const getMergedSQL = useCallback(() => {
    let scopeFiles = files;

    if (activeProjectId || activeRootId) {
      if (activeRootId) {
        const descendants = getDescendantIds(files, activeRootId);
        scopeFiles = files.filter(file => file.id === activeRootId || descendants.has(file.id));
      }
    } else {
      const openTabSet = new Set(tabManager.openTabs);
      scopeFiles = files.filter(file => openTabSet.has(file.id));
    }

    const orderedFiles = orderFilesForMerge(scopeFiles);
    if (orderedFiles.length === 0) {
      return currentFile ? documentStore.getDraftContent(currentFile.id, currentFile.content ?? '') : '';
    }

    return orderedFiles
      .map(file => `-- FILE: ${file.title}\n${documentStore.getDraftContent(file.id, file.content ?? '')}`)
      .join('\n\n');
  }, [files, activeProjectId, activeRootId, tabManager.openTabs, currentFile, documentStore]);

  const guestFileCount = files.filter(file => !file.is_folder).length;

  return {
    files,
    workspaceFiles,
    currentFile,
    currentProject,
    activeRootId,
    setActiveRootId,
    activeProjectId,
    setActiveProjectId,
    projects,
    refreshProjects: useCallback(() => {
      resolvedFilesRef.current.clear();
      setResolvedFileVersion(prev => prev + 1);
      qc.invalidateQueries({ queryKey: ['projects', userId] });
      qc.invalidateQueries({ queryKey: queryKeys.files.all });
    }, [qc, userId]),
    openProject,
    loading: isLoading,
    autosaveEnabled,
    isOnline,
    isGuest,
    recentFiles,
    hasPendingOperations: checkPendingOps(),
    canCreateFile: isGuest ? guestFileCount < MAX_LOCAL_FILES : true,

    openTabs: tabManager.openTabs,
    activeTabId: currentFileId,
    previewTabId: tabManager.previewTabId,

    switchToFile,
    previewFile,
    createNewFile,
    renameFile,
    deleteFile,
    toggleAutosave,
    importFile,

    createFolder,
    createFolderFromTemplate,
    moveFile,

    createProject,
    updateProject,
    deleteProject,

    getMergedSQL,
    downloadCurrentFile,

    closeTab,
    closeOtherTabs,
    closeAllTabs,
    reorderTabs: tabManager.reorderTabs,
    pinTab: tabManager.pinTab,
    tabManager,
  };
}
