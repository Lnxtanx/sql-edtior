// =============================================================================
// File Mutation Hooks (React Query)
// Optimistic create / update / delete / rename with rollback
// =============================================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createFile as apiCreateFile,
  updateFile as apiUpdateFile,
  deleteFile as apiDeleteFile,
  createFolder as apiCreateFolder,
  createFolderFromTemplate as apiCreateFolderFromTemplate,
  moveFile as apiMoveFile,
  createProject as apiCreateProject,
  bootstrapProject as apiBootstrapProject,
  updateProject as apiUpdateProject,
  deleteProject as apiDeleteProject,
} from '../api/client';
import { ApiError } from '@/lib/api/client';
import { 
  isPermissionError, 
  formatPermissionErrorMessage 
} from '@/lib/api/permissionErrorHandler';
import { queryKeys } from '@/lib/queryClient';
import { addRecentFile, removeRecentFile } from '@/lib/cookies';
import { broadcastSync } from '../storage/core';
import { toast } from 'sonner';

import type { SqlFile } from './useFiles';

// =============================================================================
// useCreateFile
// =============================================================================

export function useCreateFile(userId: string | undefined, projectId?: string | null) {
  const qc = useQueryClient();
  const listKey = projectId
    ? queryKeys.files.projectFiles(projectId)
    : queryKeys.files.list(userId ?? '');
  const filesRootKey = queryKeys.files.all;

  return useMutation({
    mutationFn: (params: { title?: string; parent_id?: string | null; file_extension?: string; project_id?: string | null }) =>
      apiCreateFile(params).then(r => r.file),

    onMutate: async (params) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<SqlFile[]>(listKey);

      const optimistic: SqlFile = {
        id: `temp_${crypto.randomUUID()}`,
        title: params.title || 'Untitled',
        content: '', // ℹ️ DocumentSessionStore will manage content when file is opened
        parent_id: params.parent_id || null,
        is_folder: false,
        file_extension: params.file_extension || 'sql',
        sort_order: 0,
        is_current: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      qc.setQueryData<SqlFile[]>(listKey, (old = []) => [
        optimistic,
        ...old.map(f => ({ ...f, is_current: false })),
      ]);

      return { previous, tempId: optimistic.id };
    },

    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(listKey, ctx.previous);
      if (isPermissionError(err)) {
        const { title, description } = formatPermissionErrorMessage(err);
        toast.error(title, { description });
      } else {
        toast.error('Failed to create file');
      }
    },

    onSuccess: (file, _vars, ctx) => {
      // Replace temp entry with real server data
      qc.setQueryData<SqlFile[]>(listKey, (old = []) =>
        old.map(f => (f.id === ctx?.tempId ? { ...file, is_current: true } : f)),
      );
      // Active refetch so observers always get fresh data even if query was stale
      void qc.refetchQueries({ queryKey: listKey });
      addRecentFile({ id: file.id, title: file.title });
      broadcastSync({ type: 'file_changed', payload: { fileId: file.id } });
    },
  });
}

// =============================================================================
// useUpdateFile
// =============================================================================

export function useUpdateFile(userId: string | undefined, projectId?: string | null) {
  const qc = useQueryClient();
  const listKey = projectId
    ? queryKeys.files.projectFiles(projectId)
    : queryKeys.files.list(userId ?? '');
  const filesRootKey = queryKeys.files.all;

  return useMutation({
    mutationFn: ({ id, ...params }: { id: string; title?: string; is_current?: boolean; expected_updated_at?: string }) =>
      apiUpdateFile(id, params).then(r => r.file),

    onMutate: async ({ id, expected_updated_at: _, ...params }) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<SqlFile[]>(listKey);

      qc.setQueryData<SqlFile[]>(listKey, (old = []) =>
        old.map(f => (f.id === id ? { ...f, ...params } : f)),
      );

      return { previous };
    },

    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(listKey, ctx.previous);
      // Don't toast on 409 (conflict) — autosave handles that with a specific message
      if (err instanceof ApiError && err.status === 409) return;
      if (isPermissionError(err)) {
        const { title, description } = formatPermissionErrorMessage(err);
        toast.error(title, { description });
      } else {
        toast.error('Failed to update file');
      }
    },

    onSuccess: (file) => {
      // Targeted update of the file list - metadata only
      qc.setQueryData<SqlFile[]>(listKey, (old = []) =>
        old.map(f => (f.id === file.id 
          ? {
              id: file.id,
              title: file.title,
              parent_id: file.parent_id,
              is_folder: file.is_folder,
              file_extension: file.file_extension,
              sort_order: file.sort_order,
              created_at: file.created_at,
              updated_at: file.updated_at,
              is_current: (f as any).is_current || false,
              // ❌ NEVER include: content
            } as SqlFile
          : f)),
      );
      
      broadcastSync({ type: 'file_changed', payload: { fileId: file.id } });
    },
  });
}

