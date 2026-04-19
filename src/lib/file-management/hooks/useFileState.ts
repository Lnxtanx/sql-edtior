/**
 * useFileState.ts
 *
 * State management for file/project navigation
 * Handles: activeProjectId, currentFileId, activeRootId, derived computations
 * Responsibilities:
 * - Track current active project and file
 * - Compute derived values (currentFile, currentProject)
 * - Manage file/project queries
 * - Auto-select first project when available
 * - Handle guest mode state setup
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { getUserPreferences, updateUserPreferences } from '@/lib/cookies';
import { useFilesList, useProjects } from '@/lib/file-management/hooks/useFiles';
import type { SqlFile, Project } from '@/lib/file-management/api/client';

interface UseFileStateReturn {
  // State
  activeProjectId: string | null;
  currentFileId: string | null;
  activeRootId: string | null;
  isOnline: boolean;
  isLoading: boolean;
  isGuest: boolean;

  // Data
  projects: Project[];
  files: SqlFile[];
  currentProject: Project | null;
  currentFile: SqlFile | null;

  // Setters
  setActiveProjectId: (id: string | null) => void;
  setCurrentFileId: (id: string | null) => void;
  setActiveRootId: (id: string | null) => void;
  setIsOnline: (online: boolean) => void;

  // Refs for internal coordination
  hydratedRef: React.MutableRefObject<boolean>;
  lastActiveProjectIdRef: React.MutableRefObject<string | null>;
  lastActiveRootIdRef: React.MutableRefObject<string | null>;
}

export function useFileState(): UseFileStateReturn {
  const { user } = useAuth();
  const userId = user?.id;
  const isGuest = !user;

  // Core state
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => getUserPreferences()?.lastProjectId || null);
  const [currentFileId, setCurrentFileId] = useState<string | null>(() => getUserPreferences()?.lastFileId || null);
  const [activeRootId, setActiveRootId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Refs for hydration control and tracking
  const hydratedRef = useRef(false);
  const lastActiveProjectIdRef = useRef<string | null>(activeProjectId);
  const lastActiveRootIdRef = useRef<string | null>(activeRootId);

  // Detect when project/root changes and reset hydration
  useEffect(() => {
    if (lastActiveProjectIdRef.current !== activeProjectId || lastActiveRootIdRef.current !== activeRootId) {
      hydratedRef.current = false;
      lastActiveProjectIdRef.current = activeProjectId;
      lastActiveRootIdRef.current = activeRootId;
    }
  }, [activeProjectId, activeRootId]);

  // Auto-clear project ID for guests
  useEffect(() => {
    if (isGuest) {
      setActiveProjectId(null);
      return;
    }

    // Auto-select last preferred project if not set
    if (!activeProjectId) {
      const preferredProjectId = getUserPreferences()?.lastProjectId || null;
      if (preferredProjectId) {
        setActiveProjectId(preferredProjectId);
      }
    }
  }, [isGuest, activeProjectId]);

  // Queries
  const projectsQuery = useProjects(userId);
  const authQuery = useFilesList(userId, activeProjectId);
  const guestQuery = useGuestFilesList?.();

  // Data from queries
  const projects: Project[] = projectsQuery.data ?? [];
  const files: SqlFile[] = isGuest ? (guestQuery?.data ?? []) : (authQuery.data ?? []);

  // Computed: current project
  const currentProject = useMemo(
    () => projects.find(p => p.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  // Computed: current file (with fallback to resolved files from cache)
  const currentFile = useMemo(
    () => files.find(file => file.id === currentFileId) ?? null,
    [files, currentFileId]
  );

  // Loading state
  const isLoading = isGuest
    ? guestQuery?.isLoading ?? false
    : projectsQuery.isLoading || (!!activeProjectId && authQuery.isLoading);

  // Auto-select first project if authenticated and no project selected
  useEffect(() => {
    if (isLoading || isGuest || activeProjectId || projects.length === 0) return;

    const firstProjectId = projects[0].id;
    setActiveProjectId(firstProjectId);
    updateUserPreferences({ lastProjectId: firstProjectId });
  }, [isLoading, isGuest, activeProjectId, projects]);

  return {
    // State
    activeProjectId,
    currentFileId,
    activeRootId,
    isOnline,
    isLoading,
    isGuest,

    // Data
    projects,
    files,
    currentProject,
    currentFile,

    // Setters
    setActiveProjectId,
    setCurrentFileId,
    setActiveRootId,
    setIsOnline,

    // Refs
    hydratedRef,
    lastActiveProjectIdRef,
    lastActiveRootIdRef,
  };
}
