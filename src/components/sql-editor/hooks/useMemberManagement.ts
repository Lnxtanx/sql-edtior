/**
 * useMemberManagement.ts
 * 
 * Hook for managing project members (add, remove, update roles)
 * Only admin+ users can manage members
 */

import { useCallback, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ApiError, getCsrfToken } from '@/lib/api/client';
import { 
  isPermissionError, 
  formatPermissionErrorMessage 
} from '@/lib/api/permissionErrorHandler';
import { useEditorPermissions, useActionGuard } from './useEditorPermissions';
import type { CollaborationRole } from '@/hooks/useCollaborationRole';

export interface ProjectMember {
  id: string;
  userId: string;
  username: string;
  email: string;
  role: CollaborationRole;
  joinedAt: string; // ISO date string
  isOwner: boolean;
  lastActive?: string;
}

export interface UseMemberManagementOptions {
  projectId: string;
  onMemberAdded?: (member: ProjectMember) => void;
  onMemberRemoved?: (userId: string) => void;
  onMemberRoleUpdated?: (userId: string, newRole: CollaborationRole) => void;
  autoFetch?: boolean;
}

export interface UseMemberManagementState {
  members: ProjectMember[];
  isLoading: boolean;
  error: Error | null;
  canManage: boolean;
  addMember: (email: string, role: CollaborationRole) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  updateMemberRole: (userId: string, newRole: CollaborationRole) => Promise<void>;
  refreshMembers: () => Promise<void>;
}

/**
 * Hook to manage project members
 * 
 * Usage:
 * const { members, addMember, removeMember, updateMemberRole } = useMemberManagement({
 *   projectId: 'project-123',
 *   onMemberAdded: (member) => console.log('Added:', member.username),
 * });
 * 
 * return (
 *   <div>
 *     {members.map(member => (
 *       <MemberRow key={member.id} member={member} />
 *     ))}
 *   </div>
 * );
 */
