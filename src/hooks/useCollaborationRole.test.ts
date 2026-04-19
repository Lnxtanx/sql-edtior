/**
 * useCollaborationRole.test.ts
 * 
 * Unit tests for collaboration role utilities
 */

import { describe, it, expect } from 'vitest';
import {
  hasMinimumRole,
  canEdit,
  canAdmin,
  canOwn,
  isViewer,
  isEditor,
  getRoleLabel,
  getAllRoles,
  getRolesFromMinimum,
} from '../useCollaborationRole';

describe('useCollaborationRole', () => {
  describe('hasMinimumRole', () => {
    it('should return true for user with sufficient role', () => {
      expect(hasMinimumRole('editor', 'viewer')).toBe(true);
      expect(hasMinimumRole('admin', 'editor')).toBe(true);
      expect(hasMinimumRole('owner', 'admin')).toBe(true);
    });

    it('should return false for user with insufficient role', () => {
      expect(hasMinimumRole('viewer', 'editor')).toBe(false);
      expect(hasMinimumRole('editor', 'admin')).toBe(false);
      expect(hasMinimumRole('admin', 'owner')).toBe(false);
    });

    it('should return true for equal roles', () => {
      expect(hasMinimumRole('viewer', 'viewer')).toBe(true);
      expect(hasMinimumRole('editor', 'editor')).toBe(true);
      expect(hasMinimumRole('admin', 'admin')).toBe(true);
      expect(hasMinimumRole('owner', 'owner')).toBe(true);
    });

    it('should return false for null/undefined role', () => {
      expect(hasMinimumRole(null, 'viewer')).toBe(false);
      expect(hasMinimumRole(undefined, 'editor')).toBe(false);
    });
  });

  describe('canEdit', () => {
    it('should return true for editor and above', () => {
      expect(canEdit('editor')).toBe(true);
      expect(canEdit('admin')).toBe(true);
      expect(canEdit('owner')).toBe(true);
    });

    it('should return false for viewer', () => {
      expect(canEdit('viewer')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(canEdit(null)).toBe(false);
      expect(canEdit(undefined)).toBe(false);
    });
  });

  describe('canAdmin', () => {
    it('should return true for admin and above', () => {
      expect(canAdmin('admin')).toBe(true);
      expect(canAdmin('owner')).toBe(true);
    });

    it('should return false for viewer and editor', () => {
      expect(canAdmin('viewer')).toBe(false);
      expect(canAdmin('editor')).toBe(false);
    });
  });

  describe('canOwn', () => {
    it('should return true only for owner', () => {
      expect(canOwn('owner')).toBe(true);
    });

    it('should return false for all other roles', () => {
      expect(canOwn('viewer')).toBe(false);
      expect(canOwn('editor')).toBe(false);
      expect(canOwn('admin')).toBe(false);
    });
  });

  describe('isViewer', () => {
    it('should return true only for viewer role', () => {
      expect(isViewer('viewer')).toBe(true);
    });

    it('should return false for other roles', () => {
      expect(isViewer('editor')).toBe(false);
      expect(isViewer('admin')).toBe(false);
      expect(isViewer('owner')).toBe(false);
      expect(isViewer(null)).toBe(false);
    });
  });

  describe('isEditor', () => {
    it('should return true only for editor role', () => {
      expect(isEditor('editor')).toBe(true);
    });

    it('should return false for other roles', () => {
      expect(isEditor('viewer')).toBe(false);
      expect(isEditor('admin')).toBe(false);
      expect(isEditor('owner')).toBe(false);
    });
  });

  describe('getRoleLabel', () => {
    it('should return human-readable labels', () => {
      expect(getRoleLabel('viewer')).toBe('Viewer');
      expect(getRoleLabel('editor')).toBe('Editor');
      expect(getRoleLabel('admin')).toBe('Admin');
      expect(getRoleLabel('owner')).toBe('Owner');
    });
  });

  describe('getAllRoles', () => {
    it('should return all roles in order', () => {
      const roles = getAllRoles();
      expect(roles).toEqual(['viewer', 'editor', 'admin', 'owner']);
      expect(roles.length).toBe(4);
    });
  });

  describe('getRolesFromMinimum', () => {
    it('should return all roles >= minimum', () => {
      expect(getRolesFromMinimum('viewer')).toEqual(['viewer', 'editor', 'admin', 'owner']);
      expect(getRolesFromMinimum('editor')).toEqual(['editor', 'admin', 'owner']);
      expect(getRolesFromMinimum('admin')).toEqual(['admin', 'owner']);
      expect(getRolesFromMinimum('owner')).toEqual(['owner']);
    });
  });
});
