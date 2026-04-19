/**
 * frontend/src/lib/api/permissionErrorHandler.ts
 *
 * Unified permission error handler for Phase 6 Part 2 integration
 *
 * Handles detailed 403 Forbidden responses from backend with:
 * - Role requirements (viewer, editor, admin, owner)
 * - Special protection messages (owner removal, role change)
 * - Operation-specific guidance
 *
 * Usage:
 *   try {
 *     await deleteFile(fileId);
 *   } catch (error) {
 *     const errorInfo = parsePermissionError(error);
 *     toast.error(errorInfo.title, { description: errorInfo.message });
 *   }
 */

import { ApiError } from './client';

export interface PermissionErrorInfo {
  /** Toast title (e.g., "Permission Denied") */
  title: string;
  
  /** Toast description (main message) */
  message: string;
  
  /** Error code for logging/debugging */
  code: string;
  
  /** Required role if applicable (e.g., "admin") */
  requiredRole?: string;
  
  /** User's actual role if known */
  userRole?: string;
  
  /** Actionable suggestion for the user */
  suggestion?: string;
  
  /** Whether this is an owner protection error */
  isOwnerProtected: boolean;
  
  /** Whether this is an owner-only operation */
  isOwnerOnly: boolean;
  
  /** HTTP status code for debugging */
  statusCode: number;
}

/**
 * Error codes from Phase 6 Part 2 backend
 */
export const PERMISSION_ERROR_CODES = {
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  OWNER_PROTECTED: 'OWNER_PROTECTED',
  OWNER_ONLY: 'OWNER_ONLY',
  NOT_PROJECT_MEMBER: 'NOT_PROJECT_MEMBER',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const;

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  'viewer': 'Viewer',
  'editor': 'Editor',
  'admin': 'Admin',
  'owner': 'Owner',
};

/**
 * Parse permission error from API response
 * Handles both structured responses (from Phase 6 Part 2) and fallback messages
 */
export function parsePermissionError(error: unknown): PermissionErrorInfo {
  const defaultError: PermissionErrorInfo = {
    title: 'Permission Denied',
    message: 'You do not have permission to perform this action',
    code: PERMISSION_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    isOwnerProtected: false,
    isOwnerOnly: false,
    statusCode: 403,
  };

  // Handle non-API errors
  if (!(error instanceof ApiError)) {
    return defaultError;
  }

  // Extract error details from response
  const data = error.data as Record<string, any>;
  const errorCode = data?.code || data?.error || 'UNKNOWN';
  const details = data?.details || {};
  const statusCode = error.status || 403;

  // Build base error info
  const errorInfo: PermissionErrorInfo = {
    title: 'Permission Denied',
    message: data?.message || data?.error || defaultError.message,
    code: errorCode,
    requiredRole: details?.requiredRole || details?.required_role,
    userRole: details?.userRole || details?.user_role,
    isOwnerProtected: errorCode === PERMISSION_ERROR_CODES.OWNER_PROTECTED,
    isOwnerOnly: errorCode === PERMISSION_ERROR_CODES.OWNER_ONLY,
    statusCode,
  };

  // Enhance message based on error type
  if (errorInfo.isOwnerOnly) {
    errorInfo.title = 'Owner Only';
    errorInfo.message = 'Only the project owner can perform this action';
    errorInfo.suggestion = 'Contact the project owner to complete this operation';
  } else if (errorInfo.isOwnerProtected) {
    errorInfo.title = 'Cannot Delete Owner';
    if (data?.message?.includes('role')) {
      errorInfo.message = 'The project owner role cannot be modified';
      errorInfo.suggestion = 'To change ownership, transfer the project to another user';
    } else {
      errorInfo.message = 'The project owner cannot be removed from the project';
      errorInfo.suggestion = 'Transfer project ownership before removing members';
    }
  } else if (errorInfo.requiredRole && errorInfo.userRole) {
    // Add role information to message
    const requiredRoleName = ROLE_DISPLAY_NAMES[errorInfo.requiredRole] || errorInfo.requiredRole;
    const userRoleName = ROLE_DISPLAY_NAMES[errorInfo.userRole] || errorInfo.userRole;
    errorInfo.message = `Requires ${requiredRoleName} role minimum (you have ${userRoleName})`;
  }

  return errorInfo;
}

/**
 * Check if an API error is a permission error (403)
 */
export function isPermissionError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 403;
}

/**
 * Check if error is owner-only operation
 */
export function isOwnerOnlyError(error: unknown): boolean {
  if (!isPermissionError(error)) return false;
  const data = error.data as Record<string, any>;
  return data?.code === PERMISSION_ERROR_CODES.OWNER_ONLY;
}

/**
 * Check if error is owner protection (cannot remove/modify owner)
 */
export function isOwnerProtectedError(error: unknown): boolean {
  if (!isPermissionError(error)) return false;
  const data = error.data as Record<string, any>;
  return data?.code === PERMISSION_ERROR_CODES.OWNER_PROTECTED;
}

/**
 * Check if error is insufficient permissions (role too low)
 */
export function isInsufficientPermissionError(error: unknown): boolean {
  if (!isPermissionError(error)) return false;
  const data = error.data as Record<string, any>;
  return data?.code === PERMISSION_ERROR_CODES.INSUFFICIENT_PERMISSIONS;
}

/**
 * Check if user is not a project member
 */
export function isNotProjectMemberError(error: unknown): boolean {
  if (!isPermissionError(error)) return false;
  const data = error.data as Record<string, any>;
  return data?.code === PERMISSION_ERROR_CODES.NOT_PROJECT_MEMBER;
}

/**
 * Get user-friendly title for permission error
 */
export function getPermissionErrorTitle(error: unknown): string {
  if (!isPermissionError(error)) {
    return 'Error';
  }

  const data = error.data as Record<string, any>;
  const code = data?.code;

  if (code === PERMISSION_ERROR_CODES.OWNER_ONLY) {
    return 'Owner Only';
  }
  if (code === PERMISSION_ERROR_CODES.OWNER_PROTECTED) {
    return 'Cannot Modify Owner';
  }
  if (code === PERMISSION_ERROR_CODES.NOT_PROJECT_MEMBER) {
    return 'Not a Project Member';
  }

  return 'Permission Denied';
}

/**
 * Format error message for display
 * Used in toast notifications
 */
export function formatPermissionErrorMessage(error: unknown): {
  title: string;
  description: string;
} {
  if (!isPermissionError(error)) {
    return {
      title: 'Error',
      description: error instanceof Error ? error.message : 'An error occurred',
    };
  }

  const errorInfo = parsePermissionError(error);
  let description = errorInfo.message;

  // Add suggestion if available
  if (errorInfo.suggestion) {
    description += '\n' + errorInfo.suggestion;
  }

  return {
    title: errorInfo.title,
    description,
  };
}
