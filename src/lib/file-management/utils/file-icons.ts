// =============================================================================
// File Icons Utility
// Maps file extensions to Lucide icons and colors for the tab bar + file tree
// =============================================================================

import {
    Database,
    FileText,
    Code,
    File,
    Folder,
    FolderOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface FileIconResult {
    icon: LucideIcon;
    color: string;       // CSS color class
    label: string;       // Human-readable label
}

// =============================================================================
// Extension Map
// =============================================================================

const EXTENSION_MAP: Record<string, FileIconResult> = {
    sql: { icon: Database, color: 'text-blue-400', label: 'SQL' },
    pgsql: { icon: Database, color: 'text-emerald-400', label: 'PostgreSQL' },
    psql: { icon: Database, color: 'text-emerald-400', label: 'PostgreSQL' },
    ddl: { icon: Code, color: 'text-purple-400', label: 'DDL' },
    txt: { icon: FileText, color: 'text-gray-400', label: 'Text' },
};

// =============================================================================
// Functions
// =============================================================================

/**
 * Get the icon config for a file based on its extension.
 */
export function getFileIcon(extension?: string): FileIconResult {
    if (!extension) {
        return { icon: Database, color: 'text-blue-400', label: 'SQL' };
    }

    const ext = extension.toLowerCase().replace(/^\./, '');
    return EXTENSION_MAP[ext] || { icon: File, color: 'text-gray-400', label: ext.toUpperCase() };
}

/**
 * Get the icon config for a folder.
 */
export function getFolderIcon(isOpen: boolean = false): FileIconResult {
    return {
        icon: isOpen ? FolderOpen : Folder,
        color: 'text-amber-400',
        label: 'Folder',
    };
}

/**
 * Extract file extension from a filename.
 * Returns the extension without the dot, or 'sql' as default.
 */
export function extractExtension(filename: string): string {
    const match = filename.match(/\.([a-zA-Z0-9]{1,10})$/);
    return match ? match[1].toLowerCase() : 'sql';
}

/**
 * Get display name without extension for cleaner tab labels.
 */
export function getDisplayName(filename: string): string {
    return filename.replace(/\.[a-zA-Z0-9]{1,10}$/, '');
}
