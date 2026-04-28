/**
 * useDeleteFile.ts
 * 
 * Hook for deleting files with permission checks and confirmation.
 * Only admin+ users can delete files.
 */

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { ApiError, getCsrfToken, API_BASE_URL } from '@/lib/api/client';
import { 
  isPermissionError, 
  formatPermissionErrorMessage 
} from '@/lib/api/permissionErrorHandler';
import { useEditorPermissions, useActionGuard } from './useEditorPermissions';
import type { QueryClient } from '@tanstack/react-query';

export interface UseDeleteFileOptions {
  fileId: string;
  fileName?: string;
  projectId: string;
  queryClient?: QueryClient;
  onSuccess?: (fileId: string) => void;
  onError?: (error: Error) => void;
  showConfirmation?: boolean;
}

export interface UseDeleteFileState {
  isDeleting: boolean;
  error: Error | null;
  canDelete: boolean;
  deleteFile: () => Promise<void>;
  resetError: () => void;
}

/**
 * Hook to handle file deletion with permissions
 * 
 * Usage:
 * const { deleteFile, isDeleting, canDelete, error } = useDeleteFile({
 *   fileId: file.id,
 *   fileName: file.name,
 *   projectId: projectId,
 *   onSuccess: (fileId) => navigate('/...'),
 * });
 * 
 * if (!canDelete) return <AlertNoPermission />;
 * 
 * return (
 *   <button onClick={deleteFile} disabled={isDeleting}>
 *     {isDeleting ? 'Deleting...' : 'Delete File'}
 *   </button>
 * );
 */
export function useDeleteFile({
  fileId,
  fileName = 'File',
  projectId,
  queryClient,
  onSuccess,
  onError,
  showConfirmation = true,
}: UseDeleteFileOptions): UseDeleteFileState {
  const { canAdmin, role } = useEditorPermissions();
  const performSaveAction = useActionGuard('admin');

  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const performDelete = useCallback(async () => {
    setIsDeleting(true);
    setError(null);

    try {
      // Guard the operation with permission check
      await performSaveAction(async () => {
        // Call API to delete file
        const response = await fetch(`${API_BASE_URL}/api/files/${fileId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(getCsrfToken() ? { 'X-CSRF-Token': getCsrfToken()! } : {}),
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete file');
        }

        // Invalidate queries if queryClient provided
        if (queryClient) {
          await queryClient.invalidateQueries({ queryKey: ['files'] });
          await queryClient.invalidateQueries({ queryKey: ['projects'] });
        }

        // Show success message
        toast.success('File deleted', {
          description: `${fileName} has been permanently deleted.`,
          duration: 4000,
        });

        // Call success callback
        if (onSuccess) {
          onSuccess(fileId);
        }
      });
    } catch (err) {
      // Handle API errors with new permission error handler
      if (err instanceof ApiError && isPermissionError(err)) {
        const { title, description } = formatPermissionErrorMessage(err);
        const apiError = err as ApiError;
        setError(new Error(description));
        
        toast.error(title, {
          description,
          duration: 4000,
        });
      } else {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);

        // Show error message
        toast.error('Delete failed', {
          description: error.message,
          duration: 4000,
        });
      }

      // Call error callback
      if (onError) {
        onError(err instanceof Error ? err : new Error('Unknown error'));
      }
    } finally {
      setIsDeleting(false);
      setConfirmDialogOpen(false);
    }
  }, [fileId, fileName, performSaveAction, queryClient, onSuccess, onError]);

  const deleteFile = useCallback(async () => {
    // Permission check
    if (!canAdmin) {
      const err = new Error('Only admin+ users can delete files');
      setError(err);
      toast.error('Permission denied', {
        description: err.message,
        duration: 4000,
      });
      return;
    }

    // Show confirmation if needed
    if (showConfirmation) {
      setConfirmDialogOpen(true);
      return;
    }

    // Otherwise delete immediately
    await performDelete();
  }, [canAdmin, showConfirmation, performDelete]);

  return {
    isDeleting,
    error,
    canDelete: canAdmin,
    deleteFile,
    resetError,
  };
}

/**
 * Hook variant that manages confirmation dialog internally
 * Returns confirmation state for controlling modal display
 */
export interface UseDeleteFileGuardState extends UseDeleteFileState {
  showConfirmation: boolean;
  setShowConfirmation: (show: boolean) => void;
  confirmDelete: () => Promise<void>;
}

export function useDeleteFileGuard(
  options: UseDeleteFileOptions
): UseDeleteFileGuardState {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { deleteFile, ...rest } = useDeleteFile({
    ...options,
    showConfirmation: false, // Let this hook manage confirmation
  });

  const confirmDelete = useCallback(async () => {
    setShowConfirmation(false);
    // Call the actual delete function directly (bypasses confirmation prompt)
    const result = useDeleteFile({
      ...options,
      showConfirmation: false,
    });
    await result.deleteFile();
  }, [options]);

  return {
    ...rest,
    showConfirmation,
    setShowConfirmation,
    deleteFile: async () => {
      setShowConfirmation(true);
    },
    confirmDelete,
  };
}

/**
 * Hook to check if deletion is available
 * Useful for UI indicators
 */
export function useCanDeleteFile(): { canDelete: boolean; reason: string } {
  const { canAdmin, role } = useEditorPermissions();

  if (!canAdmin) {
    return {
      canDelete: false,
      reason: `You need admin or higher permissions to delete files. You have: ${role || 'no'} permissions.`,
    };
  }

  return {
    canDelete: true,
    reason: 'You can delete files',
  };
}
