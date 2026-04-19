// =============================================================================
// EditorTabBar Component
// VS Code-style tab bar replacing the old FilePicker dropdown
// =============================================================================

import { useRef, useCallback, useState } from 'react';
import { X, Plus, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { getFileIcon, extractExtension } from '@/lib/file-management/utils/file-icons';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import type { SqlFile } from '@/lib/file-management';

// =============================================================================
// Types
// =============================================================================

interface EditorTabBarProps {
    /** All files available */
    files: SqlFile[];
    /** IDs of currently open tabs (ordered) */
    openTabs: string[];
    /** Currently active tab ID */
    activeTabId: string | null;
    /** Preview tab ID (will be rendered in italic) */
    previewTabId?: string | null;
    /** Switch to a tab */
    onSwitchTab: (fileId: string) => void;
    /** Double-click to pin a preview tab */
    onPinTab?: (fileId: string) => void;
    /** Close a tab */
    onCloseTab: (fileId: string) => void;
    /** Close other tabs */
    onCloseOtherTabs?: (fileId: string) => void;
    /** Close all tabs */
    onCloseAllTabs?: () => void;
    /** Create a new file */
    onCreateFile?: () => void;
    /** Rename a file */
    onRenameFile?: (fileId: string, newTitle: string) => void;
    /** Delete a file */
    onDeleteFile?: (fileId: string) => void;
    /** Download current file */
    onDownloadFile?: () => void;
    /** Whether the editor is saving */
    saving?: boolean;
    /** Whether the editor is maximized/fullscreen */
    isMaximized?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function EditorTabBar({
    files,
    openTabs,
    activeTabId,
    previewTabId,
    onSwitchTab,
    onPinTab,
    onCloseTab,
    onCloseOtherTabs,
    onCloseAllTabs,
    onCreateFile,
    onRenameFile,
    onDeleteFile,
    onDownloadFile,
    saving,
    isMaximized,
}: EditorTabBarProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // Resolve file data from IDs
    const tabFiles = openTabs
        .map(id => files.find(f => f.id === id))
        .filter(Boolean) as SqlFile[];

    // ─── Scroll helpers ──────────────────────────────────────────
    const scrollLeft = useCallback(() => {
        scrollRef.current?.scrollBy({ left: -150, behavior: 'smooth' });
    }, []);

    const scrollRight = useCallback(() => {
        scrollRef.current?.scrollBy({ left: 150, behavior: 'smooth' });
    }, []);

    // ─── Rename logic ────────────────────────────────────────────
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

    // ─── Tab close (prevent switching when closing) ──────────────
    const handleCloseTab = useCallback((e: React.MouseEvent, fileId: string) => {
        e.stopPropagation();
        onCloseTab(fileId);
    }, [onCloseTab]);

    // ─── Middle-click close ──────────────────────────────────────
    const handleMouseDown = useCallback((e: React.MouseEvent, fileId: string) => {
        if (e.button === 1) { // Middle click
            e.preventDefault();
            onCloseTab(fileId);
        }
    }, [onCloseTab]);

    // ─── No tabs state ──────────────────────────────────────────
    if (tabFiles.length === 0) {
        return (
            <div className="flex items-center gap-2 px-1 h-full min-w-0">
                <span className="text-xs text-muted-foreground/60 italic truncate">
                    No files open
                </span>
                {onCreateFile && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground/60 hover:text-foreground flex-shrink-0"
                                onClick={onCreateFile}
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>New File</TooltipContent>
                    </Tooltip>
                )}
            </div>
        );
    }

    return (
        <div className="flex items-center min-w-0 flex-1 h-full">
            {/* Scroll Left Arrow (shown when overflow) */}
            <Button
                variant="ghost"
                size="icon"
                className="h-full w-5 flex-shrink-0 text-muted-foreground/40 hover:text-muted-foreground rounded-none hidden group-hover/tabs:flex"
                onClick={scrollLeft}
                tabIndex={-1}
            >
                <ChevronLeft className="w-3 h-3" />
            </Button>

            {/* Scrollable Tab Container */}
            <div
                ref={scrollRef}
                className="flex items-end gap-0 overflow-x-auto scrollbar-thin flex-1 min-w-0 h-full group/tabs"
            >
                {tabFiles.map((file) => {
                    const isActive = file.id === activeTabId;
                    const isPreview = file.id === previewTabId;
                    const ext = file.file_extension || extractExtension(file.title);
                    const { icon: FileIcon, color } = getFileIcon(ext);
                    const isRenaming = renamingId === file.id;

                    return (
                        <ContextMenu key={file.id}>
                            <ContextMenuTrigger asChild>
                                <button
                                    className={cn(
                                        'group/tab flex items-center gap-1.5 px-3 h-[30px] text-xs border-b-2 transition-all duration-150 select-none flex-shrink-0 max-w-[180px]',
                                        isActive
                                            ? 'border-b-primary bg-background text-foreground'
                                            : 'border-b-transparent text-muted-foreground/70 hover:text-foreground hover:bg-muted/50'
                                    )}
                                    onClick={() => onSwitchTab(file.id)}
                                    onMouseDown={(e) => handleMouseDown(e, file.id)}
                                    onDoubleClick={() => isPreview ? onPinTab?.(file.id) : startRename(file)}
                                    title={file.title}
                                >
                                    {/* File Icon */}
                                    <FileIcon className={cn('w-3.5 h-3.5 flex-shrink-0', color)} />

                                    {/* File Name (or rename input) */}
                                    {isRenaming ? (
                                        <input
                                            autoFocus
                                            className="bg-transparent border-b border-primary text-xs w-24 outline-none"
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onBlur={commitRename}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') commitRename();
                                                if (e.key === 'Escape') {
                                                    setRenamingId(null);
                                                    setRenameValue('');
                                                }
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className={cn('truncate text-[11px] leading-tight', isPreview && 'italic')}>
                                            {file.title}
                                        </span>
                                    )}

                                    {/* Saving indicator for active tab */}
                                    {isActive && saving && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                                    )}

                                    {/* Close button */}
                                    <span
                                        className={cn(
                                            'ml-auto flex-shrink-0 rounded-sm p-0.5 transition-opacity',
                                            isActive
                                                ? 'opacity-60 hover:opacity-100 hover:bg-muted'
                                                : 'opacity-0 group-hover/tab:opacity-60 hover:!opacity-100 hover:bg-muted'
                                        )}
                                        onClick={(e) => handleCloseTab(e, file.id)}
                                        role="button"
                                        tabIndex={-1}
                                    >
                                        <X className="w-3 h-3" />
                                    </span>
                                </button>
                            </ContextMenuTrigger>

                            {/* Right-click Context Menu */}
                            <ContextMenuContent className="w-48">
                                <ContextMenuItem onClick={() => onCloseTab(file.id)}>
                                    Close
                                </ContextMenuItem>
                                {onCloseOtherTabs && (
                                    <ContextMenuItem onClick={() => onCloseOtherTabs(file.id)}>
                                        Close Others
                                    </ContextMenuItem>
                                )}
                                {onCloseAllTabs && (
                                    <ContextMenuItem onClick={onCloseAllTabs}>
                                        Close All
                                    </ContextMenuItem>
                                )}
                                <ContextMenuSeparator />
                                {isPreview && onPinTab && (
                                    <ContextMenuItem onClick={() => onPinTab(file.id)}>
                                        Keep Open
                                    </ContextMenuItem>
                                )}
                                <ContextMenuItem onClick={() => startRename(file)}>
                                    Rename
                                </ContextMenuItem>
                                {onDownloadFile && (
                                    <ContextMenuItem onClick={() => onDownloadFile()}>
                                        Download
                                    </ContextMenuItem>
                                )}
                                {onDeleteFile && (
                                    <ContextMenuItem
                                        className="text-red-600 focus:text-red-600"
                                        onClick={() => onDeleteFile(file.id)}
                                    >
                                        Delete File
                                    </ContextMenuItem>
                                )}
                            </ContextMenuContent>
                        </ContextMenu>
                    );
                })}

                {/* New File Button */}
                {onCreateFile && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                className="flex items-center justify-center h-[30px] w-7 text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
                                onClick={onCreateFile}
                            >
                                <Plus className="w-3.5 h-3.5" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>New File (Ctrl+N)</TooltipContent>
                    </Tooltip>
                )}

                {/* Download Button - Only shown when maximized */}
                {onDownloadFile && isMaximized && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                className="flex items-center justify-center h-[30px] w-7 text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
                                onClick={() => onDownloadFile()}
                            >
                                <Download className="w-3.5 h-3.5" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>Download (Ctrl+Shift+S)</TooltipContent>
                    </Tooltip>
                )}
            </div>

            {/* Scroll Right Arrow */}
            <Button
                variant="ghost"
                size="icon"
                className="h-full w-5 flex-shrink-0 text-muted-foreground/40 hover:text-muted-foreground rounded-none hidden group-hover/tabs:flex"
                onClick={scrollRight}
                tabIndex={-1}
            >
                <ChevronRight className="w-3 h-3" />
            </Button>


        </div>
    );
}
