// =============================================================================
// FileTree — VS Code-style file explorer
// Enhanced with: search/filter, create dialog, delete confirmation,
// bulk operations, file size indicators
// =============================================================================

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
    Plus,
    FolderPlus,
    Download,
    Files,
    ChevronsDownUp,
    ChevronRight,
    PanelLeftClose,
    Search,
    X,
    Trash2,
    CheckSquare,
    ArrowLeft,
    LayoutDashboard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SqlFile } from '@/lib/file-management';
import type { FileTreeProps } from './types';
import { buildTree } from './tree-builder';
import { TreeItem } from './TreeItem';


export function FileTree({
    files,
    activeFileId,
    onFileClick,
    onFileDoubleClick,
    onCreateFile,
    onCreateFileInFolder,
    onCreateFolder,
    onRenameFile,
    onDeleteFile,
    onMoveFile,
    onDownloadFile,
    onToggleSidebar,
    previewTabId,
    isGuest,
    canCreateFile = true,
    selectedFileIds,
    onToggleSelection,
    onBulkDelete,
    onBulkMove,
    onOpenCreateDialog,
    openTabs = [],
    onCloseTab,
    onCloseAllTabs,
    onCloseOtherTabs,
    activeRootId,
    activeProjectId,
    onCloseProject,
    onGoToDashboard,
    apiProjects = [],
    currentProject,
    isLoading = false,
}: FileTreeProps) {
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const prevFolderIdsRef = useRef<Set<string>>(new Set());

    // Collapsible sections
    const [openEditorsExpanded, setOpenEditorsExpanded] = useState(true);
    const [projectFilesExpanded, setProjectFilesExpanded] = useState(true);

    // ─── Search/Filter ────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    // ─── Bulk Selection ───────────────────────────────────────────────
    const [internalSelection, setInternalSelection] = useState<Set<string>>(new Set());
    const [selectionMode, setSelectionMode] = useState(false);
    const selection = selectedFileIds ?? internalSelection;

    const tree = useMemo(() => buildTree(files), [files]);

    // Active Tab List (Open Editors)
    const openEditorFiles = useMemo(() => {
        return openTabs.map(id => files.find(f => f.id === id)).filter((f): f is SqlFile => !!f);
    }, [openTabs, files]);

    // Filter tree nodes by search query
    const filteredTree = useMemo(() => {
        if (!searchQuery.trim()) return tree;
        const q = searchQuery.toLowerCase();

        function filterNodes(nodes: typeof tree): typeof tree {
            const result: typeof tree = [];
            for (const node of nodes) {
                const nameMatch = node.file.title.toLowerCase().includes(q);
                const filteredChildren = node.file.is_folder
                    ? filterNodes(node.children)
                    : [];

                if (nameMatch || filteredChildren.length > 0) {
                    result.push({
                        ...node,
                        children: node.file.is_folder ? filteredChildren : node.children,
                    });
                }
            }
            return result;
        }

        return filterNodes(tree);
    }, [tree, searchQuery]);

    // Auto-expand folders when searching
    useEffect(() => {
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const foldersToExpand = new Set<string>();

            function collectMatchingParents(nodes: typeof tree) {
                for (const node of nodes) {
                    if (node.file.is_folder) {
                        const hasMatchInChildren = files.some(
                            f => f.parent_id === node.file.id &&
                                f.title.toLowerCase().includes(q)
                        );
                        if (hasMatchInChildren) foldersToExpand.add(node.file.id);
                        collectMatchingParents(node.children);
                    }
                }
            }
            collectMatchingParents(tree);
            if (foldersToExpand.size > 0) {
                setExpandedFolders(prev => {
                    const next = new Set(prev);
                    foldersToExpand.forEach(id => next.add(id));
                    return next;
                });
            }
        }
    }, [searchQuery, tree, files]);

    // Auto-expand newly created folders
    useEffect(() => {
        const currentFolderIds = new Set(files.filter(f => f.is_folder).map(f => f.id));
        const prevIds = prevFolderIdsRef.current;

        if (prevIds.size > 0) {
            const newFolderIds = [...currentFolderIds].filter(id => !prevIds.has(id));
            if (newFolderIds.length > 0) {
                setExpandedFolders(prev => {
                    const next = new Set(prev);
                    newFolderIds.forEach(id => next.add(id));
                    return next;
                });
            }
        }

        prevFolderIdsRef.current = currentFolderIds;
    }, [files]);

    const toggleFolder = useCallback((folderId: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
    }, []);

    const startRename = useCallback((file: SqlFile) => {
        setRenamingId(file.id);
        setRenameValue(file.title);
    }, []);

    const commitRename = useCallback(() => {
        if (renamingId && renameValue.trim() && onRenameFile) {
            onRenameFile(renamingId, renameValue.trim());
        }
        setRenamingId(null);
        setRenameValue('');
    }, [renamingId, renameValue, onRenameFile]);

    const cancelRename = useCallback(() => {
        setRenamingId(null);
        setRenameValue('');
    }, []);

    const collapseAllFolders = useCallback(() => {
        setExpandedFolders(new Set());
    }, []);

    // ─── Create handlers (delegate to parent dialog) ────────────────

    const handleCreateFile = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!canCreateFile) {
            toast.error('Guest mode is limited to 10 files. Sign in for unlimited files.');
            return;
        }
        onOpenCreateDialog?.(false, activeRootId ?? null);
    }, [activeRootId, canCreateFile, onOpenCreateDialog]);

    const handleCreateFileInFolder = useCallback((parentId: string) => {
        if (!canCreateFile) {
            toast.error('Guest mode is limited to 10 files. Sign in for unlimited files.');
            return;
        }
        onOpenCreateDialog?.(false, parentId);
    }, [canCreateFile, onOpenCreateDialog]);

    const handleCreateFolder = useCallback((e?: React.MouseEvent, parentId?: string | null) => {
        e?.stopPropagation();
        onOpenCreateDialog?.(true, parentId ?? activeRootId ?? null);
    }, [activeRootId, onOpenCreateDialog]);



    // ─── Bulk operations ─────────────────────────────────────────────

    const handleToggleSelection = useCallback(
        (fileId: string, shiftKey?: boolean) => {
            if (onToggleSelection) {
                onToggleSelection(fileId, shiftKey);
            } else {
                setInternalSelection(prev => {
                    const next = new Set(prev);
                    if (next.has(fileId)) {
                        next.delete(fileId);
                    } else {
                        next.add(fileId);
                    }
                    return next;
                });
            }
        },
        [onToggleSelection],
    );

    const handleBulkDelete = useCallback(() => {
        const ids = [...selection];
        if (ids.length === 0) return;
        if (onBulkDelete) {
            onBulkDelete(ids);
        } else {
            // Fallback: delete one by one
            ids.forEach(id => onDeleteFile?.(id));
        }
        setInternalSelection(new Set());
        setSelectionMode(false);
    }, [selection, onBulkDelete, onDeleteFile]);

    const toggleSelectionMode = useCallback(() => {
        setSelectionMode(prev => {
            if (prev) {
                setInternalSelection(new Set());
            }
            return !prev;
        });
    }, []);

    // Listen for external rename triggers (e.g., after creating a new file/folder)
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.fileId) {
                const file = files.find(f => f.id === detail.fileId);
                if (file) {
                    // Expand parent folder if needed
                    if (file.parent_id) {
                        setExpandedFolders(prev => {
                            const next = new Set(prev);
                            next.add(file.parent_id!);
                            return next;
                        });
                    }
                    setRenamingId(file.id);
                    setRenameValue(file.title);
                }
            }
        };
        window.addEventListener('sw-trigger-rename', handler);
        return () => window.removeEventListener('sw-trigger-rename', handler);
    }, [files]);


    return (
        <div className="flex flex-col h-full bg-background select-none">
            {/* Global Explorer Header */}
            <div className="flex items-center justify-between px-3 h-9 flex-shrink-0">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="text-xs uppercase tracking-wide">
                        Explorer
                    </span>
                </div>
                <div className="flex items-center gap-0.5">
                    {onGoToDashboard && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
                                    onClick={onGoToDashboard}
                                >
                                    <LayoutDashboard className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">Dashboard</TooltipContent>
                        </Tooltip>
                    )}
                    {onToggleSidebar && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
                                    onClick={onToggleSidebar}
                                >
                                    <PanelLeftClose className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">Close Sidebar</TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </div>

            {/* Back to All Files Navigation */}
            {(activeRootId || activeProjectId) && (
                <div className="px-3 pb-2 flex-shrink-0">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full justify-start h-7 px-2 text-xs hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                        onClick={() => onCloseProject?.()}
                    >
                        <ArrowLeft className="w-3.5 h-3.5 mr-2" />
                        {activeProjectId ? (currentProject?.name || 'Loading...') : (files.find(f => f.id === activeRootId)?.title || 'All Files')}
                    </Button>
                </div>
            )}

            {/* Permanent Search Bar */}
            <div className="px-3 pb-2 flex-shrink-0">
                <div className="relative group/search">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                    <Input
                        ref={searchInputRef}
                        placeholder="Filter files..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-7 h-7 text-xs bg-muted/20 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/50"
                        onKeyDown={e => {
                            if (e.key === 'Escape') {
                                setSearchQuery('');
                            }
                        }}
                    />
                    {searchQuery && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/50 hover:text-foreground"
                            onClick={() => setSearchQuery('')}
                        >
                            <X className="w-3 h-3" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Main Scrollable Tree Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin flex flex-col">

                {/* ─── Open Editors Section ────────────────────────────────────────── */}
                {openEditorFiles.length > 0 && (
                    <div className="flex flex-col mb-1 shrink-0">
                        {/* Section Header */}
                        <div
                            className="flex items-center justify-between px-1 h-[22px] cursor-pointer hover:bg-muted/40 group/section"
                            onClick={() => setOpenEditorsExpanded(!openEditorsExpanded)}
                        >
                            <div className="flex items-center gap-0.5">
                                <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                    {openEditorsExpanded
                                        ? <ChevronsDownUp className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                                        : <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                                    }
                                </span>
                                <span className="text-[11px] font-bold tracking-wide text-foreground/80">
                                    OPEN EDITORS
                                </span>
                            </div>

                            <div className="flex items-center opacity-0 group-hover/section:opacity-100 transition-opacity">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 text-muted-foreground/60 hover:text-foreground"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCloseAllTabs?.();
                                            }}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">Close All</TooltipContent>
                                </Tooltip>
                            </div>
                        </div>

                        {/* Open Editors List */}
                        {openEditorsExpanded && (
                            <div className="flex flex-col">
                                {openEditorFiles.map(file => {
                                    const isPreview = file.id === previewTabId;
                                    const isActive = file.id === activeFileId;
                                    return (
                                        <div
                                            key={`open-${file.id}`}
                                            className={cn(
                                                'flex items-center justify-between w-full text-[12px] h-[22px] px-1 hover:bg-muted/60 transition-colors group/openitem',
                                                isActive && 'bg-primary/10 text-primary font-medium',
                                            )}
                                            onClick={() => onFileClick(file.id)}
                                            onDoubleClick={() => onFileDoubleClick?.(file.id)}
                                        >
                                            <div className="flex items-center gap-1.5 overflow-hidden ml-3 min-w-0">
                                                <X
                                                    className="w-3 h-3 shrink-0 text-muted-foreground/0 group-hover/openitem:text-muted-foreground hover:bg-muted/80 rounded cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onCloseTab?.(file.id);
                                                    }}
                                                />
                                                <span className={cn('truncate', isPreview && 'italic text-muted-foreground')}>
                                                    {file.title}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ─── Project Files Section ────────────────────────────────────────── */}
                <div className="flex flex-col flex-1 pb-4">
                    {/* Section Header */}
                    <div
                        className="flex items-center justify-between px-1 h-[22px] cursor-pointer hover:bg-muted/40 group/section sticky top-0 bg-background z-10"
                        onClick={() => setProjectFilesExpanded(!projectFilesExpanded)}
                    >
                        <div className="flex items-center gap-0.5">
                            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                                {projectFilesExpanded
                                    ? <ChevronsDownUp className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                                    : <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                                }
                            </span>
                            <span className="text-[11px] font-bold tracking-wide text-foreground/80">
                                {isGuest ? 'GUEST PROJECT' : 'PROJECT FILES'}
                            </span>
                        </div>

                        {/* Section Actions */}
                        <div className="flex items-center opacity-0 group-hover/section:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                            {onCreateFile && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 text-muted-foreground/60 hover:text-foreground"
                                            onClick={handleCreateFile}
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">New File</TooltipContent>
                                </Tooltip>
                            )}
                            {onCreateFolder && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5 text-muted-foreground/60 hover:text-foreground"
                                            onClick={handleCreateFolder}
                                        >
                                            <FolderPlus className="w-3.5 h-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">New Folder</TooltipContent>
                                </Tooltip>
                            )}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-muted-foreground/60 hover:text-foreground"
                                        onClick={collapseAllFolders}
                                    >
                                        <ChevronsDownUp className="w-3.5 h-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Collapse All</TooltipContent>
                            </Tooltip>
                        </div>
                    </div>

                    {/* Section Content */}
                    {projectFilesExpanded && (
                        <div
                            className="flex-1 mt-1"
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                            }}
                            onDrop={(e) => {
                                e.preventDefault();
                                const target = e.target as HTMLElement;
                                if (target === e.currentTarget) {
                                    const sourceId = e.dataTransfer.getData('text/plain');
                                    if (sourceId && onMoveFile) {
                                        onMoveFile(sourceId, null);
                                    }
                                }
                            }}
                        >
                            {isLoading && files.length === 0 ? (
                                <div className="px-2 py-1 space-y-0.5">
                                    {[40, 60, 50, 70, 45].map((w, i) => (
                                        <div key={i} className="flex items-center gap-2 h-[22px] px-1">
                                            <div className="w-3.5 h-3.5 rounded bg-muted-foreground/10 animate-pulse flex-shrink-0" />
                                            <div
                                                className="h-2.5 rounded bg-muted-foreground/10 animate-pulse"
                                                style={{ width: `${w}%` }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : filteredTree.length === 0 ? (
                                <div className="px-4 py-4 text-center space-y-3">
                                    {searchQuery ? (
                                        <p className="text-xs text-muted-foreground/50">
                                            No files matching &ldquo;{searchQuery}&rdquo;
                                        </p>
                                    ) : !activeProjectId && !isGuest && apiProjects.length > 0 ? (
                                        <div className="flex flex-col gap-1 text-left px-1">
                                            <p className="text-[10px] text-muted-foreground mb-2 px-1 uppercase tracking-wider">Select a project</p>
                                            {apiProjects.map(project => (
                                                <Button
                                                    key={project.id}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full justify-start h-8 px-2 text-xs hover:bg-muted/50 font-normal"
                                                    onClick={() => {
                                                        onFileClick(project.id); // In this context, clicking a project effectively "opens" it
                                                    }}
                                                >
                                                    <LayoutDashboard className="w-3.5 h-3.5 mr-2 text-primary/60" />
                                                    <span className="truncate">{project.name}</span>
                                                </Button>
                                            ))}
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-xs text-muted-foreground/50 mb-1">No files yet</p>
                                            <div className="flex flex-col gap-2 items-center">
                                                {onCreateFile && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-xs h-7 w-36"
                                                        onClick={(e) => handleCreateFile(e)}
                                                    >
                                                        <Plus className="w-3 h-3 mr-1" />
                                                        New File
                                                    </Button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                filteredTree.map(node => (
                                    <TreeItem
                                        key={node.file.id}
                                        node={node}
                                        activeFileId={activeFileId}
                                        expandedFolders={expandedFolders}
                                        onToggleFolder={toggleFolder}
                                        onFileClick={onFileClick}
                                        onFileDoubleClick={onFileDoubleClick}
                                        onRenameFile={onRenameFile}
                                        onDeleteFile={onDeleteFile}
                                        onCreateFileInFolder={handleCreateFileInFolder}
                                        onCreateFolder={(_title, parentId) => handleCreateFolder(undefined, parentId)}
                                        renamingId={renamingId}
                                        renameValue={renameValue}
                                        onStartRename={startRename}
                                        onRenameChange={setRenameValue}
                                        onCommitRename={commitRename}
                                        onCancelRename={cancelRename}
                                        onMoveFile={onMoveFile}
                                        previewTabId={previewTabId}
                                        isSelected={selection.has(node.file.id)}
                                        onToggleSelection={selectionMode ? handleToggleSelection : undefined}
                                        selectionMode={selectionMode}
                                        showFileSize
                                        selectedFileIds={selection}
                                    />
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Guest capacity indicator */}
            {isGuest && (
                <div className="flex-shrink-0 px-2 py-1 border-t bg-muted/20">
                    <p className="text-[10px] text-muted-foreground/50 text-center">
                        {files.filter(f => !f.is_folder).length} files · {files.filter(f => f.is_folder).length} projects (guest)
                    </p>
                </div>
            )}
        </div>
    );
}
