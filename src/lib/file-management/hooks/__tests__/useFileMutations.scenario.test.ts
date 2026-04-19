import { describe, it, expect } from 'vitest';
import {
  isPermissionError,
  formatPermissionErrorMessage,
} from '@/lib/api/permissionErrorHandler';
import { ApiError } from '@/lib/api/client';

const mockApiError = (code: string, requiredRole?: string, userRole?: string) =>
  new ApiError(403, 'Permission denied', {
    error: 'Permission denied',
    code,
    details: {
      required_role: requiredRole,
      user_role: userRole,
      operation: 'test_operation',
    },
  });

describe('Permission Error Integration - useFileMutations Scenarios', () => {
  describe('File Operations Scenarios', () => {
    it('should detect insufficient permissions on file creation', () => {
      const error = mockApiError('INSUFFICIENT_PERMISSIONS', 'admin', 'editor');
      expect(isPermissionError(error)).toBe(true);
      
      const { title, description } = formatPermissionErrorMessage(error);
      expect(title).toBeDefined();
      expect(description).toBeDefined();
      expect(description).toContain('Admin');
    });

    it('should format admin requirement for file deletion', () => {
      const error = mockApiError('INSUFFICIENT_PERMISSIONS', 'admin', 'editor');
      const { title, description } = formatPermissionErrorMessage(error);
      
      expect(title).toBeDefined();
      expect(description).toContain('Admin');
      expect(description).toContain('Editor');
    });

    it('should show editor requirement for file move', () => {
      const error = mockApiError('INSUFFICIENT_PERMISSIONS', 'editor', 'viewer');
      const { description } = formatPermissionErrorMessage(error);
      
      expect(description).toContain('Editor');
      expect(description).toContain('Viewer');
    });
  });

  describe('Project Operations Scenarios', () => {
    it('should show admin required for project update', () => {
      const error = mockApiError('INSUFFICIENT_PERMISSIONS', 'admin', 'editor');
      expect(isPermissionError(error)).toBe(true);
      
      const { description } = formatPermissionErrorMessage(error);
      expect(description).toContain('Admin');
    });

    it('should show owner only message for project deletion', () => {
      const error = new ApiError(403, 'Owner only', {
        error: 'Only project owner can delete project',
        code: 'OWNER_ONLY',
        details: {
          operation: 'delete_project',
        },
      });

      expect(isPermissionError(error)).toBe(true);
      const { description } = formatPermissionErrorMessage(error);
      expect(description.toLowerCase()).toContain('owner');
    });

    it('should show admin required for bootstrap (demo project)', () => {
      const error = mockApiError('INSUFFICIENT_PERMISSIONS', 'admin', 'viewer');
      const { description } = formatPermissionErrorMessage(error);
      expect(description).toContain('Admin');
    });
  });

  describe('Permission Error Detection', () => {
    it('should identify all permission errors as 403 status', () => {
      const errorCodes = [
        'INSUFFICIENT_PERMISSIONS',
        'OWNER_PROTECTED',
        'OWNER_ONLY',
        'NOT_PROJECT_MEMBER',
      ];

      errorCodes.forEach((code) => {
        const error = new ApiError(403, 'Test', { code });
        expect(isPermissionError(error)).toBe(true);
      });
    });

    it('should reject non-permission 500 errors', () => {
      const error = new ApiError(500, 'Server error', {
        error: 'Internal server error',
      });

      expect(isPermissionError(error)).toBe(false);
    });

    it('should reject 404 and other HTTP errors', () => {
      const error404 = new ApiError(404, 'Not found', {});
      const error409 = new ApiError(409, 'Conflict', {});
      
      expect(isPermissionError(error404)).toBe(false);
      expect(isPermissionError(error409)).toBe(false);
    });
  });

  describe('Error Message Format Consistency', () => {
    it('should always provide title and description for all error codes', () => {
      const testCases = [
        { code: 'INSUFFICIENT_PERMISSIONS', role: 'admin', userRole: 'editor' },
        { code: 'OWNER_PROTECTED', role: undefined, userRole: undefined },
        { code: 'OWNER_ONLY', role: undefined, userRole: undefined },
        { code: 'NOT_PROJECT_MEMBER', role: undefined, userRole: undefined },
      ];

      testCases.forEach(({ code, role, userRole }) => {
        const error = new ApiError(403, 'Test error', {
          code,
          details: {
            required_role: role,
            user_role: userRole,
          },
        });

        const { title, description } = formatPermissionErrorMessage(error);
        expect(title).toBeDefined();
        expect(title.length).toBeGreaterThan(0);
        expect(description).toBeDefined();
        expect(description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Role Transition Scenarios', () => {
    it('shows different errors for viewer -> editor -> admin progression', () => {
      // Viewer trying admin operation
      const viewerError = mockApiError('INSUFFICIENT_PERMISSIONS', 'admin', 'viewer');
      const viewerMsg = formatPermissionErrorMessage(viewerError);
      expect(viewerMsg.description).toContain('Viewer');
      expect(viewerMsg.description).toContain('Admin');

      // Editor trying admin operation (same error essentially)
      const editorError = mockApiError('INSUFFICIENT_PERMISSIONS', 'admin', 'editor');
      const editorMsg = formatPermissionErrorMessage(editorError);
      expect(editorMsg.description).toContain('Editor');
      expect(editorMsg.description).toContain('Admin');
    });
  });

  describe('Backwards Compatibility', () => {
    it('should handle errors without code field gracefully', () => {
      const error = new ApiError(403, 'Permission denied', {
        error: 'You do not have permission',
        // No 'code' field
      });

      expect(isPermissionError(error)).toBe(true);
      expect(() => formatPermissionErrorMessage(error)).not.toThrow();
    });

    it('should handle errors without details object', () => {
      const error = new ApiError(403, 'Permission denied', {
        error: 'Permission denied',
        // No 'details' object
      });

      expect(isPermissionError(error)).toBe(true);
      const msg = formatPermissionErrorMessage(error);
      expect(msg.title).toBeDefined();
      expect(msg.description).toBeDefined();
    });
  });
});
