// =============================================================================
// SqlEditorHeader — Tab bar, status indicators, split view menu, fullscreen
// Extracted from SqlEditor.tsx to reduce component size
// =============================================================================

import { Button } from '@/components/ui/button';
import { SidebarClose, SidebarOpen, Columns, Check, CloudOff, Loader2, Maximize2, Minimize2, Cpu, Network, Plug, Code2, X, GitCompareArrows, Folder, LayoutDashboard } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditorTabBar } from './EditorTabBar';
import type { SqlFile } from '@/lib/file-management';
import type { SidebarView } from '@/components/layout/types';

export interface SqlEditorHeaderProps {
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    files: SqlFile[];
    openTabs: string[];
    activeTabId: string | null | undefined;
    onSwitchFile?: (id: string) => void;
    onCloseTab?: (id: string) => void;
    onCloseOtherTabs?: (id: string) => void;
    onCloseAllTabs?: () => void;
    onCreateFile: () => void;
    onRenameFile?: (id: string, title: string) => void;
    onDeleteFile: (id: string) => void;
    saving?: boolean;
    previewTabId?: string | null;
    onPinTab?: (id: string) => void;
    onDownloadFile?: (id?: string) => void;
    isOnline?: boolean;
    hasPendingOperations?: boolean;
    lastSaved?: Date | null;
    activeView: SidebarView;
    isSplit: boolean;
    onSplitSelection: (view: SidebarView) => void;
    onCloseSplit: () => void;
    isMaximized: boolean;
    onToggleMaximize: () => void;
    onGoToDashboard: () => void;
    currentProject?: { name: string; title?: string } | null;
}

export function SqlEditorHeader({
    isCollapsed,
    onToggleCollapse,
    files,
    openTabs,
    activeTabId,
    onSwitchFile,
    onCloseTab,
    onCloseOtherTabs,
    onCloseAllTabs,
    onCreateFile,
    onRenameFile,
    onDeleteFile,
    saving,
    previewTabId,
    onPinTab,
    onDownloadFile,
    isOnline,
    hasPendingOperations,
    lastSaved,
    activeView,
    isSplit,
    onSplitSelection,
    onCloseSplit,
    isMaximized,
    onToggleMaximize,
    onGoToDashboard,
    currentProject,
}: SqlEditorHeaderProps) {
    return (
        <div className="flex flex-col border-b bg-muted/40 transition-all duration-200">
            <div className="flex items-center justify-between px-2 h-9 flex-shrink-0">
                <div className="flex items-center gap-2 overflow-hidden mr-2 flex-1 min-w-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground flex-shrink-0"
                        onClick={onToggleCollapse}
                        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                    >
                        {isCollapsed ? <SidebarOpen className="w-4 h-4" /> : <SidebarClose className="w-4 h-4" />}
                    </Button>

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground flex-shrink-0"
                        onClick={() => {
                            onGoToDashboard();
                            if (!isMaximized) onToggleMaximize();
                        }}
                        title="Dashboard"
                    >
                        <LayoutDashboard className="w-4 h-4" />
                    </Button>

                    <EditorTabBar
                        files={files}
                        openTabs={openTabs}
                        activeTabId={activeTabId ?? null}
                        onSwitchTab={(id) => onSwitchFile?.(id)}
                        onCloseTab={(id) => onCloseTab?.(id)}
                        onCloseOtherTabs={onCloseOtherTabs}
                        onCloseAllTabs={onCloseAllTabs}
                        onCreateFile={onCreateFile}
                        onRenameFile={onRenameFile}
                        onDeleteFile={onDeleteFile}
                        saving={saving}
                        previewTabId={previewTabId}
                        onPinTab={onPinTab}
                        onDownloadFile={onDownloadFile}
                        isMaximized={isMaximized}
                    />
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                    <div className="flex items-center gap-1.5 mr-2">
                        {!isOnline && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <CloudOff className="w-3.5 h-3.5 text-muted-foreground/50" />
                                </TooltipTrigger>
                                <TooltipContent>Offline</TooltipContent>
                            </Tooltip>
                        )}
                        {hasPendingOperations && isOnline && !saving && (
                            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                        )}
                        {saving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                        {lastSaved && !saving && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Check className="w-3 h-3 text-muted-foreground/50" />
                                </TooltipTrigger>
                                <TooltipContent>Saved {lastSaved.toLocaleTimeString()}</TooltipContent>
                            </Tooltip>
                        )}
                    </div>

                    {isMaximized && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant={isSplit ? "secondary" : "ghost"}
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground"
                                >
                                    <Columns className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 z-[10000]">
                                <DropdownMenuLabel>Open in Split View</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem disabled={activeView === 'editor'} onClick={() => onSplitSelection('editor')}>
                                    <Code2 className="w-4 h-4 mr-2" />
                                    SQL Editor
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled={activeView === 'ai'} onClick={() => onSplitSelection('ai')}>
                                    <img src="/resona.png" alt="Resona AI" className="w-4 h-4 mr-2 object-contain" />
                                    Resona AI
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled={activeView === 'connect'} onClick={() => onSplitSelection('connect')}>
                                    <Plug className="w-4 h-4 mr-2" />
                                    Connections
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled={activeView === 'graph'} onClick={() => onSplitSelection('graph')}>
                                    <Network className="w-4 h-4 mr-2" />
                                    Schema Graph
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled={activeView === 'compiler'} onClick={() => onSplitSelection('compiler')}>
                                    <Cpu className="w-4 h-4 mr-2" />
                                    Compiler
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled={activeView === 'diff'} onClick={() => onSplitSelection('diff')}>
                                    <GitCompareArrows className="w-4 h-4 mr-2" />
                                    Schema Diff
                                </DropdownMenuItem>
                                {isSplit && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={onCloseSplit} className="text-red-600 focus:text-red-600">
                                            <X className="w-4 h-4 mr-2" />
                                            Close Split
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={onToggleMaximize}
                            >
                                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isMaximized ? "Exit Full Screen" : "Full Screen Mode"}</TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </div>
    );
}
