/**
 * File Picker Component
 * 
 * Popover for selecting, creating, renaming, and deleting SQL files.
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    ChevronDown, FileText, Plus, MoreHorizontal,
    Check, Pencil, Trash2, Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SqlFile } from '@/lib/file-management';
import { UseFilePickerReturn } from '@/lib/file-management/hooks/useFilePicker';


export interface FilePickerProps extends UseFilePickerReturn {
    files: SqlFile[];
    currentFile?: SqlFile | null;
    onCreateFile?: () => void;
    onRenameFile?: (fileId: string, newTitle: string) => void;
    onDeleteFile?: (fileId: string) => void;
}

export function FilePicker({
    files,
    currentFile,
    isOpen,
    setIsOpen,
    renamingFileId,
    renameValue,
    setRenameValue,
    showShortcuts,
    setShowShortcuts,
    fileInputRef,
    startRename,
    cancelRename,
    confirmRename,
    handleFileImport,
    handleSelectFile,
    onCreateFile,
    onRenameFile,
    onDeleteFile,
}: FilePickerProps) {
    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-sm font-semibold text-foreground hover:bg-slate-100 gap-1"
                >
                    <span className="max-w-[120px] truncate">
                        {currentFile?.title || 'Untitled Schema'}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-72 p-1" align="start">
                {/* Hidden file input for import */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".sql,.txt,.ddl,.pgsql,.psql"
                    onChange={handleFileImport}
                    className="hidden"
                />

                {/* Header */}
                <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 mb-1">
                    <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                        Your Files
                    </span>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] gap-1"
                            onClick={() => fileInputRef.current?.click()}
                            title="Open local file (Ctrl+O)"
                        >
                            <Upload className="w-3 h-3" />
                            Import
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 px-1.5 text-[10px] gap-1"
                            onClick={() => {
                                onCreateFile?.();
                                setIsOpen(false);
                            }}
                            title="New file (Ctrl+N)"
                        >
                            <Plus className="w-3 h-3" />
                            New
                        </Button>
                    </div>
                </div>

                {/* File List */}
                <div className="max-h-[200px] overflow-y-auto">
                    {files.length === 0 ? (
                        <div className="px-2 py-3 text-center text-xs text-slate-400">
                            No saved files yet
                        </div>
                    ) : (
                        files.map((file) => (
                            <div
                                key={file.id}
                                className={cn(
                                    "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group",
                                    file.id === currentFile?.id
                                        ? "bg-blue-50 text-blue-700"
                                        : "hover:bg-slate-50"
                                )}
                                onDoubleClick={() => startRename(file.id, file.title)}
                            >
                                {renamingFileId === file.id ? (
                                    <Input
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                confirmRename(file.id);
                                            } else if (e.key === 'Escape') {
                                                cancelRename();
                                            }
                                        }}
                                        onBlur={() => {
                                            if (renameValue.trim()) {
                                                confirmRename(file.id);
                                            } else {
                                                cancelRename();
                                            }
                                        }}
                                        className="h-5 text-xs flex-1"
                                        autoFocus
                                    />
                                ) : (
                                    <>
                                        <FileText className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                                        <span
                                            className="flex-1 text-xs truncate"
                                            onClick={() => handleSelectFile(file.id)}
                                            title="Double-click to rename"
                                        >
                                            {file.title}
                                        </span>
                                        {file.id === currentFile?.id && (
                                            <Check className="w-3 h-3 text-blue-500" />
                                        )}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <MoreHorizontal className="w-3 h-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-36">
                                                <DropdownMenuItem
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        startRename(file.id, file.title);
                                                    }}
                                                >
                                                    <Pencil className="w-3 h-3 mr-2" />
                                                    Rename
                                                    <span className="ml-auto text-[9px] text-slate-400">F2</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="text-red-600"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteFile?.(file.id);
                                                    }}
                                                >
                                                    <Trash2 className="w-3 h-3 mr-2" />
                                                    Delete
                                                    <span className="ml-auto text-[9px] text-slate-400">⇧⌘D</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

