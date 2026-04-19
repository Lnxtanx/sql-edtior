/**
 * useAuthSaveGuard.ts
 * 
 * Hook that prevents unauthorized save operations and shows appropriate feedback.
 * Guards manual saves, format operations, and other write actions for viewers.
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useEditorPermissions } from './useEditorPermissions';

export interface SaveGuardOptions {
  /**
   * Whether to show toast on permission denial
   * Set to false if you want to handle the error yourself
   */
  showToast?: boolean;
  /**
   * Custom error message shown in toast
   */
  errorMessage?: string;
  /**
   * Specific action name for better error messages
   */
  action?: 'save' | 'format' | 'generate' | 'delete' | string;
}

/**
 * Hook that wraps save operations with permission checks
 * 
 * For viewers: Prevents execution and shows toast
 * For editors+: Allows execution
 * 
 * Usage:
 * const guardSave = useAuthSaveGuard({ action: 'save' });
 * 
 * const handleSave = () => {
 *   guardSave(async () => {
 *     await apiSave(...);
 *   });
 * };
 */
export function useAuthSaveGuard(options: SaveGuardOptions = {}) {
  const { showToast = true, errorMessage, action = 'edit' } = options;
  const { isReadOnly, role } = useEditorPermissions();

  /**
   * Guard a save operation - prevents execution if user is read-only
   */
  const guard = useCallback(
    async <T,>(callback: () => Promise<T>): Promise<T | null> => {
      if (isReadOnly) {
        if (showToast) {
          const message =
            errorMessage ||
            `You don't have permission to ${action.toLowerCase()}. (${role || 'no'} access)`;
          toast.error(message, {
            duration: 3000,
          });
        }

        // Throw error so caller can handle it
        throw new Error(`Unauthorized: Cannot ${action.toLowerCase()}`);
      }

      try {
        return await callback();
      } catch (error) {
        // Re-throw so caller can handle further
        throw error;
      }
    },
    [isReadOnly, showToast, errorMessage, action, role]
  );

  /**
   * Synchronous version for operations that don't involve async
   */
  const guardSync = useCallback(
    <T,>(callback: () => T): T | null => {
      if (isReadOnly) {
        if (showToast) {
          const message =
            errorMessage ||
            `You don't have permission to ${action.toLowerCase()}. (${role || 'no'} access)`;
          toast.error(message, {
            duration: 3000,
          });
        }

        throw new Error(`Unauthorized: Cannot ${action.toLowerCase()}`);
      }

      try {
        return callback();
      } catch (error) {
        throw error;
      }
    },
    [isReadOnly, showToast, errorMessage, action, role]
  );

  /**
   * Check if a save would be allowed (without executing)
   */
  const canSave = useCallback(() => {
    return !isReadOnly;
  }, [isReadOnly]);

  /**
   * Get reason why save is not allowed
   */
  const getSaveBlockReason = useCallback((): string | null => {
    if (!isReadOnly) return null;

    return `You have ${role || 'no'} permissions - ${action}s are not allowed`;
  }, [isReadOnly, role, action]);

  return {
    guard,
    guardSync,
    canSave,
    getSaveBlockReason,
    isReadOnly,
  };
}

/**
 * Hook for managing before-save validation and permission checks
 * 
 * Usage:
 * const saveManager = useSaveManager();
 * 
 * const handleSave = async () => {
 *   if (!saveManager.canSave()) {
 *     console.error(saveManager.getSaveBlockReason());
 *     return;
 *   }
 *   
 *   const result = await saveManager.executeSave(async () => {
 *     return await apiSave(...);
 *   });
 * };
 */
export function useSaveManager(showToastOnError = true) {
  const { isReadOnly, role } = useEditorPermissions();

  const canSave = useCallback(() => {
    return !isReadOnly;
  }, [isReadOnly]);

  const getSaveBlockReason = useCallback((): string | null => {
    if (!isReadOnly) return null;
    return `You have ${role || 'no'} permissions - you cannot save changes`;
  }, [isReadOnly, role]);

  const executeSave = useCallback(
    async <T,>(
      saveOperation: () => Promise<T>,
      options: { action?: string; successMessage?: string; errorMessage?: string } = {}
    ): Promise<T | null> => {
      const { action = 'save', successMessage, errorMessage } = options;

      if (!canSave()) {
        const reason = getSaveBlockReason();
        if (showToastOnError) {
          toast.error(errorMessage || reason || 'Save operation not allowed');
        }
        return null;
      }

      try {
        const result = await saveOperation();
        if (successMessage) {
          toast.success(successMessage);
        }
        return result;
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : `Failed to ${action.toLowerCase()}`;
        if (showToastOnError) {
          toast.error(errorMessage || msg);
        }
        throw error;
      }
    },
    [canSave, getSaveBlockReason, showToastOnError]
  );

  return {
    canSave,
    getSaveBlockReason,
    executeSave,
    isReadOnly,
  };
}

/**
 * Hook to check multiple permissions for a specific action
 * 
 * Usage:
 * const canDelete = useCanPerformSaveAction('delete', 'admin');
 */
export function useCanPerformSaveAction(
  action: string,
  minRole: 'viewer' | 'editor' | 'admin' | 'owner'
): { canPerform: boolean; reason: string } {
  const { role, requiresRole } = useEditorPermissions();

  const canPerform = requiresRole(minRole);

  let reason = `${action} requires ${minRole} role`;
  if (role) {
    reason += ` (you have ${role})`;
  } else {
    reason += ' (you are not logged in)';
  }

  return {
    canPerform,
    reason: canPerform ? '' : reason,
  };
}
