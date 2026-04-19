/**
 * useEditorPermissions.ts
 * 
 * Custom hook for accessing and managing editor permissions.
 * Wraps useEditorRole and provides additional utilities.
 */

import { useEditorRole } from '../EditorRoleContext';
import { toast } from 'sonner';
import type { CollaborationRole } from '@/hooks/useCollaborationRole';

export interface EditorPermissions {
  // Basic role info
  role: CollaborationRole | null;

  // Permission checks
  canEdit: boolean;
  canAdmin: boolean;
  isReadOnly: boolean;

  // Utility functions
  requiresRole: (minRole: CollaborationRole) => boolean;
  throwIfUnauthorized: (minRole: CollaborationRole) => void;
}

/**
 * Hook to use editor permissions
 * Must be used within EditorRoleProvider
 * 
 * Usage:
 * const { isReadOnly, canEdit } = useEditorPermissions();
 * 
 * if (isReadOnly) {
 *   return <ReadOnlyBadge />;
 * }
 */
export function useEditorPermissions(): EditorPermissions {
  const { role, canEdit, canAdmin, isReadOnly } = useEditorRole();

  const roleHierarchy: Record<CollaborationRole, number> = {
    viewer: 0,
    editor: 1,
    admin: 2,
    owner: 3,
  };

  const requiresRole = (minRole: CollaborationRole): boolean => {
    if (!role) return false;
    return roleHierarchy[role] >= roleHierarchy[minRole];
  };

  const throwIfUnauthorized = (minRole: CollaborationRole): void => {
    if (!requiresRole(minRole)) {
      throw new Error(
        `Unauthorized: requires ${minRole} role, but user has ${role || 'no'} role`
      );
    }
  };

  return {
    role,
    canEdit,
    canAdmin,
    isReadOnly,
    requiresRole,
    throwIfUnauthorized,
  };
}

/**
 * Hook to check if user can perform a specific action
 * 
 * Usage:
 * const canDelete = useCanPerformAction('admin');
 * if (!canDelete) {
 *   disableDeleteButton();
 * }
 */
export function useCanPerformAction(minRole: CollaborationRole): boolean {
  const { requiresRole } = useEditorPermissions();
  return requiresRole(minRole);
}

/**
 * Hook to guard action execution
 * 
 * Usage:
 * const guardDelete = useActionGuard('admin');
 * 
 * const handleDelete = () => {
 *   guardDelete(() => {
 *     // This runs only if user is admin+
 *     deleteFile();
 *   });
 * };
 */
export function useActionGuard(minRole: CollaborationRole) {
  const { throwIfUnauthorized, role } = useEditorPermissions();

  return (callback: () => void) => {
    try {
      throwIfUnauthorized(minRole);
      callback();
    } catch (error) {
      // Show user-facing error message
      toast.error('Permission Denied', {
        description: `You need ${minRole} or higher permissions to perform this action. You have: ${role || 'no'} permissions.`,
        duration: 4000,
      });
      throw error;
    }
  };
}
