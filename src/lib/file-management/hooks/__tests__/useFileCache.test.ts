/**
 * useFileCache.test.ts
 *
 * Tests for file caching and selection orchestration
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useFileCache } from './useFileCache';

// Mock dependencies
vi.mock('@tanstack/react-query');
vi.mock('@/lib/file-management/hooks/useTabManager');
vi.mock('@/lib/file-management/hooks/useFileMutations');
vi.mock('@/lib/cookies');
vi.mock('@/editor/documentSessionStore');
vi.mock('@/lib/file-management/api/client');
vi.mock('@/lib/file-management/storage/core');
vi.mock('@/lib/file-management/utils/fileTreeUtils');

const mockGetFile = require('@/lib/file-management/api/client').getFile;
const mockTabManager = require('@/lib/file-management/hooks/useTabManager').useTabManager;
const mockUpdateFile = require('@/lib/file-management/hooks/useFileMutations').useUpdateFile;

describe('useFileCache', () => {
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
      id: 'folder1',
      title: 'Folder',
      content: '',
      is_folder: true,
      parent_id: null,
      project_id: 'proj1',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockTabManager.mockReturnValue({
      openTab: vi.fn(),
      openPreviewTab: vi.fn(),
      closeTab: vi.fn(),
      openTabs: ['file1'],
    });

    mockUpdateFile.mockReturnValue({
      mutate: vi.fn(),
    });
  });

  it('returns current file from files list', () => {
    const { result } = renderHook(() =>
      useFileCache({
        files: mockFiles,
        currentFileId: 'file1',
        activeProjectId: 'proj1',
        isGuest: false,
      })
    );

    expect(result.current.currentFile?.id).toBe('file1');
    expect(result.current.currentFile?.title).toBe('schema.sql');
  });

  it('returns null for non-existent file', () => {
    const { result } = renderHook(() =>
      useFileCache({
        files: mockFiles,
        currentFileId: 'nonexistent',
        activeProjectId: 'proj1',
        isGuest: false,
      })
    );

    expect(result.current.currentFile).toBeNull();
  });

  it('resolves file from API when not in list', async () => {
    const remoteFile = { ...mockFiles[0], content: 'FETCHED_CONTENT' };
    mockGetFile.mockResolvedValue({ file: remoteFile });

    const { result } = renderHook(() =>
      useFileCache({
        files: mockFiles.slice(0, 0),
        currentFileId: 'file1',
        activeProjectId: 'proj1',
        isGuest: false,
      })
    );

    const resolved = await result.current.resolveFile('file1');

    expect(resolved?.content).toBe('FETCHED_CONTENT');
  });

  it('returns folder without content resolution', async () => {
    const { result } = renderHook(() =>
      useFileCache({
        files: mockFiles,
        currentFileId: 'folder1',
        activeProjectId: 'proj1',
        isGuest: false,
      })
    );

    const resolved = await result.current.resolveFile('folder1');

    expect(resolved?.is_folder).toBe(true);
    expect(mockGetFile).not.toHaveBeenCalled();
  });

  it('calls selectFile callback on project change', async () => {
    const onProjectChange = vi.fn();
    const { result } = renderHook(() =>
      useFileCache({
        files: mockFiles,
        currentFileId: null,
        activeProjectId: null,
        isGuest: false,
        onProjectChange,
      })
    );

    await result.current.selectFile('file1');

    expect(onProjectChange).toHaveBeenCalledWith('proj1');
  });

  it('opens preview tab when preview flag is true', async () => {
    const { result } = renderHook(() =>
      useFileCache({
        files: mockFiles,
        currentFileId: null,
        activeProjectId: 'proj1',
        isGuest: false,
      })
    );

    await result.current.previewFile('file1');

    expect(mockTabManager().openPreviewTab).toHaveBeenCalledWith('file1');
  });

  it('opens regular tab when preview flag is false', async () => {
    const { result } = renderHook(() =>
      useFileCache({
        files: mockFiles,
        currentFileId: null,
        activeProjectId: 'proj1',
        isGuest: false,
      })
    );

    await result.current.switchToFile('file1');

    expect(mockTabManager().openTab).toHaveBeenCalledWith('file1');
  });

  it('returns null for folders on selection', async () => {
    const { result } = renderHook(() =>
      useFileCache({
        files: mockFiles,
        currentFileId: null,
        activeProjectId: 'proj1',
        isGuest: false,
      })
    );

    const selected = await result.current.selectFile('folder1');

    expect(selected).toBeNull();
  });

  it('increments resolved file version on cache', async () => {
    mockGetFile.mockResolvedValue({ file: mockFiles[0] });

    const { result } = renderHook(() =>
      useFileCache({
        files: [],
        currentFileId: null,
        activeProjectId: 'proj1',
        isGuest: false,
      })
    );

    expect(result.current.resolvedFileVersion).toBe(0);

    await result.current.resolveFile('file1');

    expect(result.current.resolvedFileVersion).toBeGreaterThan(0);
  });

  it('handles guest mode correctly', async () => {
    const { result } = renderHook(() =>
      useFileCache({
        files: mockFiles,
        currentFileId: null,
        activeProjectId: null,
        isGuest: true,
      })
    );

    const resolved = await result.current.resolveFile('file1');

    expect(resolved?.id).toBe('file1');
  });

  it('returns null for missing files in guest mode', async () => {
    const { result } = renderHook(() =>
      useFileCache({
        files: [],
        currentFileId: null,
        activeProjectId: null,
        isGuest: true,
      })
    );

    const resolved = await result.current.resolveFile('file1');

    expect(resolved).toBeNull();
  });
});