// =============================================================================
// useDeleteFile
// =============================================================================

export function useDeleteFile(userId: string | undefined, projectId?: string | null) {
  const qc = useQueryClient();
  const listKey = projectId
    ? queryKeys.files.projectFiles(projectId)
    : queryKeys.files.list(userId ?? '');
  const filesRootKey = queryKeys.files.all;

  return useMutation({
    mutationFn: (fileId: string) => apiDeleteFile(fileId),

    onMutate: async (fileId) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<SqlFile[]>(listKey);

      qc.setQueryData<SqlFile[]>(listKey, (old = []) =>
        old.filter(f => f.id !== fileId),
      );

      return { previous };
    },

    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(listKey, ctx.previous);
      if (isPermissionError(err)) {
        const { title, description } = formatPermissionErrorMessage(err);
        toast.error(title, { description });
      } else {
        toast.error('Failed to delete file');
      }
    },

    onSuccess: (_data, fileId) => {
      removeRecentFile(fileId);
      broadcastSync({ type: 'file_deleted', payload: { fileId } });
      toast.success('File deleted');
    },

    onSettled: () => {
      // Refetch project-scoped list and broader root to handle cascading server deletes
      void qc.refetchQueries({ queryKey: listKey });
      qc.invalidateQueries({ queryKey: filesRootKey });
    },
  });
}

// =============================================================================
// useRenameFile
// =============================================================================

export function useRenameFile(userId: string | undefined, projectId?: string | null) {
  const qc = useQueryClient();
  const listKey = projectId
    ? queryKeys.files.projectFiles(projectId)
    : queryKeys.files.list(userId ?? '');
  const filesRootKey = queryKeys.files.all;

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      apiUpdateFile(id, { title }).then(r => r.file),

    onMutate: async ({ id, title }) => {
      await qc.cancelQueries({ queryKey: listKey });
      const previous = qc.getQueryData<SqlFile[]>(listKey);

      qc.setQueryData<SqlFile[]>(listKey, (old = []) =>
        old.map(f => (f.id === id ? { ...f, title } : f)),
      );

      return { previous };
    },

    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(listKey, ctx.previous);
      if (isPermissionError(err)) {
        const { title, description } = formatPermissionErrorMessage(err);
        toast.error(title, { description });
      } else {
        toast.error('Failed to rename file');
      }
    },

    onSuccess: (file) => {
      addRecentFile({ id: file.id, title: file.title });
      toast.success('File renamed');
    },

    onSettled: () => {
      void qc.refetchQueries({ queryKey: listKey });
    },
  });
}

// =============================================================================
// useCreateFolder
// =============================================================================

export function useCreateFolder(userId: string | undefined, projectId?: string | null) {
  const qc = useQueryClient();
  const listKey = projectId
    ? queryKeys.files.projectFiles(projectId)
    : queryKeys.files.list(userId ?? '');
  const filesRootKey = queryKeys.files.all;

  return useMutation({
    mutationFn: (params: { title?: string; parent_id?: string | null; project_id?: string | null }) =>
      apiCreateFolder(params).then(r => r.folder),

    onSuccess: (folder) => {
      qc.setQueryData<SqlFile[]>(listKey, (old = []) => [folder, ...old]);
      qc.setQueryData(queryKeys.files.detail(folder.id), folder);
      void qc.refetchQueries({ queryKey: listKey });
      broadcastSync({ type: 'file_changed', payload: { fileId: folder.id } });
      toast.success(`Folder "${folder.title}" created`);
    },

    onError: (err) => {
      if (isPermissionError(err)) {
        const { title, description } = formatPermissionErrorMessage(err);
        toast.error(title, { description });
      } else {
        toast.error('Failed to create folder');
      }
    },
  });
}

// =============================================================================
// useCreateFolderFromTemplate
// =============================================================================

