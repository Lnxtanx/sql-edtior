/**
 * ReadOnlyBadge.tsx
 * 
 * Visual component showing when file is in read-only mode.
 * Displays to users with viewer role.
 */

import React from 'react';
import { useEditorPermissions } from './hooks/useEditorPermissions';
import { getRoleLabel } from '../hooks/useCollaborationRole';

export interface ReadOnlyBadgeProps {
  /**
   * Additional CSS class to apply
   */
  className?: string;

  /**
   * Whether to show the full role label (e.g., "Viewer") or short version
   */
  showRole?: boolean;

  /**
   * Custom message to display instead of default
   */
  message?: string;
}

/**
 * Badge component that shows read-only access
 * 
 * Usage:
 * <ReadOnlyBadge />
 * 
 * // With custom message
 * <ReadOnlyBadge message="You don't have edit permissions" />
 * 
 * // Show role label
 * <ReadOnlyBadge showRole />
 */
export function ReadOnlyBadge({
  className = '',
  showRole = false,
  message,
}: ReadOnlyBadgeProps) {
  const { isReadOnly, role } = useEditorPermissions();

  // Don't show if not read-only
  if (!isReadOnly) {
    return null;
  }

  const defaultMessage = showRole && role ? `${getRoleLabel(role)} - Read-only` : '🔒 Read-only';
  const displayMessage = message || defaultMessage;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-900 ${className}`}
      role="status"
      aria-label="Read-only mode"
    >
      <svg
        className="w-4 h-4 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" />
      </svg>
      <span>{displayMessage}</span>
    </div>
  );
}

/**
 * Compact version - just an icon
 * 
 * Usage:
 * <ReadOnlyBadgeCompact />
 */
export function ReadOnlyBadgeCompact({ className = '' }: { className?: string }) {
  const { isReadOnly } = useEditorPermissions();

  if (!isReadOnly) {
    return null;
  }

  return (
    <span
      title="Read-only access - you cannot edit this file"
      className={`inline-flex items-center justify-center w-6 h-6 rounded bg-amber-100 text-amber-600 ${className}`}
    >
      🔒
    </span>
  );
}

/**
 * Icon-only version with tooltip
 * 
 * Usage:
 * <ReadOnlyIcon />
 */
export function ReadOnlyIcon({ className = '' }: { className?: string }) {
  const { isReadOnly, role } = useEditorPermissions();

  if (!isReadOnly) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      title={`You have ${role} access - read-only`}
    >
      <svg
        className="w-5 h-5 text-amber-600"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" />
      </svg>
    </div>
  );
}
