// =============================================================================
// CreateFileDialog — Name input dialog shown before creating a file
// Replaces the old "create first, rename inline" pattern
// =============================================================================

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { SqlFile } from '@/lib/file-management';

// =============================================================================
// Types
// =============================================================================

export interface CreateFileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Called when the user confirms creation */
    onConfirm: (name: string, extension: string, parentId: string | null) => void;
    /** Called when user creates a folder from a template */
    onConfirmTemplate?: (name: string, parentId: string | null, subfolders: string[]) => void;
    /** All files for building folder picker */
    files: SqlFile[];
    /** Pre-selected parent folder (e.g., from right-click context menu) */
    defaultParentId?: string | null;
    /** Whether this is a folder creation dialog */
    isFolder?: boolean;
}

// =============================================================================
// Supported Extensions
// =============================================================================

const FILE_EXTENSIONS = [
    { value: 'sql', label: '.sql' },
    { value: 'md', label: '.md' },
    { value: 'pgsql', label: '.pgsql' },
    { value: 'ddl', label: '.ddl' },
    { value: 'txt', label: '.txt' },
];

// =============================================================================
// Folder Templates
// =============================================================================

const FOLDER_TEMPLATES = [
    { value: 'none', label: 'Empty folder', subfolders: [] },
    { value: 'project', label: 'Database Project', subfolders: ['schema', 'migrations', 'seeds', 'queries'] },
    { value: 'microservice', label: 'Microservice', subfolders: ['tables', 'views', 'functions', 'triggers'] },
    { value: 'etl', label: 'ETL Pipeline', subfolders: ['extract', 'transform', 'load', 'staging'] },
];

// =============================================================================
// Component
// =============================================================================

export function CreateFileDialog({
    open,
    onOpenChange,
    onConfirm,
    onConfirmTemplate,
    files,
    defaultParentId = null,
    isFolder = false,
}: CreateFileDialogProps) {
    const [name, setName] = useState('');
    const [extension, setExtension] = useState('sql');
    const [parentId, setParentId] = useState<string | null>(defaultParentId);
    const [template, setTemplate] = useState('none');
    const inputRef = useRef<HTMLInputElement>(null);

    // Get folders for the location picker
    const folders = files.filter(f => f.is_folder);

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setName('');
            setExtension('sql');
            setParentId(defaultParentId);
            setTemplate('none');
            // Focus input after dialog animation
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open, defaultParentId]);

    const selectedTemplate = FOLDER_TEMPLATES.find(t => t.value === template);

    const handleConfirm = useCallback(() => {
        const trimmed = name.trim();
        if (!trimmed) return;
        if (isFolder && template !== 'none' && selectedTemplate && onConfirmTemplate) {
            onConfirmTemplate(trimmed, parentId, selectedTemplate.subfolders);
        } else {
            onConfirm(trimmed, isFolder ? '' : extension, parentId);
        }
        onOpenChange(false);
    }, [name, extension, parentId, isFolder, template, selectedTemplate, onConfirm, onConfirmTemplate, onOpenChange]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            }
        },
        [handleConfirm],
    );

    const isValid = name.trim().length > 0 && name.trim().length <= 255;

    // Check for duplicate name among siblings in the same folder
    const duplicateWarning = useMemo(() => {
        const trimmed = name.trim();
        if (!trimmed) return null;
        const fullName = isFolder ? trimmed : (extension ? `${trimmed}.${extension}` : trimmed);
        const siblings = files.filter(f => (f.parent_id || null) === parentId);
        const exists = siblings.some(f => f.title.toLowerCase() === fullName.toLowerCase());
        return exists ? `A ${isFolder ? 'folder' : 'file'} named "${fullName}" already exists here` : null;
    }, [name, extension, parentId, isFolder, files]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>{isFolder ? 'New Folder' : 'New File'}</DialogTitle>
                    <DialogDescription>
                        {isFolder
                            ? 'Enter a name for the new folder.'
                            : 'Enter a name and choose the file type.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-3">
                    {/* File name input with extension selector */}
                    <div className="grid gap-2">
                        <Label htmlFor="file-name">Name</Label>
                        <div className="flex gap-2">
                            <Input
                                ref={inputRef}
                                id="file-name"
                                placeholder={isFolder ? 'folder-name' : 'my-schema'}
                                value={name}
                                onChange={e => setName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="flex-1"
                                maxLength={255}
                                autoComplete="off"
                                spellCheck={false}
                            />
                            {!isFolder && (
                                <Select value={extension} onValueChange={setExtension}>
                                    <SelectTrigger className="w-24 flex-shrink-0">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FILE_EXTENSIONS.map(ext => (
                                            <SelectItem key={ext.value} value={ext.value}>
                                                {ext.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                        {duplicateWarning && (
                            <p className="text-xs text-amber-500">{duplicateWarning}</p>
                        )}
                    </div>

                    {/* Template picker (folders only) */}
                    {isFolder && onConfirmTemplate && (
                        <div className="grid gap-2">
                            <Label htmlFor="folder-template">Template (Optional)</Label>
                            <Select value={template} onValueChange={setTemplate}>
                                <SelectTrigger id="folder-template">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {FOLDER_TEMPLATES.map(t => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedTemplate && selectedTemplate.subfolders.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Creates: {selectedTemplate.subfolders.join(', ')}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Location picker */}
                    <div className="grid gap-2">
                        <Label htmlFor="file-location">Location</Label>
                        <Select
                            value={parentId ?? '__root__'}
                            onValueChange={v => setParentId(v === '__root__' ? null : v)}
                        >
                            <SelectTrigger id="file-location">
                                <SelectValue placeholder="Root" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__root__">/ (Root)</SelectItem>
                                {folders.map(folder => (
                                    <SelectItem key={folder.id} value={folder.id}>
                                        📁 {folder.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={!isValid}>
                        {isFolder ? 'Create Folder' : 'Create File'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
