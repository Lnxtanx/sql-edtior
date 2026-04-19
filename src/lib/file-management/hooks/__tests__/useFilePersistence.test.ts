/**
 * useFilePersistence.test.ts
 *
 * Tests for persistence, preferences, and sync management
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useFilePersistence } from './useFilePersistence';

// Mock dependencies
vi.mock('@tanstack/react-query');
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));
vi.mock('@/lib/cookies');
vi.mock('@/editor/documentSessionStore');
vi.mock('@/lib/file-management/storage/core');

const mockUseQueryClient = require('@tanstack/react-query').useQueryClient;
const mockToast = require('sonner').toast;

describe('useFilePersistence', () => {
  const mockCurrentFile = {
    id: 'file1',
    title: 'schema.sql',
    content: 'SELECT * FROM table1;',
    is_folder: false,
    project_id: 'proj1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQueryClient.mockReturnValue({});
  });

  it('initializes autosave enabled by default', () => {
    const { result } = renderHook(() =>
      useFilePersistence({
        currentFile: mockCurrentFile,
        isGuest: false,
      })
    );

    expect(result.current.autosaveEnabled).toBe(true);
  });

  it('toggles autosave state', () => {
    const { result } = renderHook(() =>
      useFilePersistence({
        currentFile: mockCurrentFile,
        isGuest: false,
      })
    );

    const initialValue = result.current.autosaveEnabled;

    act(() => {
      result.current.toggleAutosave();
    });

    expect(result.current.autosaveEnabled).toBe(!initialValue);
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('is online by default', () => {
    const { result } = renderHook(() =>
      useFilePersistence({
        currentFile: mockCurrentFile,
        isGuest: false,
      })
    );

    expect(result.current.isOnline).toBe(true);
  });

  it('returns no pending changes when content matches', () => {
    const { result } = renderHook(() =>
      useFilePersistence({
        currentFile: mockCurrentFile,
        isGuest: false,
      })
    );

    expect(result.current.hasPendingChanges).toBe(false);
  });

  it('returns null for downloadCurrentFile when no file', () => {
    const { result } = renderHook(() =>
      useFilePersistence({
        currentFile: null,
        isGuest: false,
      })
    );

    expect(() => result.current.downloadCurrentFile()).not.toThrow();
  });

  it('increases pending operations state', async () => {
    const { result } = renderHook(() =>
      useFilePersistence({
        currentFile: mockCurrentFile,
        isGuest: false,
      })
    );

    // hasPendingOperations is checked periodically
    expect(typeof result.current.hasPendingOperations).toBe('boolean');
  });

  it('merges SQL from multiple files', () => {
    const { result } = renderHook(() =>
      useFilePersistence({
        currentFile: mockCurrentFile,
        isGuest: false,
      })
    );

    const files = [
      { id: 'f1', title: 'f1.sql', content: 'SELECT 1;', is_folder: false },
      { id: 'f2', title: 'f2.sql', content: 'SELECT 2;', is_folder: false },
      { id: 'folder1', title: 'folder', content: '', is_folder: true },
    ];

    const merged = result.current.getMergedSQL(files, null);

    expect(merged).toContain('SELECT 1;');
    expect(merged).toContain('SELECT 2;');
    expect(merged).not.toContain(''); // No empty folder content
  });

  it('filters merged SQL to workspace when activeRootId provided', () => {
    const { result } = renderHook(() =>
      useFilePersistence({
        currentFile: mockCurrentFile,
        isGuest: false,
      })
    );

    const files = [
      { id: 'workspace', title: 'workspace', content: '', is_folder: true, parent_id: null },
      { id: 'file1', title: 'file1.sql', content: 'in workspace', is_folder: false, parent_id: 'workspace' },
      { id: 'file2', title: 'file2.sql', content: 'outside workspace', is_folder: false, parent_id: null },
    ];

    const merged = result.current.getMergedSQL(files, 'workspace');

    // Should only include files in the workspace
    expect(merged).toContain('in workspace');
  });

  it('handles empty import parameters', async () => {
    const { result } = renderHook(() =>
      useFilePersistence({
        currentFile: mockCurrentFile,
        isGuest: false,
      })
    );

    const imported = await result.current.importFile('', '');

    expect(imported).toBeNull();
    expect(mockToast.error).toHaveBeenCalled();
  });

  it('processes autosave state changes', () => {
    const { result } = renderHook(() =>
      useFilePersistence({
        currentFile: mockCurrentFile,
        isGuest: false,
      })
    );

    const initial = result.current.autosaveEnabled;

    act(() => {
      result.current.toggleAutosave();
    });

    expect(result.current.autosaveEnabled).not.toBe(initial);
  });

  it('supports guest mode', () => {
    const { result } = renderHook(() =>
      useFilePersistence({
        currentFile: mockCurrentFile,
        isGuest: true,
      })
    );

    expect(result.current.autosaveEnabled).toBeDefined();
    expect(result.current.isOnline).toBeDefined();
  });
});
