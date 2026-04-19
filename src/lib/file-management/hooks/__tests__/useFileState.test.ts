/**
 * useFileState.test.ts
 *
 * Tests for file/project navigation state management
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useFileState } from './useFileState';

// Mock hooks
vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/cookies', () => ({
  getUserPreferences: vi.fn(() => ({ lastProjectId: null, lastFileId: null })),
  updateUserPreferences: vi.fn(),
  addRecentFile: vi.fn(),
  getRecentFiles: vi.fn(() => []),
}));

vi.mock('@/lib/file-management/hooks/useFiles', () => ({
  useFilesList: vi.fn(),
  useProjects: vi.fn(),
}));

vi.mock('@/lib/file-management/hooks/useGuestFiles', () => ({
  useGuestFilesList: vi.fn(),
}));

const mockUseAuth = require('@/components/auth/AuthProvider').useAuth;
const mockUseProjects = require('@/lib/file-management/hooks/useFiles').useProjects;
const mockUseFilesList = require('@/lib/file-management/hooks/useFiles').useFilesList;

describe('useFileState', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: 'user1', email: 'test@example.com' },
    });

    mockUseProjects.mockReturnValue({
      data: [
        { id: 'proj1', name: 'Project 1', owner_id: 'user1' },
        { id: 'proj2', name: 'Project 2', owner_id: 'user1' },
      ],
      isLoading: false,
    });

    mockUseFilesList.mockReturnValue({
      data: [
        { id: 'file1', title: 'File 1', project_id: 'proj1', is_folder: false, parent_id: null },
        { id: 'file2', title: 'File 2', project_id: 'proj1', is_folder: false, parent_id: null },
      ],
      isLoading: false,
    });
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useFileState());

    expect(result.current.isGuest).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.projects).toHaveLength(2);
    expect(result.current.files).toHaveLength(2);
  });

  it('computes current project', () => {
    const { result } = renderHook(() => useFileState());

    act(() => {
      result.current.setActiveProjectId('proj1');
    });

    expect(result.current.currentProject?.id).toBe('proj1');
    expect(result.current.currentProject?.name).toBe('Project 1');
  });

  it('computes current file', () => {
    const { result } = renderHook(() => useFileState());

    act(() => {
      result.current.setCurrentFileId('file1');
    });

    expect(result.current.currentFile?.id).toBe('file1');
    expect(result.current.currentFile?.title).toBe('File 1');
  });

  it('detects guest mode', () => {
    mockUseAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useFileState());

    expect(result.current.isGuest).toBe(true);
  });

  it('clears project ID in guest mode', () => {
    mockUseAuth.mockReturnValue({ user: null });
    const { result } = renderHook(() => useFileState());

    expect(result.current.activeProjectId).toBeNull();
  });

  it('auto-selects first project when available', () => {
    const { result } = renderHook(() => useFileState());

    expect(result.current.activeProjectId).toBe('proj1');
  });

  it('updates active project', () => {
    const { result } = renderHook(() => useFileState());

    act(() => {
      result.current.setActiveProjectId('proj2');
    });

    expect(result.current.activeProjectId).toBe('proj2');
  });

  it('updates current file', () => {
    const { result } = renderHook(() => useFileState());

    act(() => {
      result.current.setCurrentFileId('file2');
    });

    expect(result.current.currentFileId).toBe('file2');
  });

  it('resets hydration when project changes', () => {
    const { result } = renderHook(() => useFileState());

    expect(result.current.hydratedRef.current).toBe(false);

    act(() => {
      result.current.hydratedRef.current = true;
    });

    act(() => {
      result.current.setActiveProjectId('proj2');
    });

    expect(result.current.hydratedRef.current).toBe(false);
  });

  it('tracks online status', () => {
    const { result } = renderHook(() => useFileState());

    expect(result.current.isOnline).toBe(true);

    act(() => {
      result.current.setIsOnline(false);
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('returns hydration and tracking refs', () => {
    const { result } = renderHook(() => useFileState());

    expect(result.current.hydratedRef).toBeDefined();
    expect(result.current.lastActiveProjectIdRef).toBeDefined();
    expect(result.current.lastActiveRootIdRef).toBeDefined();
  });
});
