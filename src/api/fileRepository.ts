import type { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';
import { isPermissionError } from '@/lib/api/permissionErrorHandler';
import { queryKeys } from '@/lib/queryClient';
import { broadcastSync } from '@/lib/file-management/storage/core';
import { getLocalFile, updateLocalFile } from '@/lib/file-management/storage/local-files';
import { getFile as apiGetFile, updateFile as apiUpdateFile, type SqlFile } from '@/lib/file-management/api/client';
import type {
  DocumentLoadResult,
  DocumentRepository,
  DocumentSaveResult,
  DocumentSaveSnapshot,
} from '@/editor/documentSessionTypes';

function isSqlFileArray(value: unknown): value is SqlFile[] {
  return Array.isArray(value) && (
    value.length === 0 ||
    (
      typeof value[0] === 'object' &&
      value[0] !== null &&
      'id' in value[0] &&
      'title' in value[0] &&
      'content' in value[0] &&
      'updated_at' in value[0]
    )
  );
}

function patchFileArray(files: SqlFile[] | undefined, updatedFile: SqlFile): SqlFile[] | undefined {
  if (!files) return files;
  return files.map((file) => (
    file.id === updatedFile.id
      ? {
          ...file,
          // ❌ NEVER CACHE: content: updatedFile.content,
          updated_at: updatedFile.updated_at,
          title: updatedFile.title,
          parent_id: updatedFile.parent_id,
          is_folder: updatedFile.is_folder,
          file_extension: updatedFile.file_extension,
          sort_order: updatedFile.sort_order,
          // Content is managed exclusively by DocumentSessionStore
        }
      : file
  ));
}

function updateFileCaches(queryClient: QueryClient, updatedFile: SqlFile): void {
  // ❌ DO NOT cache full file with content
  // Only update metadata in all locations
  
  const fileMetadata: SqlFile = {
    id: updatedFile.id,
    title: updatedFile.title,
    parent_id: updatedFile.parent_id,
    is_folder: updatedFile.is_folder,
    file_extension: updatedFile.file_extension,
    sort_order: updatedFile.sort_order,
    created_at: updatedFile.created_at,
    updated_at: updatedFile.updated_at,
    content: '', // Placeholder - never used
  };

  // Update individual file detail query (metadata only)
  queryClient.setQueryData<SqlFile>(
    queryKeys.files.detail(updatedFile.id),
    fileMetadata,
  );

  // Update file lists (metadata only)
  queryClient.setQueriesData(
    { queryKey: queryKeys.files.all },
    (existing: unknown) => {
      if (isSqlFileArray(existing)) {
        return patchFileArray(existing, updatedFile);
      }
      return existing;
    },
  );

  // Update guest files (metadata only)
  queryClient.setQueryData<SqlFile[]>(
    ['guest-files'],
    (existing) => patchFileArray(existing, updatedFile),
  );
}

interface CreateFileRepositoryOptions {
  userId?: string;
  queryClient: QueryClient;
}

export class FileRepositoryConflictError extends Error {
  readonly serverRevision: string | undefined;

  constructor(message: string, serverRevision?: string) {
    super(message);
    this.name = 'FileRepositoryConflictError';
    this.serverRevision = serverRevision;
  }
}

/**
 * Permission error when user lacks permissions for file operation
 * (e.g., 403 Forbidden from API)
 */
export class FileRepositoryPermissionError extends Error {
  readonly statusCode: number;
  readonly requiredRole?: string;
  readonly userRole?: string;

  constructor(message: string, statusCode: number = 403, requiredRole?: string, userRole?: string) {
    super(message);
    this.name = 'FileRepositoryPermissionError';
    this.statusCode = statusCode;
    this.requiredRole = requiredRole;
    this.userRole = userRole;
  }
}

export function createFileRepository(options: CreateFileRepositoryOptions): DocumentRepository {
  const { userId, queryClient } = options;

  return {
    async loadFile(file): Promise<DocumentLoadResult> {
      if (!userId) {
        const localFile = await getLocalFile(file.id);
        if (!localFile || localFile.is_folder) {
          throw new Error('File not found');
        }

        return {
          content: localFile.content ?? '',
          revision: localFile.updatedAt,
        };
      }

      const { file: remoteFile } = await apiGetFile(file.id);
      return {
        content: remoteFile.content ?? '',
        revision: remoteFile.updated_at,
      };
    },

    async saveFile(file, snapshot): Promise<DocumentSaveResult> {
      // Validate snapshot before attempting save
      if (typeof snapshot.draftContent !== 'string') {
        throw new Error('Invalid content: must be a string');
      }
      
      const MAX_CONTENT_SIZE = 10 * 1024 * 1024; // 10MB
      if (snapshot.draftContent.length > MAX_CONTENT_SIZE) {
        throw new Error(`Content exceeds maximum size (${Math.round(MAX_CONTENT_SIZE / 1024 / 1024)}MB)`);
      }

      if (!userId) {
        const updated = await updateLocalFile(file.id, { content: snapshot.draftContent });
        if (!updated) {
          throw new Error('File not found');
        }

        const mapped: SqlFile = {
          ...file,
          content: updated.content,
          updated_at: updated.updatedAt,
          created_at: updated.createdAt,
          title: updated.title,
          parent_id: updated.parent_id,
          is_folder: updated.is_folder,
          file_extension: updated.file_extension,
          sort_order: updated.sort_order,
        };

        updateFileCaches(queryClient, mapped);
        broadcastSync({ type: 'file_changed', payload: { fileId: updated.id } });

        return {
          content: updated.content,
          revision: updated.updatedAt,
        };
      }

      try {
        const { file: updatedFile } = await apiUpdateFile(file.id, {
          content: snapshot.draftContent,
          expected_updated_at: typeof snapshot.baseServerRevision === 'string'
            ? snapshot.baseServerRevision
            : undefined,
        });

        updateFileCaches(queryClient, updatedFile);
        broadcastSync({ type: 'file_changed', payload: { fileId: updatedFile.id } });

        return {
          content: updatedFile.content,
          revision: updatedFile.updated_at,
        };
      } catch (error) {
        // Handle permission errors (403 Forbidden)
        if (error instanceof ApiError && isPermissionError(error)) {
          const data = error.data as Record<string, any>;
          const requiredRole = data?.details?.requiredRole || data?.details?.required_role;
          const userRole = data?.details?.userRole || data?.details?.user_role;
          throw new FileRepositoryPermissionError(
            data?.message || 'Permission denied: you cannot modify this file',
            403,
            requiredRole,
            userRole,
          );
        }
        
        // Handle conflict errors (409 Conflict) 
        if (error instanceof ApiError && error.status === 409) {
          const serverRevision = (error.data as { serverUpdatedAt?: string } | undefined)?.serverUpdatedAt;
          throw new FileRepositoryConflictError(
            'File was modified in another session.',
            serverRevision,
          );
        }

        throw error;
      }
    },
  };
}