export function useMemberManagement({
  projectId,
  onMemberAdded,
  onMemberRemoved,
  onMemberRoleUpdated,
  autoFetch = true,
}: UseMemberManagementOptions): UseMemberManagementState {
  const { canAdmin, role } = useEditorPermissions();
  const performSaveAction = useActionGuard('admin');

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch members list from API
   */
  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/members`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load members');
      }

      const data = await response.json();
      setMembers(data.members || []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      toast.error('Failed to load members', {
        description: error.message,
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  /**
   * Fetch members on mount
   */
  useEffect(() => {
    if (autoFetch) {
      fetchMembers();
    }
  }, [projectId, autoFetch, fetchMembers]);

  /**
   * Add new member to project
   */
  const addMember = useCallback(
    async (email: string, roleToAdd: CollaborationRole) => {
      // Permission check
      if (!canAdmin) {
        toast.error('Permission denied', {
          description: 'Only admin+ can add members',
          duration: 4000,
        });
        return;
      }

      setError(null);

      try {
        await performSaveAction(async () => {
          const response = await fetch(`/api/projects/${projectId}/members`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(getCsrfToken() ? { 'X-CSRF-Token': getCsrfToken()! } : {}),
            },
            body: JSON.stringify({ email, role: roleToAdd }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add member');
          }

          const newMember = await response.json();

          // Update local state
          setMembers((prev) => [...prev, newMember]);

          // Show success
          toast.success('Member added', {
            description: `${email} has been added as ${roleToAdd}`,
            duration: 4000,
          });

          // Call callback
          if (onMemberAdded) {
            onMemberAdded(newMember);
          }
        });
      } catch (err) {
        // Handle permission errors with new error handler
        if (err instanceof ApiError && isPermissionError(err)) {
          const { title, description } = formatPermissionErrorMessage(err);
          setError(new Error(description));
          toast.error(title, {
            description,
            duration: 4000,
          });
        } else {
          const error = err instanceof Error ? err : new Error('Unknown error');
          setError(error);
          toast.error('Failed to add member', {
            description: error.message,
            duration: 4000,
          });
        }
      }
    },
    [projectId, canAdmin, performSaveAction, onMemberAdded]
  );

  /**
   * Remove member from project
   */
  const removeMember = useCallback(
    async (userId: string) => {
      // Permission check
      if (!canAdmin) {
        toast.error('Permission denied', {
          description: 'Only admin+ can remove members',
          duration: 4000,
        });
        return;
      }

      // Find member being removed
      const memberToRemove = members.find((m) => m.userId === userId);
      if (!memberToRemove) {
        toast.error('Member not found', {
          description: 'Could not find member to remove',
          duration: 4000,
        });
        return;
      }

      // Prevent removing owner
      if (memberToRemove.isOwner) {
        toast.error('Cannot remove owner', {
          description: 'The project owner cannot be removed',
          duration: 4000,
        });
        return;
      }

      setError(null);

      try {
        await performSaveAction(async () => {
          const response = await fetch(
            `/api/projects/${projectId}/members/${userId}`,
            {
              method: 'DELETE',
              headers: {
                ...(getCsrfToken() ? { 'X-CSRF-Token': getCsrfToken()! } : {}),
              },
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to remove member');
          }

          // Update local state
          setMembers((prev) =>
            prev.filter((m) => m.userId !== userId)
          );

          // Show success
          toast.success('Member removed', {
            description: `${memberToRemove.username} has been removed from the project`,
            duration: 4000,
          });

          // Call callback
          if (onMemberRemoved) {
            onMemberRemoved(userId);
          }
        });
      } catch (err) {
        // Handle permission errors with new error handler
        if (err instanceof ApiError && isPermissionError(err)) {
          const { title, description } = formatPermissionErrorMessage(err);
          setError(new Error(description));
          toast.error(title, {
            description,
            duration: 4000,
          });
        } else {
          const error = err instanceof Error ? err : new Error('Unknown error');
          setError(error);
          toast.error('Failed to remove member', {
            description: error.message,
            duration: 4000,
          });
        }
      }
    },
    [projectId, canAdmin, members, performSaveAction, onMemberRemoved]
  );

  /**
   * Update member role
   */
  const updateMemberRole = useCallback(
    async (userId: string, newRole: CollaborationRole) => {
      // Permission check
      if (!canAdmin) {
        toast.error('Permission denied', {
          description: 'Only admin+ can change member roles',
          duration: 4000,
        });
        return;
      }

      // Find member being updated
      const memberToUpdate = members.find((m) => m.userId === userId);
      if (!memberToUpdate) {
        toast.error('Member not found', {
          description: 'Could not find member to update',
          duration: 4000,
        });
        return;
      }

      // Prevent changing owner role
      if (memberToUpdate.isOwner) {
        toast.error('Cannot change owner role', {
          description: 'The project owner role is permanent',
          duration: 4000,
        });
        return;
      }

      setError(null);

      try {
        await performSaveAction(async () => {
          const response = await fetch(
            `/api/projects/${projectId}/members/${userId}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                ...(getCsrfToken() ? { 'X-CSRF-Token': getCsrfToken()! } : {}),
              },
              body: JSON.stringify({ role: newRole }),
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update role');
          }

          // Update local state
          setMembers((prev) =>
            prev.map((m) =>
              m.userId === userId ? { ...m, role: newRole } : m
            )
          );

          // Show success
          toast.success('Role updated', {
            description: `${memberToUpdate.username} is now an ${newRole}`,
            duration: 4000,
          });

          // Call callback
          if (onMemberRoleUpdated) {
            onMemberRoleUpdated(userId, newRole);
          }
        });
      } catch (err) {
        // Handle permission errors with new error handler
        if (err instanceof ApiError && isPermissionError(err)) {
          const { title, description } = formatPermissionErrorMessage(err);
          setError(new Error(description));
          toast.error(title, {
            description,
            duration: 4000,
          });
        } else {
          const error = err instanceof Error ? err : new Error('Unknown error');
          setError(error);
          toast.error('Failed to update role', {
            description: error.message,
            duration: 4000,
          });
        }
      }
    },
    [projectId, canAdmin, members, performSaveAction, onMemberRoleUpdated]
  );

  return {
    members,
    isLoading,
    error,
    canManage: canAdmin,
    addMember,
    removeMember,
    updateMemberRole,
    refreshMembers: fetchMembers,
  };
}

/**
 * Hook to check if member management is available
 */
export function useCanManageMembers(): { canManage: boolean; reason: string } {
  const { canAdmin, role } = useEditorPermissions();

  if (!canAdmin) {
    return {
      canManage: false,
      reason: `You need admin or higher permissions. You have: ${role || 'no'} permissions.`,
    };
  }

  return {
    canManage: true,
    reason: 'You can manage members',
  };
}

/**
 * Hook to fetch members without management capability
 * Useful for read-only member list display
 */
export interface UseProjectMembersOptions {
  projectId: string;
  autoFetch?: boolean;
}

export function useProjectMembers({
  projectId,
  autoFetch = true,
}: UseProjectMembersOptions) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(autoFetch);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!autoFetch) return;

    const fetchMembers = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/projects/${projectId}/members`);
        if (!response.ok) throw new Error('Failed to fetch members');
        const data = await response.json();
        setMembers(data.members || []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [projectId, autoFetch]);

  return { members, isLoading, error };
}
