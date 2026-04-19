import { useEffect, useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSqlEditor } from './hooks/useSqlEditor';
import { ParsedSchema } from '@/lib/sql-parser';
import { SubgraphConfig } from '@/components/schema-workspace/SubgraphPanel';
import type { Project, SqlFile } from '@/lib/file-management';
import { analyzeSchema, SchemaAnalysis } from '@/lib/schema-utils/schema-analysis';
import { buildSchemaGraph, GraphStats } from '@/lib/schema-workspace';
import { editorBus } from '@/lib/editorBus';
import { canEdit } from '@/hooks/useCollaborationRole';
import { useCurrentFile } from '@/components/connection/CurrentFileContext';
import { queryKeys } from '@/lib/queryClient';
import { toast } from 'sonner';

// Layout Imports
import { SidebarLayout } from '@/components/layout/SidebarLayout';
import { SidebarView } from '@/components/layout/types';
import { useAIAgent } from '@/components/ai-panel/hooks/useAIAgent';
import { SqlEditorFooter, FooterPanel } from './SqlEditorFooter';
import { CreateFileDialog, CreateProjectDialog, DeleteConfirmDialog } from './file-tree';
import { renderView } from './ViewRenderer';
import { SqlEditorHeader } from './SqlEditorHeader';
import type { RecentFile } from '@/lib/cookies';
import { listConnections } from '@/lib/api/connection';
import { listTeams } from '@/lib/file-management';
import { useAIUsage } from '@/hooks/useAIUsage';

export interface SqlEditorProps {
    /** Callback when schema changes */
    onSchemaChange: (schema: ParsedSchema) => void;
    /** Callback when SQL changes */
    onSqlChange?: (sql: string) => void;
    /** External SQL content (controlled mode) */
    sql?: string;
    /** Current schema (optional, for display) */
    schema?: ParsedSchema | null;
    /** Whether sidebar is collapsed - DEPRECATED/IGNORED in new layout */
    isCollapsed?: boolean;
    /** Toggle collapse callback - DEPRECATED */
    onToggleCollapse?: () => void;
    /** Whether sidebar is fullscreen */
    isFullscreen?: boolean;
    /** Toggle fullscreen callback */
    onToggleFullscreen?: () => void;
    /** Apply SQL from AI */
    onApplySQL?: (sql: string) => void;
    /** Merged SQL from all project files (for Generate button) */
    mergedSql?: string;

