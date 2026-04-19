/**
 * useFilePicker Hook
 * 
 * Manages file picker state for the SQL editor including
 * file selection, renaming, and keyboard shortcuts.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { SqlFile } from '../api/client';

export interface UseFilePickerOptions {
    /** List of available files */
    files: SqlFile[];
    /** Currently active file */
    currentFile?: SqlFile | null;
    /** Callback to switch to a file */
    onSwitchFile?: (fileId: string) => void;
    /** Callback to create a new file */
    onCreateFile?: () => void;
    /** Callback to rename a file */
    onRenameFile?: (fileId: string, newTitle: string) => void;
    /** Callback to delete a file */
    onDeleteFile?: (fileId: string) => void;
    /** Callback to import file content */
    onImportFile?: (content: string, fileName: string) => void;
    /** Callback to manually save */
    onManualSave?: (content?: string) => void;
    /** Callback to close current tab (Ctrl+W) */
    onCloseTab?: (fileId: string) => void;
    /** Callback to download current file */
    onDownloadFile?: () => void;
    /** Open tabs for Ctrl+Tab cycling */
    openTabs?: string[];
}

export interface UseFilePickerReturn {
    /** Whether the file picker popover is open */
    isOpen: boolean;
    /** Set whether the file picker is open */
    setIsOpen: (open: boolean) => void;
    /** ID of the file being renamed (null if not renaming) */
    renamingFileId: string | null;
    /** Current rename input value */
    renameValue: string;
    /** Set rename value */
    setRenameValue: (value: string) => void;
    /** Whether keyboard shortcuts help is shown */
    showShortcuts: boolean;
    /** Toggle shortcuts display */
    setShowShortcuts: (show: boolean) => void;
    /** Ref for the hidden file input */
    fileInputRef: React.RefObject<HTMLInputElement>;
    /** Start renaming a file */
    startRename: (fileId: string, currentTitle: string) => void;
    /** Cancel renaming */
    cancelRename: () => void;
    /** Confirm rename */
    confirmRename: (fileId: string) => void;
    /** Handle file import from input */
    handleFileImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
    /** Handle file selection */
    handleSelectFile: (fileId: string) => void;
}

/**
 * Hook for managing file picker state
 */
export function useFilePicker(options: UseFilePickerOptions): UseFilePickerReturn {
    const {
        files,
        currentFile,
        onSwitchFile,
        onCreateFile,
        onRenameFile,
        onDeleteFile,
        onImportFile,
        onManualSave,
        onCloseTab,
        onDownloadFile,
        openTabs,
    } = options;

    const [isOpen, setIsOpen] = useState(false);
    const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [showShortcuts, setShowShortcuts] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Start renaming a file
    const startRename = useCallback((fileId: string, currentTitle: string) => {
        setRenameValue(currentTitle);
        setRenamingFileId(fileId);
    }, []);

    // Cancel renaming
    const cancelRename = useCallback(() => {
        setRenamingFileId(null);
        setRenameValue('');
    }, []);

    // Confirm rename
    const confirmRename = useCallback((fileId: string) => {
        if (renameValue.trim()) {
            onRenameFile?.(fileId, renameValue.trim());
        }
        setRenamingFileId(null);
        setRenameValue('');
    }, [renameValue, onRenameFile]);

    // Handle file import
    const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedExtensions = ['.sql', '.txt', '.ddl', '.pgsql', '.psql'];
        const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

        if (!allowedExtensions.includes(fileExt)) {
            toast.error('Invalid file type', {
                description: 'Please select a .sql, .txt, .ddl, .pgsql, or .psql file',
            });
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                const fileName = file.name.replace(/\.[^/.]+$/, '');
                onImportFile?.(content, fileName);
                toast.success(`Imported "${file.name}"`, {
                    description: 'File content loaded into editor',
                });
                setIsOpen(false);
            }
        };
        reader.onerror = () => {
            toast.error('Failed to read file');
        };
        reader.readAsText(file);

        // Reset input so same file can be selected again
        e.target.value = '';
    }, [onImportFile]);

    // Handle file selection
    const handleSelectFile = useCallback((fileId: string) => {
        if (fileId !== currentFile?.id) {
            onSwitchFile?.(fileId);
            setIsOpen(false);
        }
    }, [currentFile?.id, onSwitchFile]);

    // Global keyboard shortcuts
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

            // Ctrl/Cmd + N: New file
            if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.shiftKey) {
                e.preventDefault();
                onCreateFile?.();
            }

            // Ctrl/Cmd + O: Open local file
            if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
                e.preventDefault();
                fileInputRef.current?.click();
            }

            // Ctrl/Cmd + S: Manual save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                onManualSave?.();
            }

            // Ctrl/Cmd + W: Close current tab
            if ((e.ctrlKey || e.metaKey) && e.key === 'w' && !e.shiftKey) {
                e.preventDefault();
                if (currentFile) {
                    onCloseTab?.(currentFile.id);
                }
            }

            // Ctrl/Cmd + Shift + S: Download/export current file
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
                e.preventDefault();
                onDownloadFile?.();
            }

            // Ctrl + Tab: Cycle to next tab
            if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey && openTabs && openTabs.length > 1 && currentFile) {
                e.preventDefault();
                const currentIndex = openTabs.indexOf(currentFile.id);
                const nextIndex = (currentIndex + 1) % openTabs.length;
                onSwitchFile?.(openTabs[nextIndex]);
            }

            // Ctrl + Shift + Tab: Cycle to previous tab
            if (e.ctrlKey && e.shiftKey && e.key === 'Tab' && openTabs && openTabs.length > 1 && currentFile) {
                e.preventDefault();
                const currentIndex = openTabs.indexOf(currentFile.id);
                const prevIndex = (currentIndex - 1 + openTabs.length) % openTabs.length;
                onSwitchFile?.(openTabs[prevIndex]);
            }

            // Ctrl/Cmd + Shift + D: Delete current file (only if not in input)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D' && !isInputFocused) {
                e.preventDefault();
                if (currentFile) {
                    onDeleteFile?.(currentFile.id);
                }
            }

            // F2: Rename current file
            if (e.key === 'F2' && !isInputFocused && currentFile) {
                e.preventDefault();
                startRename(currentFile.id, currentFile.title);
                setIsOpen(true);
            }

            // Ctrl/Cmd + /: Show shortcuts help
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                setShowShortcuts(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [onCreateFile, onManualSave, onDeleteFile, onCloseTab, onDownloadFile, currentFile, startRename, openTabs, onSwitchFile]);

    return {
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
    };
}
