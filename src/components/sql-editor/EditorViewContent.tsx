/**
 * EditorViewContent — the 'editor' sidebar view content.
 *
 * Contains:
 *  - FileTree sidebar (only in fullscreen)
 *  - SqlEditorPanel (editor or dashboard)
 *
 * Extracted from SqlEditor.tsx to reduce file size.
 */

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PanelLeftOpen, Check, X, FileDiff } from 'lucide-react';
import { FileTree } from './file-tree';
import { SqlEditorPanel, SqlEditorPanelProps } from './SqlEditorPanel';
import type { Project, SqlFile } from '@/lib/file-management';
import type { RecentFile } from '@/lib/cookies';
import { useMemo } from 'react';
import { lineDiff, diffStats } from '@/lib/diff/computeLineDiff';

export interface EditorViewContentProps {
    // Fullscreen / file tree
    isMaximized: boolean;
    showFileTree: boolean;
    onToggleFileTree: (show: boolean) => void;

    // File tree props
    workspaceFiles: SqlFile[];
    isFilesLoading?: boolean;
    activeFileId?: string | null;
    onFileClick: (id: string) => void;
    onCreateFile: () => void;
    onCreateFolder: (title: string, parentId: string | null) => void;
    onRenameFile?: (fileId: string, newTitle: string) => void;
    onDeleteFile: (fileId: string) => void;
    onMoveFile?: (fileId: string, parentId: string | null, sortOrder?: number) => void;
    onFileDoubleClick?: (fileId: string) => void;
    onCreateFileInFolder: (parentId: string) => void;
    onDownloadFile?: () => void;
    previewTabId?: string | null;
    isGuest?: boolean;
    canCreateFile?: boolean;
    onOpenCreateDialog: (isFolder: boolean, parentId: string | null) => void;
    openTabs: string[];
    onCloseTab?: (fileId: string) => void;
    onCloseAllTabs?: () => void;
    onCloseOtherTabs?: (fileId: string) => void;
    activeRootId: string | null;
    activeProjectId: string | null;
    onCloseProject: () => void;
    onGoToDashboard: () => void;
    apiProjects?: Project[];
    currentProject?: Project | null;

    // SqlEditorPanel props
    editorPanelProps: SqlEditorPanelProps;

    // AI file changes — for VS Code-style accept/reject
    pendingAiFile?: {
        nodeId: string;
        fileName: string;
        originalContent: string;
        proposedContent: string;
        toolName: string;
    } | null;
    onAcceptAiChanges?: () => void;
    onRejectAiChanges?: () => void;
}

export function EditorViewContent({
    isMaximized,
    showFileTree,
    onToggleFileTree,
    workspaceFiles,
    isFilesLoading,
    activeFileId,
    onFileClick,
    onCreateFile,
    onCreateFolder,
    onRenameFile,
    onDeleteFile,
    onMoveFile,
    onFileDoubleClick,
    onCreateFileInFolder,
    onDownloadFile,
    previewTabId,
    isGuest,
    canCreateFile,
    onOpenCreateDialog,
    openTabs,
    onCloseTab,
    onCloseAllTabs,
    onCloseOtherTabs,
    activeRootId,
    activeProjectId,
    onCloseProject,
    onGoToDashboard,
    apiProjects,
    currentProject,
    editorPanelProps,
    pendingAiFile,
    onAcceptAiChanges,
    onRejectAiChanges,
}: EditorViewContentProps) {
    // Compute diff stats for AI changes banner
    const diffInfo = useMemo(() => {
        if (!pendingAiFile) return null;
        const hunks = lineDiff(pendingAiFile.originalContent, pendingAiFile.proposedContent);
        const stats = diffStats(hunks);
        return { hunks, stats, fileName: pendingAiFile.fileName, toolName: pendingAiFile.toolName };
    }, [pendingAiFile]);

    // Clone editorPanelProps to inject diff hunks
    const enrichedPanelProps: SqlEditorPanelProps = useMemo(() => ({
        ...editorPanelProps,
        diffHunks: diffInfo?.hunks ?? null,
    }), [editorPanelProps, diffInfo]);

    return (
        <div className="flex h-full w-full">
            {/* File tree sidebar — only in fullscreen */}
            {isMaximized && showFileTree && (
                <div className="w-64 border-r bg-background flex-shrink-0">
                    <FileTree
                        files={workspaceFiles}
                        activeFileId={activeFileId}
                        onFileClick={onFileClick}
                        onCreateFile={onCreateFile}
                        onCreateFolder={onCreateFolder}
                        onRenameFile={onRenameFile}
                        onDeleteFile={onDeleteFile}
                        onMoveFile={onMoveFile}
                        onFileDoubleClick={onFileDoubleClick}
                        onCreateFileInFolder={onCreateFileInFolder}
                        onDownloadFile={onDownloadFile}
                        onToggleSidebar={() => onToggleFileTree(false)}
                        previewTabId={previewTabId}
                        isGuest={isGuest}
                        canCreateFile={canCreateFile}
                        onOpenCreateDialog={onOpenCreateDialog}
                        openTabs={openTabs}
                        onCloseTab={onCloseTab}
                        onCloseAllTabs={onCloseAllTabs}
                        onCloseOtherTabs={onCloseOtherTabs}
                        activeRootId={activeRootId}
                        onCloseProject={onCloseProject}
                        onGoToDashboard={onGoToDashboard}
                        apiProjects={apiProjects}
                        activeProjectId={activeProjectId}
                        currentProject={currentProject}
                        isLoading={isFilesLoading}
                    />
                </div>
            )}

            {/* Collapsed file tree toggle — only in fullscreen */}
            {isMaximized && !showFileTree && (
                <div className="border-r bg-background flex-shrink-0 flex items-start pt-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                onClick={() => onToggleFileTree(true)}
                            >
                                <PanelLeftOpen className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right">Open Sidebar</TooltipContent>
                    </Tooltip>
                </div>
            )}

            {/* Main editor / dashboard panel */}
            <div className="flex-1 min-w-0 h-full relative">
                <SqlEditorPanel {...enrichedPanelProps} />

                {/* AI file changes banner — VS Code-style accept/reject */}
                {pendingAiFile && onAcceptAiChanges && onRejectAiChanges && (
                    <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
                        <div className="mx-auto mt-2 max-w-xl">
                            <div className="bg-background border border-border rounded-lg shadow-xl pointer-events-auto">
                                <div className="flex items-center gap-3 px-4 py-2.5">
                                    <FileDiff className="w-4 h-4 text-blue-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">
                                            AI modified{' '}
                                            <span className="text-blue-600 dark:text-blue-400">
                                                {pendingAiFile.fileName}
                                            </span>
                                        </p>
                                        {diffInfo && (diffInfo.stats.added > 0 || diffInfo.stats.removed > 0) && (
                                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                                <span className="text-green-600 dark:text-green-400">+{diffInfo.stats.added} lines</span>
                                                {diffInfo.stats.removed > 0 && (
                                                    <span className="text-red-500 dark:text-red-400 ml-1">−{diffInfo.stats.removed} lines</span>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs gap-1 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 hover:border-red-300"
                                            onClick={onRejectAiChanges}
                                        >
                                            <X className="w-3 h-3" />
                                            Reject
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                            onClick={onAcceptAiChanges}
                                        >
                                            <Check className="w-3 h-3" />
                                            Accept
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
