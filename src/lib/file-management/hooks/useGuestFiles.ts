// =============================================================================
// Guest Files Hook
// Same React Query interface but backed by IndexedDB instead of API
// =============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  getLocalFiles,
  createLocalFile,
  updateLocalFile,
  deleteLocalFile,
} from '../storage/local-files';
import type { LocalFile } from '../storage/local-files';
import { addRecentFile, removeRecentFile } from '@/lib/cookies';
import { broadcastSync, subscribeToSync } from '../storage/core';
import { toast } from 'sonner';

import type { SqlFile } from './useFiles';

const GUEST_FILES_KEY = ['guest-files'] as const;

/** Map a LocalFile to the canonical SqlFile shape */
function toSqlFile(f: LocalFile): SqlFile {
  return {
    id: f.id,
    title: f.title,
    content: f.content,
    parent_id: f.parent_id || null,
    is_folder: f.is_folder || false,
    file_extension: f.file_extension || 'sql',
    sort_order: f.sort_order || 0,
    is_current: false,
    created_at: f.createdAt,
    updated_at: f.updatedAt,
  };
}

// =============================================================================
// Query: list all guest files
// =============================================================================

export function useGuestFilesList() {
  return useQuery<SqlFile[]>({
    queryKey: [...GUEST_FILES_KEY],
    queryFn: async () => {
      const files = await getLocalFiles();
      return files.map(toSqlFile);
    },
    staleTime: Infinity,
  });
}

// =============================================================================
// Mutations
// =============================================================================

export function useGuestCreateFile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      title,
      parent_id,
      file_extension,
    }: {
      title: string;
      parent_id?: string | null;
      file_extension?: string;
    }) => {
      // Create file with empty content - DocumentSessionStore will manage content
      const local = await createLocalFile({ title, content: '', parent_id, file_extension });
      return toSqlFile(local);
    },

    onSuccess: (file) => {
      qc.invalidateQueries({ queryKey: [...GUEST_FILES_KEY] });
      addRecentFile({ id: file.id, title: file.title });
      broadcastSync({ type: 'file_changed', payload: { fileId: file.id } });
    },

    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create file');
    },
  });
}

export function useGuestUpdateFile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...params }: { id: string; title?: string; content?: string }) => {
      const updated = await updateLocalFile(id, params);
      if (!updated) throw new Error('File not found');
      return toSqlFile(updated);
    },

    onSuccess: (file) => {
      qc.invalidateQueries({ queryKey: [...GUEST_FILES_KEY] });
      broadcastSync({ type: 'file_changed', payload: { fileId: file.id } });
    },

    onError: () => {
      toast.error('Failed to save locally');
    },
  });
}

export function useGuestDeleteFile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (fileId: string) => {
      const deleted = await deleteLocalFile(fileId);
      if (!deleted) throw new Error('File not found');
      return fileId;
    },

    onSuccess: (fileId) => {
      qc.invalidateQueries({ queryKey: [...GUEST_FILES_KEY] });
      removeRecentFile(fileId);
      broadcastSync({ type: 'file_deleted', payload: { fileId } });
      toast.success('File deleted');
    },

    onError: () => {
      toast.error('Failed to delete file');
    },
  });
}

export function useGuestRenameFile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const updated = await updateLocalFile(id, { title });
      if (!updated) throw new Error('File not found');
      return toSqlFile(updated);
    },

    onSuccess: (file) => {
      qc.invalidateQueries({ queryKey: [...GUEST_FILES_KEY] });
      addRecentFile({ id: file.id, title: file.title });
      broadcastSync({ type: 'file_changed', payload: { fileId: file.id } });
      toast.success('File renamed');
    },

    onError: () => {
      toast.error('Failed to rename file');
    },
  });
}

export function useGuestCreateFolder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, parent_id }: { title?: string; parent_id?: string | null }) => {
      const titleStr = title || 'New Folder';
      const local = await createLocalFile({ title: titleStr, content: '', parent_id, is_folder: true });
      return toSqlFile(local);
    },

    onSuccess: (file) => {
      qc.invalidateQueries({ queryKey: [...GUEST_FILES_KEY] });
      broadcastSync({ type: 'file_changed', payload: { fileId: file.id } });
      toast.success('Folder created');
    },

    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create folder');
    },
  });
}

export function useGuestMoveFile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, parent_id, sort_order }: { id: string; parent_id: string | null; sort_order?: number }) => {
      const updated = await updateLocalFile(id, { parent_id, sort_order });
      if (!updated) throw new Error('File not found');
      return toSqlFile(updated);
    },

    onSuccess: (file) => {
      qc.invalidateQueries({ queryKey: [...GUEST_FILES_KEY] });
      broadcastSync({ type: 'file_changed', payload: { fileId: file.id } });
    },

    onError: () => {
      toast.error('Failed to move item');
    },
  });
}

// =============================================================================
// Cross-tab sync: listen for sync-channel events and invalidate
// =============================================================================

export function useGuestFilesSync() {
  const qc = useQueryClient();

  useEffect(() => {
    return subscribeToSync((message) => {
      if (message.type === 'file_changed' || message.type === 'file_deleted' || message.type === 'file_switched') {
        qc.invalidateQueries({ queryKey: [...GUEST_FILES_KEY] });
      }
    });
  }, [qc]);
}
