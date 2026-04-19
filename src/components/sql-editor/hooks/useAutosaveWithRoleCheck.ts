/**
 * useAutosaveWithRoleCheck.ts
 * 
 * Wrapper around useAutosave that respects user permissions.
 * Prevents viewers from triggering autosave with clear feedback.
 */

import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useAutosave } from '@/lib/file-management/hooks/useAutosave';
import { useEditorPermissions } from './useEditorPermissions';
import type { SqlFile } from '@/lib/file-management';

export interface UseAutosaveWithRoleCheckOptions {
  file: SqlFile | null;
  repository: any; // DocumentRepository type
  debounceMs?: number;
  show403Toast?: boolean; // Whether to show toast on first permission deny
}

/**
 * Hook that wraps useAutosave with permission checks
 * 
 * For viewers: Disables autosave and shows one toast notification
 * For editors+: Works normally
 * 
 * Usage:
 * useAutosaveWithRoleCheck({
 *   file: currentFile,
 *   repository: documentRepository,
 *   debounceMs: 2000,
 * });
 */
export function useAutosaveWithRoleCheck({
  file,
  repository,
  debounceMs = 2000,
  show403Toast = true,
}: UseAutosaveWithRoleCheckOptions): void {
  const { isReadOnly, role } = useEditorPermissions();
  
  // Track if we've already shown the toast for this session
  const toastShownRef = useCallback(() => {
    const key = `autosave-denied-${file?.id}`;
    const hasShown = sessionStorage.getItem(key) === 'true';
    return hasShown;
  }, [file?.id]);

  const markToastShown = useCallback(() => {
    const key = `autosave-denied-${file?.id}`;
    sessionStorage.setItem(key, 'true');
  }, [file?.id]);

  // If viewer, don't enable autosave
  if (isReadOnly) {
    useEffect(() => {
      // Show toast only once per file
      if (show403Toast && !toastShownRef()) {
        toast.error('Autosave is disabled - you have read-only access', {
          description: `You have ${role || 'no'} permissions. Edits are local only.`,
          duration: 4000,
        });
        markToastShown();
      }
    }, [file?.id, isReadOnly, show403Toast, role]);
    
    return; // Don't set up autosave
  }

  // Otherwise, use normal autosave
  useAutosave({
    file,
    repository,
    enabled: true,
    debounceMs,
  });
}

/**
 * Hook variant that shows a different message for first-time viewers
 * Useful for new collaborators who might be confused
 */
export function useAutosaveWithRoleCheckVerbose({
  file,
  repository,
  debounceMs = 2000,
}: Omit<UseAutosaveWithRoleCheckOptions, 'show403Toast'>): void {
  const { isReadOnly, role } = useEditorPermissions();
  const toastShownRef = useCallback(() => {
    const key = `autosave-verbose-${file?.id}`;
    return sessionStorage.getItem(key) === 'true';
  }, [file?.id]);

  const markToastShown = useCallback(() => {
    const key = `autosave-verbose-${file?.id}`;
    sessionStorage.setItem(key, 'true');
  }, [file?.id]);

  if (isReadOnly) {
    useEffect(() => {
      if (!toastShownRef()) {
        if (role === 'viewer') {
          toast.error('Read-Only File', {
            description: 'You can view this file but cannot make changes. Contact the owner to request edit access.',
            duration: 5000,
            action: {
              label: 'Got it',
              onClick: () => {},
            },
          });
        } else {
          toast.error('Access Denied', {
            description: `You don't have permission to edit this file.`,
            duration: 4000,
          });
        }
        markToastShown();
      }
    }, [file?.id, isReadOnly, role]);

    return;
  }

  useAutosave({
    file,
    repository,
    enabled: true,
    debounceMs,
  });
}

/**
 * Hook to check if autosave is available
 * Useful for displaying UI indicators
 * 
 * Usage:
 * const { isAutosaveAvailable } = useAutosaveAvailability();
 * if (!isAutosaveAvailable) {
 *   return <ReadOnlyBadge />;
 * }
 */
export function useAutosaveAvailability(): { isAutosaveAvailable: boolean; reason: string } {
  const { isReadOnly, role } = useEditorPermissions();

  if (isReadOnly) {
    return {
      isAutosaveAvailable: false,
      reason: `You have ${role || 'no'} permissions - read-only access`,
    };
  }

  return {
    isAutosaveAvailable: true,
    reason: 'Autosave enabled',
  };
}
