// =============================================================================
// File Query Hooks (React Query)
// Replaces the data-fetching parts of useSqlFileManager
// =============================================================================

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getFiles, getFile, getFileTree, listProjects } from '../api/client';
import { queryKeys } from '@/lib/queryClient';

import type { SqlFile as ApiSqlFile } from '../api/client';

export interface SqlFile extends ApiSqlFile {
  is_current?: boolean;
}

/**
 * Metadata-only file type for React Query caching.
 * Content is NEVER cached - it's managed exclusively by DocumentSessionStore.
 */
export type SqlFileMetadata = Omit<SqlFile, 'content'>;

/**
 * Fetch all files for the authenticated user.
 * If projectId is provided, fetches files for that project.
 * Skips when no userId is provided (guest mode).
 * 
 * IMPORTANT: Returns metadata only - content is managed by DocumentSessionStore.
 */
export function useFilesList(userId: string | undefined, projectId?: string | null) {
  return useQuery({
    queryKey: projectId
      ? queryKeys.files.projectFiles(projectId)
      : queryKeys.files.list(userId ?? ''),
    queryFn: async () => {
      const { files } = await getFiles(projectId ?? undefined);
      return (files || []).map((f): SqlFileMetadata => ({
        id: f.id,
        title: f.title,
        parent_id: f.parent_id,
        is_folder: f.is_folder,
        file_extension: f.file_extension,
        sort_order: f.sort_order,
        created_at: f.created_at,
        updated_at: f.updated_at,
        is_current: (f as any).is_current || false,
        // ❌ INTENTIONALLY OMITTED: content
      }));
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    enabled: !!userId && !!projectId,
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetch the full file/folder tree for the authenticated user.
 * Returns metadata only - content is managed by DocumentSessionStore.
 */
export function useFileTree(userId: string | undefined, projectId?: string | null) {
  return useQuery({
    queryKey: projectId ? queryKeys.files.tree(projectId) : [...queryKeys.files.all, 'tree', userId ?? ''],
    queryFn: async () => {
      const { tree } = await getFileTree(projectId!);
      return (tree || []).map((f): SqlFileMetadata => ({
        id: f.id,
        title: f.title,
        parent_id: f.parent_id,
        is_folder: f.is_folder,
        file_extension: f.file_extension,
        sort_order: f.sort_order,
        created_at: f.created_at,
        updated_at: f.updated_at,
        // ❌ INTENTIONALLY OMITTED: content
      })) as SqlFileMetadata[];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    enabled: !!userId && !!projectId,
    placeholderData: keepPreviousData,
  });
}

/**
 * Fetch a single file by ID.
 * Returns metadata only - content is managed by DocumentSessionStore.
 *
 * DO NOT use this for editor content. Use useDocumentSession instead.
 */
export function useFileDetail(fileId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.files.detail(fileId ?? ''),
    queryFn: async () => {
      const { file } = await getFile(fileId!);
      return {
        id: file.id,
        title: file.title,
        parent_id: file.parent_id,
        is_folder: file.is_folder,
        file_extension: file.file_extension,
        sort_order: file.sort_order,
        created_at: file.created_at,
        updated_at: file.updated_at,
        // ❌ INTENTIONALLY OMITTED: content
      } as SqlFileMetadata;
    },
    staleTime: 30_000,
    refetchOnMount: true,
    enabled: !!fileId,
  });
}

/**
 * Fetch all projects the user is a member of (owned + shared).
 */
export function useProjects(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.files.projects(userId ?? ''),
    queryFn: async () => {
      const { projects } = await listProjects();
      return projects || [];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    enabled: !!userId,
  });
}

