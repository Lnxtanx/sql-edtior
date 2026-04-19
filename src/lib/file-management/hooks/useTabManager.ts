// =============================================================================
// Tab Manager Hook
// Manages open tabs state with localStorage persistence
// =============================================================================

import { useState, useCallback, useEffect, useMemo } from 'react';

// =============================================================================
// Types
// =============================================================================

interface TabManagerState {
    openTabs: string[];    // ordered list of file IDs
    activeTabId: string | null;
    previewTabId: string | null;  // The "preview" tab (italic, replaced on next single-click)
}

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'sw_open_tabs';

// =============================================================================
// Persistence
// =============================================================================

function loadTabState(): TabManagerState {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            const parsed = JSON.parse(data) as TabManagerState;
            if (Array.isArray(parsed.openTabs)) {
                return { ...parsed, previewTabId: parsed.previewTabId || null };
            }
        }
    } catch {
        // Ignore parse errors
    }
    return { openTabs: [], activeTabId: null, previewTabId: null };
}

function saveTabState(state: TabManagerState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // localStorage might be full
    }
}

// =============================================================================
// Hook
// =============================================================================

export function useTabManager() {
    const [state, setState] = useState<TabManagerState>(loadTabState);

    // Persist on change
    useEffect(() => {
        saveTabState(state);
    }, [state]);

    const openTab = useCallback((fileId: string) => {
        setState(prev => {
            const alreadyOpen = prev.openTabs.includes(fileId);
            return {
                openTabs: alreadyOpen ? prev.openTabs : [...prev.openTabs, fileId],
                activeTabId: fileId,
                previewTabId: prev.previewTabId,
            };
        });
    }, []);

    /** Open a file as a preview tab (italic). If a prev preview tab exists, replace it. */
    const openPreviewTab = useCallback((fileId: string) => {
        setState(prev => {
            const alreadyOpen = prev.openTabs.includes(fileId);
            if (alreadyOpen) {
                // Already open (possibly as pinned) — just switch
                return { ...prev, activeTabId: fileId };
            }

            let newTabs = [...prev.openTabs];
            // Replace previous preview tab if it exists
            if (prev.previewTabId && prev.previewTabId !== fileId) {
                newTabs = newTabs.filter(id => id !== prev.previewTabId);
            }
            newTabs.push(fileId);

            return {
                openTabs: newTabs,
                activeTabId: fileId,
                previewTabId: fileId,
            };
        });
    }, []);

    /** Pin a preview tab (convert from preview to permanent). */
    const pinTab = useCallback((fileId: string) => {
        setState(prev => {
            if (prev.previewTabId !== fileId) return prev;
            return { ...prev, previewTabId: null };
        });
    }, []);

    const closeTab = useCallback((fileId: string) => {
        setState(prev => {
            const newTabs = prev.openTabs.filter(id => id !== fileId);
            let newActive = prev.activeTabId;
            let newPreview = prev.previewTabId === fileId ? null : prev.previewTabId;

            // If closing the active tab, switch to adjacent
            if (prev.activeTabId === fileId) {
                const closedIndex = prev.openTabs.indexOf(fileId);
                if (newTabs.length === 0) {
                    newActive = null;
                } else if (closedIndex >= newTabs.length) {
                    newActive = newTabs[newTabs.length - 1];
                } else {
                    newActive = newTabs[closedIndex];
                }
            }

            return { openTabs: newTabs, activeTabId: newActive, previewTabId: newPreview };
        });
    }, []);

    const switchTab = useCallback((fileId: string) => {
        setState(prev => {
            if (!prev.openTabs.includes(fileId)) return prev;
            return { ...prev, activeTabId: fileId };
        });
    }, []);

    const closeOtherTabs = useCallback((keepId: string) => {
        setState(prev => ({
            openTabs: prev.openTabs.filter(id => id === keepId),
            activeTabId: keepId,
            previewTabId: prev.previewTabId === keepId ? prev.previewTabId : null,
        }));
    }, []);

    const closeAllTabs = useCallback(() => {
        setState({ openTabs: [], activeTabId: null, previewTabId: null });
    }, []);

    const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
        setState(prev => {
            const newTabs = [...prev.openTabs];
            const [moved] = newTabs.splice(fromIndex, 1);
            newTabs.splice(toIndex, 0, moved);
            return { ...prev, openTabs: newTabs };
        });
    }, []);

    const isTabOpen = useCallback((fileId: string) => {
        return state.openTabs.includes(fileId);
    }, [state.openTabs]);

    return useMemo(() => ({
        openTabs: state.openTabs,
        activeTabId: state.activeTabId,
        previewTabId: state.previewTabId,
        openTab,
        openPreviewTab,
        pinTab,
        closeTab,
        switchTab,
        closeOtherTabs,
        closeAllTabs,
        reorderTabs,
        isTabOpen,
    }), [
        state.openTabs,
        state.activeTabId,
        state.previewTabId,
        openTab,
        openPreviewTab,
        pinTab,
        closeTab,
        switchTab,
        closeOtherTabs,
        closeAllTabs,
        reorderTabs,
        isTabOpen,
    ]);
}