    /** Files list */
    files?: SqlFile[];
    /** Current file */
    currentFile?: SqlFile | null;
    /** Whether saving */
    saving?: boolean;
    /** Last saved timestamp */
    lastSaved?: Date | null;
    /** Autosave enabled */
    autosaveEnabled?: boolean;
    /** Online status */
    isOnline?: boolean;
    /** Has pending operations */
    hasPendingOperations?: boolean;
    /** Switch file */
    onSwitchFile?: (fileId: string) => void;
    /** Preview file (single click in tree) */
    onPreviewFile?: (fileId: string) => void;
    /** Create new file (name provided by dialog) */
    onCreateFile?: (name: string, extension: string, parentId: string | null) => void;
    /** Rename file */
    onRenameFile?: (fileId: string, newTitle: string) => void;
    /** Delete file */
    onDeleteFile?: (fileId: string) => void;
    /** Toggle autosave */
    onToggleAutosave?: () => void;
    /** Manual save */
    onManualSave?: (content?: string) => void;
    /** Import file */
    onImportFile?: (content: string, fileName: string) => void;
    /** Subgraph Support */
    subgraphConfig?: SubgraphConfig;
    onSubgraphConfigChange?: (config: SubgraphConfig) => void;
    /** Graph statistics from the diagram */
    graphStats?: GraphStats | null;
    /** On Open Settings */
    onOpenSettings?: () => void;
    /** On Open Graph Settings (gear icon in SubgraphPanel) */
    onOpenGraphSettings?: () => void;
    /** Search query for highlighting table */
    searchQuery?: string;
    /** Open tabs (ordered file IDs) */
    openTabs?: string[];
    /** Currently active tab ID */
    activeTabId?: string | null;
    /** Close a tab */
    onCloseTab?: (fileId: string) => void;
    /** Close other tabs */
    onCloseOtherTabs?: (fileId: string) => void;
    /** Close all tabs */
    onCloseAllTabs?: () => void;
    /** Create a new folder */
    onCreateFolder?: (title?: string, parentId?: string | null) => void;
    /** Create a folder from template with sub-folders */
    onCreateFolderFromTemplate?: (title: string, parentId: string | null, subfolders: string[]) => void;
    /** Move a file/folder */
    onMoveFile?: (fileId: string, parentId: string | null, sortOrder?: number) => void;
    /** Preview tab ID */
    previewTabId?: string | null;
    /** Pin a preview tab */
    onPinTab?: (fileId: string) => void;
    /** Download a file */
    onDownloadFile?: (fileId?: string) => void;
    /** Double-click a file in tree (pin preview) */
    onFileDoubleClick?: (fileId: string) => void;
    /** Create file in a specific folder (opens dialog pre-set to folder) */
    onCreateFileInFolder?: (folderId: string) => void;
    /** Whether user is in guest mode */
    isGuest?: boolean;
    /** Whether more files can be created */
    canCreateFile?: boolean;
    /** The currently scoped workspace files */
    workspaceFiles?: SqlFile[];
    /** The active project folder ID */
    activeRootId?: string | null;
    /** Change the active project folder */
    onSetActiveRootId?: (id: string | null) => void;
    /** Change the active cloud project */
    onSetActiveProjectId?: (id: string | null) => void;
    /** Active cloud project */
    activeProjectId?: string | null;
    /** Open a project (sets root + opens first file) */
    onOpenProject?: (rootId: string | null, projectId?: string | null) => void;
    /** Create a new project */
    onCreateProject?: (params: { name: string; description?: string; connectionId?: string; teamId?: string }) => void;
    /** Delete a project */
    onDeleteProject?: (projectId: string) => void;
    /** Recent files to display on the dashboard */
    recentFiles?: RecentFile[];
    /** List of all projects from the API */
    apiProjects?: Project[];
    /** The active project object */
    currentProject?: Project | null;
    /** Whether files are currently loading (for skeleton) */
    isFilesLoading?: boolean;
}

