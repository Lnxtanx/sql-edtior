/**
 * MembersPanel.tsx
 * 
 * UI for managing project members
 * Shows list of members, allows add/remove/update roles
 */

import React, { useState } from 'react';
import { useMemberManagement, type ProjectMember } from '../hooks/useMemberManagement';
import { useEditorPermissions } from '../hooks/useEditorPermissions';
import { RemoveConfirmDialog } from './DeleteConfirmDialog';
import { Users, Plus, X, Crown, AlertCircle } from 'lucide-react';
import type { CollaborationRole } from '@/hooks/useCollaborationRole';

export interface MembersPanelProps {
  projectId: string;
  onClose?: () => void;
  onMembersChanged?: () => void;
  className?: string;
}

/**
 * Members panel for managing project members
 * 
 * Usage:
 * <MembersPanel projectId={projectId} />
 */
export function MembersPanel({
  projectId,
  onClose,
  onMembersChanged,
  className = '',
}: MembersPanelProps) {
  const { canAdmin } = useEditorPermissions();
  const {
    members,
    isLoading,
    error,
    canManage,
    addMember,
    removeMember,
    updateMemberRole,
  } = useMemberManagement({
    projectId,
    onMemberAdded: onMembersChanged,
    onMemberRemoved: onMembersChanged,
    onMemberRoleUpdated: onMembersChanged,
  });

  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<CollaborationRole>('editor');
  const [isAdding, setIsAdding] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMemberEmail.trim()) {
      return;
    }

    setIsAdding(true);
    try {
      await addMember(newMemberEmail, newMemberRole);
      setNewMemberEmail('');
      setNewMemberRole('editor');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    await removeMember(userId);
    setRemovingMemberId(null);
  };

  const memberToRemove = members.find((m) => m.userId === removingMemberId);

  return (
    <div className={`members-panel space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Users className="w-5 h-5" />
          Project Members ({members.length})
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Error loading members</p>
            <p className="text-xs mt-1">{error.message}</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !members.length && (
        <div className="text-center py-6 text-gray-500">
          <div className="animate-spin inline-block w-4 h-4 border border-gray-300 border-t-gray-600 rounded-full mr-2" />
          Loading members...
        </div>
      )}

      {/* Add member form (admin only) */}
      {canAdmin && (
        <form onSubmit={handleAddMember} className="border-t border-gray-200 pt-4">
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Add New Member
          </label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="Email address"
                disabled={isAdding}
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm disabled:bg-gray-100"
              />
              <select
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value as CollaborationRole)}
                disabled={isAdding}
                className="px-3 py-2 border border-gray-300 rounded text-sm bg-white disabled:bg-gray-100"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isAdding || !newMemberEmail.trim()}
              className="w-full py-2 px-3 rounded font-medium text-sm transition-colors flex items-center justify-center gap-2 bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              {isAdding ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      )}

      {/* Members list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {members.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            No members yet
          </div>
        ) : (
          members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              canManage={canManage}
              onRemove={() => setRemovingMemberId(member.userId)}
              onRoleChange={(newRole) =>
                updateMemberRole(member.userId, newRole)
              }
            />
          ))
        )}
      </div>

      {/* Remove confirmation */}
      {memberToRemove && (
        <RemoveConfirmDialog
          isOpen={removingMemberId !== null}
          userName={memberToRemove.username}
          onConfirm={() => handleRemoveMember(memberToRemove.userId)}
          onCancel={() => setRemovingMemberId(null)}
        />
      )}
    </div>
  );
}

/**
 * Single member row
 */
interface MemberRowProps {
  member: ProjectMember;
  canManage: boolean;
  onRemove: () => void;
  onRoleChange: (role: CollaborationRole) => void;
}

function MemberRow({
  member,
  canManage,
  onRemove,
  onRoleChange,
}: MemberRowProps) {
  const [isChangingRole, setIsChangingRole] = useState(false);

  const roleOptions: CollaborationRole[] = ['viewer', 'editor', 'admin'];

  return (
    <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded hover:border-gray-300">
      {/* Member info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{member.username}</p>
          {member.isOwner && (
            <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-medium">
              <Crown className="w-3 h-3" />
              Owner
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">{member.email}</p>
        {member.lastActive && (
          <p className="text-xs text-gray-400 mt-1">
            Last active: {formatDate(member.lastActive)}
          </p>
        )}
      </div>

      {/* Role selector */}
      {!member.isOwner && canManage ? (
        <select
          value={member.role}
          onChange={(e) => {
            setIsChangingRole(true);
            onRoleChange(e.target.value as CollaborationRole);
            setTimeout(() => setIsChangingRole(false), 300);
          }}
          disabled={isChangingRole}
          className="px-3 py-1 border border-gray-300 rounded text-sm bg-white disabled:opacity-50"
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </option>
          ))}
        </select>
      ) : (
        <div className="px-3 py-1 bg-gray-100 rounded text-sm font-medium uppercase">
          {member.role}
        </div>
      )}

      {/* Remove button */}
      {!member.isOwner && canManage && (
        <button
          onClick={onRemove}
          title="Remove member"
          className="p-1 hover:bg-red-100 hover:text-red-600 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  } catch {
    return 'Unknown';
  }
}
