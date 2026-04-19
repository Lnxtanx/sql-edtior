import { useState } from 'react';
import {
    ChevronRight,
    ChevronDown,
    Plus,
    FolderPlus,
    Trash2,
    Pencil,
    Copy,
    Square,
    CheckSquare2,
} from 'lucide-react';
import { getFileIcon, getFolderIcon, extractExtension } from '@/lib/file-management/utils/file-icons';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { TreeItemProps } from './types';

/** Format byte size to human-readable string */
function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TreeItem({
    node,
    activeFileId,
    expandedFolders,
    onToggleFolder,
    onFileClick,
    onFileDoubleClick,
    onRenameFile,
    onDeleteFile,
    onCreateFileInFolder,
    onCreateFolder,
    renamingId,
    renameValue,
    onStartRename,
    onRenameChange,
    onCommitRename,
    onCancelRename,
    onMoveFile,
    previewTabId,
    isSelected,
    onToggleSelection,
    selectionMode,
    showFileSize,
    selectedFileIds,
}: TreeItemProps) {
    const { file, children, depth } = node;
    const isFolder = file.is_folder;
    const isExpanded = expandedFolders.has(file.id);
    const isActive = file.id === activeFileId;
    const isRenaming = renamingId === file.id;
    const isPreview = file.id === previewTabId;

    const [isDragOver, setIsDragOver] = useState(false);

    const ext = file.file_extension || extractExtension(file.title);
    const { icon: Icon, color } = isFolder
        ? getFolderIcon(isExpanded)
        : getFileIcon(ext);

    const handleClick = () => {
        if (selectionMode && onToggleSelection) {
            onToggleSelection(file.id);
            return;
        }
        if (isFolder) {
            onToggleFolder(file.id);
        } else {
            onFileClick(file.id);
        }
    };

    const handleDoubleClick = () => {
        if (selectionMode) return;
        if (!isFolder) {
            onFileDoubleClick?.(file.id);
        }
    };

    // File size for tooltip (only for non-folder files)
    const fileSize = !isFolder && showFileSize && file.content
        ? new Blob([file.content]).size
        : 0;

    // --- Drag and Drop ---
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', file.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (isFolder) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!isDragOver) setIsDragOver(true);
        }
    };

    const handleDragLeave = () => {
        if (isFolder) setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        if (!isFolder) return;
        e.preventDefault();
        setIsDragOver(false);
        const sourceId = e.dataTransfer.getData('text/plain');
        if (sourceId && sourceId !== file.id && onMoveFile) {
            onMoveFile(sourceId, file.id);
        }
    };

    return (
        <>
            <ContextMenu>
                <ContextMenuTrigger asChild>
                    <button
                        draggable
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={cn(
                            'flex items-center w-full text-left text-[12px] h-[26px] hover:bg-muted/60 transition-colors group/item select-none',
                            isActive && !isFolder && 'bg-primary/10 text-primary font-medium',
                            isDragOver && 'bg-primary/20 outline outline-1 outline-primary',
                            isSelected && 'bg-primary/15'
                        )}
                        style={{ paddingLeft: `${depth * 16 + 8}px` }}
                        onClick={handleClick}
                        onDoubleClick={handleDoubleClick}
                    >
                        {/* Selection checkbox (bulk mode) */}
                        {selectionMode && (
                            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 mr-0.5">
                                {isSelected
                                    ? <CheckSquare2 className="w-3.5 h-3.5 text-primary" />
                                    : <Square className="w-3.5 h-3.5 text-muted-foreground/50" />
                                }
                            </span>
                        )}
                        {/* Expand/Collapse arrow for folders */}
                        {isFolder ? (
                            <span className="w-4 h-4 flex items-center justify-center flex-shrink-0 mr-0.5">
                                {isExpanded
                                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                }
                            </span>
                        ) : (
                            <span className="w-4 h-4 flex-shrink-0 mr-0.5" />
                        )}

                        {/* Icon */}
                        <Icon className={cn('w-4 h-4 flex-shrink-0 mr-1.5', color)} />

                        {/* Name or rename input */}
                        {isRenaming ? (
                            <input
                                autoFocus
                                className="bg-background border border-primary/50 rounded px-1 text-[12px] w-full outline-none"
                                value={renameValue}
                                onChange={(e) => onRenameChange(e.target.value)}
                                onBlur={onCommitRename}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') onCommitRename();
                                    if (e.key === 'Escape') onCancelRename();
                                }}
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="flex items-center gap-1 min-w-0 flex-1">
                                        <span className={cn('truncate', isPreview && 'italic text-muted-foreground')}>{file.title}</span>
                                        {showFileSize && fileSize > 0 && (
                                            <span className="text-[9px] text-muted-foreground/40 flex-shrink-0 hidden group-hover/item:inline">
                                                {formatSize(fileSize)}
                                            </span>
                                        )}
                                    </span>
                                </TooltipTrigger>
                                {showFileSize && fileSize > 0 && (
                                    <TooltipContent side="right" className="text-xs">
                                        {file.title} — {formatSize(fileSize)}
                                    </TooltipContent>
                                )}
                            </Tooltip>
                        )}
                    </button>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-48">
                    {!isFolder && (
                        <ContextMenuItem onClick={() => onFileClick(file.id)}>
                            Open
                        </ContextMenuItem>
                    )}
                    {isFolder && (
                        <>
                            {onCreateFileInFolder && (
                                <ContextMenuItem onClick={() => onCreateFileInFolder(file.id)}>
                                    <Plus className="w-3.5 h-3.5 mr-2" />
                                    New File
                                </ContextMenuItem>
                            )}
                            {onCreateFolder && (
                                <ContextMenuItem onClick={() => onCreateFolder(undefined, file.id)}>
                                    <FolderPlus className="w-3.5 h-3.5 mr-2" />
                                    New Folder
                                </ContextMenuItem>
                            )}
                            <ContextMenuSeparator />
                        </>
                    )}
                    <ContextMenuItem onSelect={(e) => {
                        e.preventDefault();
                        onStartRename(file);
                    }}>
                        <Pencil className="w-3.5 h-3.5 mr-2" />
                        Rename
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => navigator.clipboard.writeText(file.title)}>
                        <Copy className="w-3.5 h-3.5 mr-2" />
                        Copy Name
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    {onDeleteFile && (
                        <ContextMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => onDeleteFile(file.id)}
                        >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Delete
                        </ContextMenuItem>
                    )}
                </ContextMenuContent>
            </ContextMenu>

            {/* Render children if folder is expanded */}
            {isFolder && isExpanded && (
                children.length === 0 ? (
                    <div
                        className="text-[10px] text-muted-foreground/40 italic py-1"
                        style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
                    >
                        Empty folder
                    </div>
                ) : (
                    children.map(child => (
                        <TreeItem
                            key={child.file.id}
                            node={child}
                            activeFileId={activeFileId}
                            expandedFolders={expandedFolders}
                            onToggleFolder={onToggleFolder}
                            onFileClick={onFileClick}
                            onFileDoubleClick={onFileDoubleClick}
                            onRenameFile={onRenameFile}
                            onDeleteFile={onDeleteFile}
                            onCreateFileInFolder={onCreateFileInFolder}
                            onCreateFolder={onCreateFolder}
                            renamingId={renamingId}
                            renameValue={renameValue}
                            onStartRename={onStartRename}
                            onRenameChange={onRenameChange}
                            onCommitRename={onCommitRename}
                            onCancelRename={onCancelRename}
                            onMoveFile={onMoveFile}
                            previewTabId={previewTabId}
                            isSelected={selectedFileIds?.has(child.file.id)}
                            onToggleSelection={onToggleSelection}
                            selectionMode={selectionMode}
                            showFileSize={showFileSize}
                            selectedFileIds={selectedFileIds}
                        />
                    ))
                )
            )}
        </>
    );
}