export default function SqlEditor({
    onSchemaChange,
    onSqlChange,
    sql: externalSql,
    schema: externalSchema,
    isFullscreen = false,
    onToggleFullscreen,
    onApplySQL,
    mergedSql,
    files = [],
    workspaceFiles = [],
    recentFiles = [],
    currentFile,
    activeRootId = null,
    activeProjectId = null,
    currentProject = null,
    onSetActiveRootId,
    onSetActiveProjectId,
    onOpenProject,
    onCreateProject,
    onDeleteProject,
    saving,
    lastSaved,
    autosaveEnabled,
    isOnline,
    hasPendingOperations,
    onSwitchFile,
    onPreviewFile,
    onCreateFile,
    onRenameFile,
    onDeleteFile,
    onToggleAutosave,
    onManualSave,
    onImportFile,
    subgraphConfig,
    onSubgraphConfigChange,
    graphStats,
    onOpenSettings,
    onOpenGraphSettings,
    searchQuery,
    openTabs = [],
    activeTabId,
    onCloseTab,
    onCloseOtherTabs,
    onCloseAllTabs,
    onCreateFolder,
    onCreateFolderFromTemplate,
    onMoveFile,
    previewTabId,
    onPinTab,
    onDownloadFile,
    onFileDoubleClick,
    onCreateFileInFolder,
    isGuest,
    canCreateFile,
    apiProjects = [],
    isFilesLoading,
    children
}: SqlEditorProps & { children?: React.ReactNode }) {
    // ------------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------------
    const [activeView, setActiveView] = useState<SidebarView>('editor');
    const [secondaryView, setSecondaryView] = useState<SidebarView | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [showFileTree, setShowFileTree] = useState(true);
    const [footerPanel, setFooterPanel] = useState<FooterPanel>(null);
    // Pre-loaded diff result from editorBus (OPEN_DIFF event from DatabaseDashboardPanel)
    const [pendingDiff, setPendingDiff] = useState<import('@/components/sql-diff/SqlDiffPanel').DiffResult | null>(null);

    // Pending AI file changes — for VS Code-style accept/reject
    const [pendingAiFile, setPendingAiFile] = useState<{
        nodeId: string;
        fileName: string;
        originalContent: string;
        proposedContent: string;
        toolName: string;
    } | null>(null);
    const [showDashboard, setShowDashboard] = useState(false);

    // ─── Create File Dialog state (shared by FileTree + EditorTabBar) ──
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [createDialogIsFolder, setCreateDialogIsFolder] = useState(false);
    const [createDialogParentId, setCreateDialogParentId] = useState<string | null>(null);

    // ─── Create Project Dialog state ──
    const [createProjectDialogOpen, setCreateProjectDialogOpen] = useState(false);

    const { data: connections = [] } = useQuery({
        queryKey: ['connections', 'list', 'project-dialog'],
        queryFn: async () => {
            const result = await listConnections();
            return result.connections || [];
        },
        staleTime: 60_000,
        enabled: !isGuest,
    });
    const { data: teams = [] } = useQuery({
        queryKey: ['files', 'teams'],
        queryFn: async () => {
            const result = await listTeams();
            return result.teams || [];
        },
        staleTime: 2 * 60_000,
        enabled: !isGuest,
    });
    const { allowedModels } = useAIUsage();

    const handleOpenCreateDialog = useCallback((isFolder: boolean, parentId: string | null) => {
        setCreateDialogIsFolder(isFolder);
        setCreateDialogParentId(parentId);
        setCreateDialogOpen(true);
    }, []);

    const handleOpenCreateProjectDialog = useCallback(() => {
        setCreateProjectDialogOpen(true);
    }, []);

    const handleCreateFileRequest = useCallback(() => {
        handleOpenCreateDialog(false, null);
    }, [handleOpenCreateDialog]);

    // ─── Delete Confirm Dialog state (shared by FileTree + EditorTabBar + FilePicker) ──
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState<SqlFile | null>(null);

    const handleDeleteRequest = useCallback(
        (fileId: string) => {
            const file = files.find(f => f.id === fileId);
            if (file) {
                setFileToDelete(file);
                setDeleteDialogOpen(true);
            }
        },
        [files],
    );

    const handleDeleteConfirm = useCallback(
        (fileId: string) => {
            onDeleteFile?.(fileId);
        },
        [onDeleteFile],
    );

    const handleCreateConfirm = useCallback(
        (name: string, extension: string, parentId: string | null) => {
            if (createDialogIsFolder) {
                onCreateFolder?.(name, parentId);
            } else {
                const fullName = extension ? `${name}.${extension}` : name;
                onCreateFile?.(fullName, extension, parentId);
            }
        },
        [createDialogIsFolder, onCreateFile, onCreateFolder],
    );

    const handleCreateTemplateConfirm = useCallback(
        (name: string, parentId: string | null, subfolders: string[]) => {
            onCreateFolderFromTemplate?.(name, parentId, subfolders);
        },
        [onCreateFolderFromTemplate],
    );

    const handleCreateProjectConfirm = useCallback(
        (params: { name: string; description?: string; connectionId?: string; teamId?: string }) => {
            onCreateProject?.(params);
        },
        [onCreateProject],
    );


    // ------------------------------------------------------------------------
    // Hooks
    // ------------------------------------------------------------------------

    // Editor State
    const editor = useSqlEditor({
        sql: externalSql || '',
        mergedSql: mergedSql || '',
        setSql: (nextSql) => onSqlChange?.(nextSql),
        onSchemaChange,
    });

    // Current file context (provides connectionId)
    const currentFileContext = useCurrentFile();

    // Active Schema (prefer external)
    const activeSchema = externalSchema || editor.schema;

    // AI Analysis - with auto-open on file creation
    const handleAICreatedFile = useCallback(async (fileInfo: { fileName: string; fileId?: string; parent_id?: string }) => {
        // Wait briefly for file tree to refetch after invalidateQueries
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Find the newly created file by name or ID
        const newFile = files.find(f => 
            f.title === fileInfo.fileName || 
            (fileInfo.fileId && f.id === fileInfo.fileId)
        );
        
        if (newFile && !newFile.is_folder) {
            // Auto-open the file in the editor
            await onSwitchFile(newFile.id);
            toast.info(`Opened "${newFile.title}" created by AI`);
        }
    }, [files, onSwitchFile]);

    const queryClient = useQueryClient();

    const ai = useAIAgent({
        connectionId: currentFileContext?.connectionId,
        projectId: currentFileContext?.projectId,
        currentSQL: editor.sql,
        compilationResult: editor.compilation,
        schemaGraph: activeSchema ? (() => {
            const graph = buildSchemaGraph(activeSchema);
            // Convert Maps to arrays for serialization
            return {
                nodes: Array.from(graph.nodes.entries()).map(([id, node]) => ({
                    id,
                    type: node.type,
                    name: node.type === 'TABLE' ? (node as any).table?.name :
                          node.type === 'VIEW' ? (node as any).view?.name : id,
                    schema: node.type === 'TABLE' ? (node as any).table?.schema || 'public' :
                            node.type === 'VIEW' ? (node as any).view?.schema || 'public' : 'public',
                })),
                edges: graph.relationships.map(rel => ({
                    source: typeof rel.source === 'string' ? rel.source :
                            `${(rel.source as any).schema || 'public'}.${(rel.source as any).table}`,
                    target: typeof rel.target === 'string' ? rel.target :
                            `${(rel.target as any).schema || 'public'}.${(rel.target as any).table}`,
                    type: rel.type,
                    columns: rel.source && (rel.source as any).column ? {
                        source: [(rel.source as any).column],
                        target: [(rel.target as any).column],
                    } : {},
                })),
            };
        })() : null,
        onApplySQL,
        onFileCreated: handleAICreatedFile,
        onFileModified: (fileInfo) => {
            setPendingAiFile({
                nodeId: fileInfo.nodeId,
                fileName: fileInfo.fileName,
                originalContent: fileInfo.originalContent,
                proposedContent: fileInfo.proposedContent,
                toolName: fileInfo.toolName,
            });
        },
    });

    // Accept AI changes — keep the proposed content (already saved, just clear pending state)
    const handleAcceptAiChanges = useCallback(() => {
        setPendingAiFile(null);
        toast.success('Changes accepted');
    }, []);

    // Clear pending AI file changes when user switches to a different file
    useEffect(() => {
        if (pendingAiFile && pendingAiFile.nodeId !== activeTabId) {
            // User switched to a different file — clear the banner
            setPendingAiFile(null);
        }
    }, [activeTabId, pendingAiFile]);

    // Reject AI changes — revert to original content
    const handleRejectAiChanges = useCallback(async () => {
        if (!pendingAiFile) return;
        try {
            const { updateFile } = await import('@/lib/file-management/api/client');
            await updateFile(pendingAiFile.nodeId, { content: pendingAiFile.originalContent });
            // Reload the file in the editor if it's the active tab
            if (openTabs.includes(pendingAiFile.nodeId)) {
                editor.setSql(pendingAiFile.originalContent);
            }
            setPendingAiFile(null);
            // Invalidate file cache
            queryClient.invalidateQueries({ queryKey: queryKeys.files.all });
            toast.info('Changes rejected — file reverted');
        } catch (err) {
            console.error('Failed to revert AI changes:', err);
            toast.error('Failed to revert changes');
        }
    }, [pendingAiFile, openTabs, editor, queryClient]);


    // ── Subscribe to editor bus events (from floating panels like DatabaseDashboardPanel)
    useEffect(() => {
        const unsubscribe = editorBus.subscribe((event) => {
            if (event.type === 'SET_SQL') {
                // Pull → Editor: set SQL and switch to editor view so user sees it
                editor.setSql(event.sql);
                setActiveView('editor');
                setIsCollapsed(false);
                // Trigger manual save so the new content persists immediately
                onManualSave?.(event.sql);
            } else if (event.type === 'OPEN_DIFF') {
                // Diff → Panel: load diff result and switch to diff view
                setPendingDiff(event.diff);
                setActiveView('diff');
                setIsCollapsed(false);
            }
        });
        return () => { unsubscribe(); };
    }, []);

    // Analysis
    const analysis = useMemo<SchemaAnalysis | null>(() => {
        if (activeSchema && activeSchema.tables.length > 0) {
            buildSchemaGraph(activeSchema); // Ensure graph metadata
            return analyzeSchema(activeSchema);
        }
        return null;
    }, [activeSchema]);


    // ------------------------------------------------------------------------
    // Handlers
    // ------------------------------------------------------------------------

    const handleViewChange = (view: SidebarView) => {
        setActiveView(view);
        setIsCollapsed(false); // Always expand when switching views
    };

    const handleToggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    const handleToggleMaximize = () => {
        const nextMaximized = !isMaximized;
        setIsMaximized(nextMaximized);
        // When exiting fullscreen, close split view so user is never stuck
        // with two panes and no way to dismiss them
        if (!nextMaximized && secondaryView) {
            setSecondaryView(null);
        }
    };

    const handleSplitSelection = (view: SidebarView) => {
        if (view === activeView) return; // Prevent opening same view twice
        setSecondaryView(view);
    };

    const handleCloseSplit = () => {
        setSecondaryView(null);
    };

    const handleFooterPanelChange = (panel: FooterPanel) => {
        // Intercept navigation panels
        if (panel === 'connect') {
            handleViewChange('connect');
            setFooterPanel(null);
        } else if (panel === 'subgraph') {
            handleViewChange('graph');
            setFooterPanel(null);
        } else if (panel === 'compiler') {
            handleViewChange('compiler');
            setFooterPanel(null);
        } else if (panel === 'diff') {
            handleViewChange('diff');
            setFooterPanel(null);
        } else {
            setFooterPanel(panel);
        }
    };

    // ------------------------------------------------------------------------
    // UI Components (Hoisted Header/Footer)
    // ------------------------------------------------------------------------

    const getSubtitle = () => {
        switch (activeView) {
            case 'editor': return 'SQL Editor';
            case 'ai': return 'Resona AI';
            case 'connect': return 'Connections';
            case 'graph': return 'Schema Graph';
            case 'compiler': return 'Schema Compiler';
            case 'diff': return 'Schema Diff';
            default: return '';
        }
    };

    const isSplit = !!secondaryView;

    const handleOpenProject = useCallback((rootId: string | null, projectId?: string | null) => {
        onOpenProject?.(rootId, projectId);
        setShowDashboard(false);
    }, [onOpenProject]);

    const handleGoToDashboard = useCallback(() => {
        setShowDashboard(true);
        handleViewChange('editor');
    }, []);

    const handleFileClick = useCallback((id: string) => {
        // If it's a project ID from apiProjects, switch active project
        if (apiProjects.some(p => p.id === id)) {
            handleOpenProject(null, id);
            return;
        }
        // Otherwise handle file switching
        onSwitchFile?.(id);
        setShowDashboard(false);
    }, [apiProjects, handleOpenProject, onSwitchFile]);

    const panelHeader = (
        <SqlEditorHeader
            isCollapsed={isCollapsed}
            onToggleCollapse={handleToggleCollapse}
            files={files}
            openTabs={openTabs}
            activeTabId={activeTabId}
            onSwitchFile={onSwitchFile}
            onCloseTab={onCloseTab}
            onCloseOtherTabs={onCloseOtherTabs}
            onCloseAllTabs={onCloseAllTabs}
            onCreateFile={handleCreateFileRequest}
            onRenameFile={onRenameFile}
            onDeleteFile={handleDeleteRequest}
            saving={saving}
            previewTabId={previewTabId}
            onPinTab={onPinTab}
            onDownloadFile={onDownloadFile}
            isOnline={isOnline}
            hasPendingOperations={hasPendingOperations}
            lastSaved={lastSaved}
            currentProject={currentProject}
            activeView={activeView}
            isSplit={isSplit}
            onSplitSelection={handleSplitSelection}
            onCloseSplit={handleCloseSplit}
            isMaximized={isMaximized}
            onToggleMaximize={handleToggleMaximize}
            onGoToDashboard={handleGoToDashboard}
        />
    );


    const panelFooter = (
        <SqlEditorFooter
            expandedPanel={footerPanel}
            onPanelChange={handleFooterPanelChange}
            onOpenSettings={onOpenSettings}
            activeView={activeView}
            onViewChange={handleViewChange}
        />
    );

    // ------------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------------

    return (
        <>
            <SidebarLayout
                activeView={activeView}
                onViewChange={handleViewChange}
                isCollapsed={isCollapsed}
                secondaryView={secondaryView}
                panelHeader={panelHeader}
                panelFooter={panelFooter}
                panelFullScreen={isMaximized}
                onOpenSettings={onOpenSettings}
                onToggleCollapse={handleToggleCollapse}
                renderView={(view) => renderView({
                    view,
                    setActiveView,
                    editorViewProps: {
                        isMaximized,
                        showFileTree,
                        onToggleFileTree: setShowFileTree,
                        workspaceFiles,
                        isFilesLoading,
                        activeFileId: activeTabId,
                        onFileClick: handleFileClick,
                        onFileDoubleClick,
                        onCreateFile: () => handleOpenCreateDialog(false, null),
                        onCreateFolder: (_t, parentId) => handleOpenCreateDialog(true, parentId),
                        onRenameFile,
                        onDeleteFile: handleDeleteRequest,
                        onMoveFile,
                        onCreateFileInFolder: (parentId) => handleOpenCreateDialog(false, parentId),
                        onDownloadFile,
                        previewTabId,
                        isGuest,
                        canCreateFile,
                        onOpenCreateDialog: handleOpenCreateDialog,
                        openTabs,
                        onCloseTab,
                        onCloseAllTabs,
                        onCloseOtherTabs,
                        activeRootId,
                        activeProjectId,
                        apiProjects,
                        currentProject,
                        onCloseProject: () => {
                            onSetActiveRootId?.(null);
                            onSetActiveProjectId?.(null);
                        },
                        onGoToDashboard: handleGoToDashboard,
                        editorPanelProps: {
                            sql: editor.sql,
                            onSqlChange: editor.setSql,
                            isProcessing: editor.isProcessing,
                            isReadOnly: currentProject ? (!currentProject.is_owner && !canEdit(currentProject.role as any)) : false,
                            schema: activeSchema,
                            analysis,
                            compilation: editor.compilation,
                            formatResult: editor.formatResult,
                            onFormat: editor.handleFormat,
                            onGenerate: editor.handleGenerate,
                            onClear: editor.handleClear,
                            onCopy: editor.copyToClipboard,
                            onPaste: editor.handlePaste,
                            onKeyDown: editor.handleKeyDown,
                            onApplySQL,
                            activeFile: currentFile,
                            onOpenAI: () => setActiveView('ai'),
                            searchQuery,
                            hasOpenTabs: showDashboard ? false : openTabs.length > 0,
                            onCreateFileClick: () => handleOpenCreateDialog(false, activeRootId),
                            // Dashboard props
                            files,
                            recentFiles,
                            activeRootId,
                            activeProjectId,
                            apiProjects,
                            isGuest,
                            onOpenProject: handleOpenProject,
                            onOpenFileClick: onSwitchFile,
                            onCreateProject: () => handleOpenCreateDialog(true, null),
                            onDeleteProject,
                        },
                    },
                    activeSchema,
                    ai,
                    allowedModels,
                    editor,
                    onManualSave,
                    subgraphConfig,
                    onSubgraphConfigChange,
                    graphStats,
                    onOpenGraphSettings,
                    pendingDiff,
                    onClearDiff: () => setPendingDiff(null),
                    activeProjectId,
                    pendingAiFile,
                    onAcceptAiChanges: handleAcceptAiChanges,
                    onRejectAiChanges: handleRejectAiChanges,
                })}
            >
                {children}
            </SidebarLayout >

            {/* Create File/Folder Dialog (shared by FileTree + EditorTabBar) */}
            <CreateFileDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onConfirm={handleCreateConfirm}
                onConfirmTemplate={handleCreateTemplateConfirm}
                files={files}
                defaultParentId={createDialogParentId}
                isFolder={createDialogIsFolder}
            />

            {/* Create Project Dialog */}
            <CreateProjectDialog
                open={createProjectDialogOpen}
                onOpenChange={setCreateProjectDialogOpen}
                onConfirm={handleCreateProjectConfirm}
                connections={connections.map(connection => ({ id: connection.id, name: connection.name }))}
                teams={teams.map(team => ({ id: team.id, name: team.name }))}
            />

            {/* Delete Confirm Dialog (shared by FileTree + EditorTabBar + FilePicker) */}
            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                file={fileToDelete}
                files={files}
                onConfirm={handleDeleteConfirm}
            />
        </>
    );
}