export function useCreateFolderFromTemplate(userId: string | undefined, projectId?: string | null) {
  const qc = useQueryClient();
  const listKey = projectId
    ? queryKeys.files.projectFiles(projectId)
    : queryKeys.files.list(userId ?? '');
  const filesRootKey = queryKeys.files.all;

  return useMutation({
    mutationFn: (params: { title: string; parent_id?: string | null; project_id?: string | null; subfolders: string[] }) =>
      apiCreateFolderFromTemplate(params),

    onSuccess: (result) => {
      void qc.refetchQueries({ queryKey: listKey });
      broadcastSync({ type: 'file_changed', payload: { fileId: result.folder.id } });
      toast.success(result.message);
    },

    onError: (err) => {
      if (isPermissionError(err)) {
        const { title, description } = formatPermissionErrorMessage(err);
        toast.error(title, { description });
      } else {
        toast.error('Failed to create folder structure');
      }
    },
  });
}

// =============================================================================
// useMoveFile
// =============================================================================

export function useMoveFile(userId: string | undefined, projectId?: string | null) {
  const qc = useQueryClient();
  const listKey = projectId
    ? queryKeys.files.projectFiles(projectId)
    : queryKeys.files.list(userId ?? '');
  const filesRootKey = queryKeys.files.all;

  return useMutation({
    mutationFn: ({ id, parent_id, sort_order }: { id: string; parent_id?: string | null; sort_order?: number }) =>
      apiMoveFile(id, { parent_id, sort_order }).then(r => r.file),

    onSuccess: (file) => {
      qc.setQueryData<SqlFile[]>(listKey, (old = []) =>
        old.map(f => (f.id === file.id ? file : f)),
      );
      qc.setQueryData(queryKeys.files.detail(file.id), file);
      void qc.refetchQueries({ queryKey: listKey });
      broadcastSync({ type: 'file_changed', payload: { fileId: file.id } });
      toast.success(`"${file.title}" moved`);
    },

    onError: (err) => {
      if (isPermissionError(err)) {
        const { title, description } = formatPermissionErrorMessage(err);
        toast.error(title, { description });
      } else {
        toast.error('Failed to move file');
      }
    },
  });
}

// =============================================================================
// useCreateProject
// =============================================================================

export function useCreateProject(userId: string | undefined) {
  const qc = useQueryClient();
  const projectsKey = queryKeys.files.projects(userId ?? '');

  return useMutation({
    mutationFn: (params: { name: string; description?: string; connectionId?: string; teamId?: string }) =>
      apiCreateProject(params).then(r => r.project),

    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: projectsKey });
      toast.success(`Project "${project.name}" created`);
    },

    onError: (err) => {
      if (isPermissionError(err)) {
        const { title, description } = formatPermissionErrorMessage(err);
        toast.error(title, { description });
      } else {
        toast.error('Failed to create project');
      }
    },
  });
}

// =============================================================================
// useBootstrapProject
// =============================================================================

export function useBootstrapProject(userId: string | undefined) {
  const qc = useQueryClient();
  const projectsKey = queryKeys.files.projects(userId ?? '');
  const filesRootKey = queryKeys.files.all;

  return useMutation({
    mutationFn: (params: { name: string; content: string }) =>
      apiBootstrapProject(params),

    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: projectsKey });
      qc.invalidateQueries({ queryKey: filesRootKey });
      toast.success(`Demo project "${result.project.name}" initialized`);
    },

    onError: (err) => {
      if (isPermissionError(err)) {
        const { title, description } = formatPermissionErrorMessage(err);
        toast.error(title, { description });
      } else {
        toast.error('Failed to initialize demo project');
      }
    },
  });
}

// =============================================================================
// useUpdateProject
// =============================================================================

export function useUpdateProject(userId: string | undefined) {
  const qc = useQueryClient();
  const projectsKey = queryKeys.files.projects(userId ?? '');

  return useMutation({
    mutationFn: ({ id, params }: { id: string; params: { name?: string; description?: string; teamId?: string | null } }) =>
      apiUpdateProject(id, params).then(r => r.project),

    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: projectsKey });
      toast.success('Project updated');
    },

    onError: (err) => {
      if (isPermissionError(err)) {
        const { title, description } = formatPermissionErrorMessage(err);
        toast.error(title, { description });
      } else {
        toast.error('Failed to update project');
      }
    },
  });
}

// =============================================================================
// useDeleteProject
// =============================================================================

export function useDeleteProject(userId: string | undefined) {
  const qc = useQueryClient();
  const projectsKey = queryKeys.files.projects(userId ?? '');

  return useMutation({
    mutationFn: (projectId: string) => apiDeleteProject(projectId),

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectsKey });
      toast.success('Project deleted');
    },

    onError: (err) => {
      if (isPermissionError(err)) {
        const { title, description } = formatPermissionErrorMessage(err);
        toast.error(title, { description });
      } else {
        toast.error('Failed to delete project');
      }
    },
  });
}
