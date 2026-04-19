import { describe, it, expect } from 'vitest';
import {
  parsePermissionError,
  isPermissionError,
  isOwnerOnlyError,
  isOwnerProtectedError,
  isInsufficientPermissionError,
  formatPermissionErrorMessage,
  PERMISSION_ERROR_CODES,
} from '../permissionErrorHandler';
import { ApiError } from '../client';

describe('permissionErrorHandler', () => {
  describe('PERMISSION_ERROR_CODES', () => {
    it('should export all required error codes', () => {
      expect(PERMISSION_ERROR_CODES.INSUFFICIENT_PERMISSIONS).toBe('INSUFFICIENT_PERMISSIONS');
      expect(PERMISSION_ERROR_CODES.OWNER_PROTECTED).toBe('OWNER_PROTECTED');
      expect(PERMISSION_ERROR_CODES.OWNER_ONLY).toBe('OWNER_ONLY');
      expect(PERMISSION_ERROR_CODES.NOT_PROJECT_MEMBER).toBe('NOT_PROJECT_MEMBER');
    });
  });

  describe('isPermissionError', () => {
    it('should return true for 403 status', () => {
      const error = new ApiError(403, 'Access Denied', {
        error: 'Access Denied',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      expect(isPermissionError(error)).toBe(true);
    });

    it('should return false for non-403 status', () => {
      const error = new ApiError(500, 'Server Error', {});
      expect(isPermissionError(error)).toBe(false);
    });

    it('should return false for non-ApiError objects', () => {
      const error = new Error('Generic error');
      expect(isPermissionError(error)).toBe(false);
    });
  });

  describe('parsePermissionError - INSUFFICIENT_PERMISSIONS', () => {
    it('should parse insufficient permissions with role details', () => {
      const error = new ApiError(403, 'Insufficient permissions', {
        error: 'Only admin or owner can delete files',
        code: 'INSUFFICIENT_PERMISSIONS',
        details: {
          required_role: 'admin',
          user_role: 'editor',
        },
      });

      const result = parsePermissionError(error);

      expect(result.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(result.requiredRole).toBe('admin');
      expect(result.userRole).toBe('editor');
      expect(result.isOwnerProtected).toBe(false);
      expect(result.isOwnerOnly).toBe(false);
    });

    it('should handle missing role details gracefully', () => {
      const error = new ApiError(403, 'Insufficient permissions', {
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        details: {},
      });

      const result = parsePermissionError(error);

      expect(result.code).toBe('INSUFFICIENT_PERMISSIONS');
      expect(result.requiredRole).toBeUndefined();
      expect(result.userRole).toBeUndefined();
    });
  });

  describe('parsePermissionError - OWNER_PROTECTED', () => {
    it('should parse owner protected error', () => {
      const error = new ApiError(403, 'Owner protected', {
        error: 'Cannot remove project owner',
        code: 'OWNER_PROTECTED',
        message: 'The project owner cannot be removed or have their role changed',
        details: {
          operation: 'remove_member',
        },
      });

      const result = parsePermissionError(error);

      expect(result.code).toBe('OWNER_PROTECTED');
      expect(result.isOwnerProtected).toBe(true);
      expect(result.isOwnerOnly).toBe(false);
    });
  });

  describe('parsePermissionError - OWNER_ONLY', () => {
    it('should parse owner only error', () => {
      const error = new ApiError(403, 'Owner only', {
        error: 'Only project owner can delete project',
        code: 'OWNER_ONLY',
        details: {
          operation: 'delete_project',
        },
      });

      const result = parsePermissionError(error);

      expect(result.code).toBe('OWNER_ONLY');
      expect(result.isOwnerOnly).toBe(true);
      expect(result.isOwnerProtected).toBe(false);
    });
  });

  describe('parsePermissionError - NOT_PROJECT_MEMBER', () => {
    it('should parse not project member error', () => {
      const error = new ApiError(403, 'Not a member', {
        error: 'Not a member of this project',
        code: 'NOT_PROJECT_MEMBER',
      });

      const result = parsePermissionError(error);

      expect(result.code).toBe('NOT_PROJECT_MEMBER');
    });
  });

  describe('isOwnerOnlyError', () => {
    it('should return true for OWNER_ONLY errors', () => {
      const error = new ApiError(403, 'Owner only', {
        code: 'OWNER_ONLY',
      });
      expect(isOwnerOnlyError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = new ApiError(403, 'Insufficient', {
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      expect(isOwnerOnlyError(error)).toBe(false);
    });
  });

  describe('isOwnerProtectedError', () => {
    it('should return true for OWNER_PROTECTED errors', () => {
      const error = new ApiError(403, 'Owner protected', {
        code: 'OWNER_PROTECTED',
      });
      expect(isOwnerProtectedError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = new ApiError(403, 'Owner only', {
        code: 'OWNER_ONLY',
      });
      expect(isOwnerProtectedError(error)).toBe(false);
    });
  });

  describe('isInsufficientPermissionError', () => {
    it('should return true for INSUFFICIENT_PERMISSIONS errors', () => {
      const error = new ApiError(403, 'Insufficient', {
        code: 'INSUFFICIENT_PERMISSIONS',
      });
      expect(isInsufficientPermissionError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      const error = new ApiError(403, 'Owner protected', {
        code: 'OWNER_PROTECTED',
      });
      expect(isInsufficientPermissionError(error)).toBe(false);
    });
  });

  describe('formatPermissionErrorMessage', () => {
    it('should format insufficient permission error as title and description', () => {
      const error = new ApiError(403, 'Insufficient', {
        code: 'INSUFFICIENT_PERMISSIONS',
        details: {
          required_role: 'admin',
          user_role: 'editor',
        },
      });

      const { title, description } = formatPermissionErrorMessage(error);

      expect(title).toBeDefined();
      expect(description).toBeDefined();
      expect(description).toContain('Admin');
      expect(description).toContain('Editor');
    });

    it('should format owner protected error with actionable suggestion', () => {
      const error = new ApiError(403, 'Owner protected', {
        code: 'OWNER_PROTECTED',
        message: 'Cannot remove project owner',
        details: {
          operation: 'remove_member',
        },
      });

      const { title, description } = formatPermissionErrorMessage(error);

      expect(title).toBeDefined();
      expect(description).toBeDefined();
      expect(description.toLowerCase()).toContain('owner');
    });

    it('should format owner only error', () => {
      const error = new ApiError(403, 'Owner only', {
        code: 'OWNER_ONLY',
        message: 'Only project owner can delete this',
      });

      const { title, description } = formatPermissionErrorMessage(error);

      expect(title).toBeDefined();
      expect(description).toBeDefined();
      expect(description.toLowerCase()).toContain('owner');
    });

    it('should format not project member error', () => {
      const error = new ApiError(403, 'Not a member', {
        code: 'NOT_PROJECT_MEMBER',
        message: 'You are not a member of this project',
      });

      const { title, description } = formatPermissionErrorMessage(error);

      expect(title).toBeDefined();
      expect(description).toBeDefined();
      expect(description.toLowerCase()).toContain('member');
    });

    it('should provide fallback for unknown error codes', () => {
      const error = new ApiError(403, 'Unknown error', {
        code: 'UNKNOWN_CODE',
        error: 'Some permission error',
      });

      const { title, description } = formatPermissionErrorMessage(error);

      expect(title).toBeDefined();
      expect(description).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle errors without data property', () => {
      const error = new ApiError(403, 'No data', null as any);
      expect(() => isPermissionError(error)).not.toThrow();
    });

    it('should handle malformed error objects', () => {
      const error = { statusCode: 403, message: 'Error' } as any;
      expect(isPermissionError(error)).toBe(false);
    });

    it('should handle null input gracefully', () => {
      expect(() => isPermissionError(null as any)).not.toThrow();
      expect(isPermissionError(null as any)).toBe(false);
    });
  });
});
