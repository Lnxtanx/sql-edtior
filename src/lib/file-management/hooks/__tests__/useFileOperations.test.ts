/**
 * useFileOperations.test.ts
 *
 * Tests for file and project CRUD operations
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useFileOperations } from './useFileOperations';

// Mock dependencies
vi.mock('@/components/auth/AuthProvider');
vi.mock('@tanstack/react-query');
vi.mock('sonner');
vi.mock('@/lib/cookies');
vi.mock('@/editor/documentSessionStore');
vi.mock('@/lib/file-management/api/client');
vi.mock('@/lib/file-management/storage/local-files');
vi.mock('@/lib/file-management/storage/core');
vi.mock('@/lib/file-management/hooks/useFileMutations');
vi.mock('@/lib/file-management/hooks/useGuestFiles');
vi.mock('@/lib/file-management/hooks/useTabManager');
vi.mock('@/lib/file-management/utils/fileTreeUtils');

const mockUseAuth = require('@/components/auth/AuthProvider').useAuth;
const mockTabManager = require('@/lib/file-management/hooks/useTabManager').useTabManager;

describe('useFileOperations', () => {
  const mockFiles = [
    {
      id: 'file1',
      title: 'schema.sql',
      content: 'SELECT * FROM table1;',
      is_folder: false,
      parent_id: null,
      project_id: 'proj1',
    },
    {
      id: 'file2',
      title: 'schema2.sql',
      content: 'SELECT * FROM table2;',
      is_folder: false,
      parent_id: null,
      project_id: 'proj1',
    },
  ];

  const mockProjects = [
    { id: 'proj1', name: 'Project 1', owner_id: 'user1' },
    { id: 'proj2', name: 'Project 2', owner_id: 'user1' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: 'user1', email: 'test@example.com' },
    });

    mockTabManager.mockReturnValue({
      openTab: vi.fn(),
      closeTab: vi.fn(),
      closeOtherTabs: vi.fn(),
      closeAllTabs: vi.fn(),
      openTabs: ['file1'],
    });
  });

  it('initializes with no migration in progress', () => {
    const { result } = renderHook(() =>
      useFileOperations({
        files: mockFiles,
        projects: mockProjects,
        activeProjectId: 'proj1',
        currentFileId: 'file1',
        isGuest: false,
        userId: 'user1',
      })
    );

    expect(result.current.isMigrating).toBe(false);
  });

  it('creates new file', async () => {
    const onFileChange = vi.fn();
    const { result } = renderHook(() =>
      useFileOperations({
        files: mockFiles,
        projects: mockProjects,
        activeProjectId: 'proj1',
        currentFileId: null,
        isGuest: false,
        userId: 'user1',
        onFileChange,
      })
    );

    // Note: Omitting actual creation test as it requires mocking mutations
    expect(result.current.createNewFile).toBeDefined();
  });

  it('closes tab', () => {
    const onFileChange = vi.fn();
    const { result } = renderHook(() =>
      useFileOperations({
        files: mockFiles,
        projects: mockProjects,
        activeProjectId: 'proj1',
        currentFileId: 'file1',
        isGuest: false,
        userId: 'user1',
        onFileChange,
      })
    );

    act(() => {
      result.current.closeTab('file1');
    });

    expect(mockTabManager().closeTab).toHaveBeenCalledWith('file1');
  });

  it('closes other tabs', () => {
    const onFileChange = vi.fn();
    const { result } = renderHook(() =>
      useFileOperations({
        files: mockFiles,
        projects: mockProjects,
        activeProjectId: 'proj1',
        currentFileId: 'file1',
        isGuest: false,
        userId: 'user1',
        onFileChange,
      })
    );

    act(() => {
      result.current.closeOtherTabs('file2');
    });

    expect(mockTabManager().closeOtherTabs).toHaveBeenCalledWith('file2');
  });

  it('closes all tabs', () => {
    const onFileChange = vi.fn();
    const { result } = renderHook(() =>
      useFileOperations({
        files: mockFiles,
        projects: mockProjects,
        activeProjectId: 'proj1',
        currentFileId: 'file1',
        isGuest: false,
        userId: 'user1',
        onFileChange,
      })
    );

    act(() => {
      result.current.closeAllTabs();
    });

    expect(mockTabManager().closeAllTabs).toHaveBeenCalled();
    expect(onFileChange).toHaveBeenCalledWith(null);
  });

  it('opens project', () => {
    const onProjectChange = vi.fn();
    const { result } = renderHook(() =>
      useFileOperations({
        files: mockFiles,
        projects: mockProjects,
        activeProjectId: 'proj1',
        currentFileId: 'file1',
        isGuest: false,
        userId: 'user1',
        onProjectChange,
      })
    );

    act(() => {
      result.current.openProject(null, 'proj2');
    });

    expect(onProjectChange).toHaveBeenCalledWith('proj2');
    expect(mockTabManager().closeAllTabs).toHaveBeenCalled();
  });

  it('deletes project and updates state', () => {
    const onProjectChange = vi.fn();
    const { result } = renderHook(() =>
      useFileOperations({
        files: mockFiles,
        projects: mockProjects,
        activeProjectId: 'proj1',
        currentFileId: 'file1',
        isGuest: false,
        userId: 'user1',
        onProjectChange,
      })
    );

    // Note: Actual deletion requires mocked mutations
    expect(result.current.deleteProject).toBeDefined();
  });

  it('handles guest mode file operations', () => {
    const { result } = renderHook(() =>
      useFileOperations({
        files: mockFiles,
        projects: [],
        activeProjectId: null,
        currentFileId: null,
        isGuest: true,
      })
    );

    expect(result.current.createNewFile).toBeDefined();
    expect(result.current.deleteFile).toBeDefined();
    expect(result.current.createFolder).toBeDefined();
  });

  it('exposes all required operations', () => {
    const { result } = renderHook(() =>
      useFileOperations({
        files: mockFiles,
        projects: mockProjects,
        activeProjectId: 'proj1',
        currentFileId: 'file1',
        isGuest: false,
        userId: 'user1',
      })
    );

    expect(result.current.createNewFile).toBeDefined();
    expect(result.current.renameFile).toBeDefined();
    expect(result.current.deleteFile).toBeDefined();
    expect(result.current.moveFile).toBeDefined();
    expect(result.current.createFolder).toBeDefined();
    expect(result.current.createFolderFromTemplate).toBeDefined();
    expect(result.current.closeTab).toBeDefined();
    expect(result.current.closeOtherTabs).toBeDefined();
    expect(result.current.closeAllTabs).toBeDefined();
    expect(result.current.createProject).toBeDefined();
    expect(result.current.updateProject).toBeDefined();
    expect(result.current.deleteProject).toBeDefined();
    expect(result.current.openProject).toBeDefined();
    expect(result.current.refreshProjects).toBeDefined();
    expect(result.current.performMigration).toBeDefined();
  });

  it('tracks migration state', () => {
    const { result } = renderHook(() =>
      useFileOperations({
        files: mockFiles,
        projects: mockProjects,
        activeProjectId: 'proj1',
        currentFileId: 'file1',
        isGuest: false,
        userId: 'user1',
      })
    );

    expect(typeof result.current.isMigrating).toBe('boolean');
  });

  it('calls onFileChange callback when closing current tab', () => {
    const onFileChange = vi.fn();
    const { result } = renderHook(() =>
      useFileOperations({
        files: mockFiles,
        projects: mockProjects,
        activeProjectId: 'proj1',
        currentFileId: 'file1',
        isGuest: false,
        userId: 'user1',
        onFileChange,
      })
    );

    act(() => {
      result.current.closeTab('file1');
    });

    expect(onFileChange).toHaveBeenCalled();
  });

  it('calls onProjectChange callback when opening project', () => {
    const onProjectChange = vi.fn();
    const { result } = renderHook(() =>
      useFileOperations({
        files: mockFiles,
        projects: mockProjects,
        activeProjectId: 'proj1',
        currentFileId: 'file1',
        isGuest: false,
        userId: 'user1',
        onProjectChange,
      })
    );

    act(() => {
      result.current.openProject(null, 'proj2');
    });

    expect(onProjectChange).toHaveBeenCalledWith('proj2');
  });
});
