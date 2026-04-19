import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { LayoutDirection } from '../layout/useLayoutEngine';

// Phase 5.7: Node-type visibility flags moved from subgraphConfig prop into context
// so that toggling a node type doesn't trigger a parent re-render.
export interface NodeTypeVisibility {
    showViews: boolean;
    showMaterializedViews: boolean;
    showFunctions: boolean;
    showEnums: boolean;
    showDomains: boolean;
    showRoles: boolean;
    showSequences: boolean;
    showExtensions: boolean;
    showPolicies: boolean;
}

const DEFAULT_NODE_TYPE_VISIBILITY: NodeTypeVisibility = {
    showViews: true,
    showMaterializedViews: true,
    showFunctions: true,
    showEnums: true,
    showDomains: true,
    showRoles: true,
    showSequences: true,
    showExtensions: true,
    showPolicies: true,
};

interface DiagramState {
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    layoutDirection: LayoutDirection;
    setLayoutDirection: (d: LayoutDirection) => void;
    viewMode: 'ALL' | 'KEYS' | 'TITLE';
    setViewMode: (v: 'ALL' | 'KEYS' | 'TITLE') => void;
    groupBySchema: boolean;
    setGroupBySchema: React.Dispatch<React.SetStateAction<boolean>>;
    lockGroups: boolean;
    setLockGroups: React.Dispatch<React.SetStateAction<boolean>>;
    isFullscreen: boolean;
    setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
    isGlowing: boolean;
    setIsGlowing: React.Dispatch<React.SetStateAction<boolean>>;
    showTerminal: boolean;
    setShowTerminal: React.Dispatch<React.SetStateAction<boolean>>;
    showGraphSettings: boolean;
    setShowGraphSettings: React.Dispatch<React.SetStateAction<boolean>>;
    graphSettingsTab: 'settings' | 'impact';
    setGraphSettingsTab: (t: 'settings' | 'impact') => void;
    // Phase 4.1: Schema group visibility
    hiddenSchemas: Set<string>;
    toggleHiddenSchema: (schema: string) => void;
    clearHiddenSchemas: () => void;
    // Phase 5.7: Node-type visibility
    nodeTypeVisibility: NodeTypeVisibility;
    setNodeTypeVisibility: (patch: Partial<NodeTypeVisibility>) => void;
    resetNodeTypeVisibility: () => void;
}

const DiagramContext = createContext<DiagramState | undefined>(undefined);

export function DiagramProvider({ children }: { children: ReactNode }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>('LR');
    const [viewMode, setViewMode] = useState<'ALL' | 'KEYS' | 'TITLE'>('ALL');
    const [groupBySchema, setGroupBySchema] = useState(false);
    const [lockGroups, setLockGroups] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isGlowing, setIsGlowing] = useState(false);
    const [showTerminal, setShowTerminal] = useState(false);
    const [showGraphSettings, setShowGraphSettings] = useState(false);
    const [graphSettingsTab, setGraphSettingsTab] = useState<'settings' | 'impact'>('settings');
    const [hiddenSchemas, setHiddenSchemas] = useState<Set<string>>(new Set());
    const [nodeTypeVisibility, setNodeTypeVisibilityState] = useState<NodeTypeVisibility>(DEFAULT_NODE_TYPE_VISIBILITY);

    const toggleHiddenSchema = useCallback((schema: string) => {
        setHiddenSchemas(prev => {
            const next = new Set(prev);
            if (next.has(schema)) {
                next.delete(schema);
            } else {
                next.add(schema);
            }
            return next;
        });
    }, []);

    const clearHiddenSchemas = useCallback(() => {
        setHiddenSchemas(new Set());
    }, []);

    const setNodeTypeVisibility = useCallback((patch: Partial<NodeTypeVisibility>) => {
        setNodeTypeVisibilityState(prev => ({ ...prev, ...patch }));
    }, []);

    const resetNodeTypeVisibility = useCallback(() => {
        setNodeTypeVisibilityState(DEFAULT_NODE_TYPE_VISIBILITY);
    }, []);

    return (
        <DiagramContext.Provider
            value={{
                searchQuery, setSearchQuery,
                layoutDirection, setLayoutDirection,
                viewMode, setViewMode,
                groupBySchema, setGroupBySchema,
                lockGroups, setLockGroups,
                isFullscreen, setIsFullscreen,
                isGlowing, setIsGlowing,
                showTerminal, setShowTerminal,
                showGraphSettings, setShowGraphSettings,
                graphSettingsTab, setGraphSettingsTab,
                hiddenSchemas, toggleHiddenSchema, clearHiddenSchemas,
                nodeTypeVisibility, setNodeTypeVisibility, resetNodeTypeVisibility,
            }}
        >
            {children}
        </DiagramContext.Provider>
    );
}

export function useDiagramState() {
    const context = useContext(DiagramContext);
    if (context === undefined) {
        throw new Error('useDiagramState must be used within a DiagramProvider');
    }
    return context;
}
