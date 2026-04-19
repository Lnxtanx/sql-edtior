/**
 * useCollaborationRole.ts
 * 
 * Utilities for working with collaboration roles.
 * Provides role hierarchy checks and permission utilities.
 */

export type CollaborationRole = 'viewer' | 'editor' | 'admin' | 'owner';

// Role hierarchy (lower number = fewer permissions)
const ROLE_HIERARCHY: Record<CollaborationRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

/**
 * Check if a role has at least the minimum required role level
 * @param userRole - The user's current role
 * @param minRole - The minimum required role
 * @returns true if user has sufficient permissions
 */
export function hasMinimumRole(
  userRole: CollaborationRole | null | undefined,
  minRole: CollaborationRole
): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

/**
 * Check if user can edit (requires editor or higher)
 */
export function canEdit(role: CollaborationRole | null | undefined): boolean {
  return hasMinimumRole(role, 'editor');
}

/**
 * Check if user can manage members/delete files (requires admin or higher)
 */
export function canAdmin(role: CollaborationRole | null | undefined): boolean {
  return hasMinimumRole(role, 'admin');
}

/**
 * Check if user can delete entire project (requires owner)
 */
export function canOwn(role: CollaborationRole | null | undefined): boolean {
  return hasMinimumRole(role, 'owner');
}

/**
 * Check if user is viewer/read-only (lowest permission level)
 */
export function isViewer(role: CollaborationRole | null | undefined): boolean {
  return role === 'viewer';
}

/**
 * Check if user is editor (can modify but not delete)
 */
export function isEditor(role: CollaborationRole | null | undefined): boolean {
  return role === 'editor';
}

/**
 * Get human-readable role name
 */
export function getRoleLabel(role: CollaborationRole): string {
  const labels: Record<CollaborationRole, string> = {
    viewer: 'Viewer',
    editor: 'Editor',
    admin: 'Admin',
    owner: 'Owner',
  };
  return labels[role];
}

/**
 * Get role description
 */
export function getRoleDescription(role: CollaborationRole): string {
  const descriptions: Record<CollaborationRole, string> = {
    viewer: 'Can view files, cannot edit',
    editor: 'Can view and edit files',
    admin: 'Can manage members and delete files',
    owner: 'Full access, can delete project',
  };
  return descriptions[role];
}

/**
 * Get role color for UI
 */
export function getRoleColor(role: CollaborationRole): string {
  const colors: Record<CollaborationRole, string> = {
    viewer: 'gray',
    editor: 'blue',
    admin: 'purple',
    owner: 'red',
  };
  return colors[role];
}

/**
 * Get all roles in order
 */
export function getAllRoles(): CollaborationRole[] {
  return ['viewer', 'editor', 'admin', 'owner'];
}

/**
 * Get all roles that are >= a minimum role
 */
export function getRolesFromMinimum(minRole: CollaborationRole): CollaborationRole[] {
  return getAllRoles().filter((role) => hasMinimumRole(role, minRole));
}
