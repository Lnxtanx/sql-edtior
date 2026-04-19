/**
 * AdminPanel.tsx
 * 
 * Admin control panel for managing files and members
 * Visible only to admin+ users
 */

import React, { useState } from 'react';
import { useEditorPermissions } from '../hooks/useEditorPermissions';
import { useDeleteFile } from '../hooks/useDeleteFile';
import { useMemberManagement } from '../hooks/useMemberManagement';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { MembersPanel } from './MembersPanel';
import { Settings, Users, Trash2, Lock } from 'lucide-react';

export interface AdminPanelProps {
  fileId: string;
  fileName?: string;
  projectId: string;
  onFileDeleted?: (fileId: string) => void;
  onMembersChanged?: () => void;
  className?: string;
}

/**
 * Admin panel with all admin-only operations
 * 
 * Usage:
 * <AdminPanel 
 *   fileId={file.id}
 *   fileName={file.name}
 *   projectId={projectId}
 *   onFileDeleted={(fileId) => navigate('/')}
 * />
 */
export function AdminPanel({
  fileId,
  fileName = 'File',
  projectId,
  onFileDeleted,
  onMembersChanged,
  className = '',
}: AdminPanelProps) {
  const { canAdmin, role } = useEditorPermissions();
  const {
    deleteFile,
    isDeleting,
    error: deleteError,
    canDelete,
  } = useDeleteFile({
    fileId,
    fileName,
    projectId,
    onSuccess: onFileDeleted,
    showConfirmation: true,
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);

  // Only show to admin+ users
  if (!canAdmin) {
    return null;
  }

  return (
    <div
      className={`admin-panel border-l border-gray-200 bg-gray-50 ${className}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Admin Controls
        </h2>
        <p className="text-sm text-gray-500 mt-1">Your role: {role}</p>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Delete File Section */}
        <section className="space-y-3">
          <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Delete File
          </h3>

          {deleteError && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
              <p className="font-medium">Error: {deleteError.message}</p>
            </div>
          )}

          {!canDelete && (
            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <p>You don't have permission to delete this file</p>
            </div>
          )}

          <button
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting || !canDelete}
            className={`w-full py-2 px-3 rounded font-medium text-sm transition-colors flex items-center justify-center gap-2
              ${
                isDeleting || !canDelete
                  ? 'bg-red-100 text-red-400 cursor-not-allowed'
                  : 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700'
              }
            `}
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? 'Deleting...' : 'Delete File'}
          </button>

          <p className="text-xs text-gray-500">
            Permanently delete this file from the project. This cannot be undone.
          </p>
        </section>

        {/* Members Management Section */}
        <section className="space-y-3">
          <h3 className="font-semibold text-sm text-gray-700 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Project Members
          </h3>

          <button
            onClick={() => setShowMembersPanel(!showMembersPanel)}
            className="w-full py-2 px-3 rounded font-medium text-sm transition-colors bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Users className="w-4 h-4" />
            {showMembersPanel ? 'Hide Members' : 'Manage Members'}
          </button>

          {showMembersPanel && (
            <div className="border border-gray-200 rounded p-3 bg-white">
              <MembersPanel
                projectId={projectId}
                onClose={() => setShowMembersPanel(false)}
                onMembersChanged={onMembersChanged}
              />
            </div>
          )}

          <p className="text-xs text-gray-500">
            Add, remove, or update member roles for this project.
          </p>
        </section>

        {/* Info */}
        <div className="pt-3 border-t border-gray-200 text-xs text-gray-400 space-y-1">
          <p>📄 File: {fileName}</p>
          <p>🔑 Role: {role}</p>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        itemName={fileName}
        itemType="file"
        onConfirm={async () => {
          await deleteFile();
          setShowDeleteDialog(false);
        }}
        onCancel={() => setShowDeleteDialog(false)}
        isLoading={isDeleting}
      />
    </div>
  );
}

/**
 * Collapsed version for toolbar
 */
export interface AdminPanelButtonProps {
  fileId: string;
  projectId: string;
  onFileDeleted?: (fileId: string) => void;
}

export function AdminPanelButton({
  fileId,
  projectId,
  onFileDeleted,
}: AdminPanelButtonProps) {
  const { canAdmin } = useEditorPermissions();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!canAdmin) {
    return null;
  }

  return (
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      title="Admin Controls"
      className="p-2 hover:bg-gray-100 rounded transition-colors"
    >
      <Settings className="w-5 h-5 text-gray-600" />
    </button>
  );
}
