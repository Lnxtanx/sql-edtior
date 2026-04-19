import type { Project, SqlFile } from '@/lib/file-management';

export interface FileTreeProps {
    /** All files in the project */
    files: SqlFile[];
    /** Currently active file ID */
    activeFileId?: string | null;
    /** Click on a file to open it */
    onFileClick: (fileId: string) => void;
    /** Double-click on a file to pin it (preview mode) */
    onFileDoubleClick?: (fileId: string) => void;
    /** Create a new file (with dialog — receives name, extension, parentId) */
    onCreateFile?: (name: string, extension: string, parentId: string | null) => void;
    /** Create a new file inside a specific folder (opens dialog with pre-set folder) */
    onCreateFileInFolder?: (parentId: string) => void;
    /** Create a new folder (with dialog — receives name, parentId) */
    onCreateFolder?: (name: string, parentId: string | null) => void;
    /** Open create dialog (lifted to parent for sharing with EditorTabBar) */
    onOpenCreateDialog?: (isFolder: boolean, parentId: string | null) => void;
    /** Rename a file/folder */
    onRenameFile?: (fileId: string, newTitle: string) => void;
    /** Delete a file/folder (now goes through confirm dialog) */
    onDeleteFile?: (fileId: string) => void;
    /** Move a file/folder */
    onMoveFile?: (fileId: string, parentId: string | null, sortOrder?: number) => void;
    /** Download current file */
    onDownloadFile?: () => void;
    /** Toggle sidebar visibility */
    onToggleSidebar?: () => void;
    /** Preview tab ID (for italic rendering) */
    previewTabId?: string | null;
    /** Whether it's guest mode (for capacity warnings) */
    isGuest?: boolean;
    /** Whether more files can be created */
    canCreateFile?: boolean;
    /** Selected file IDs for bulk operations */
    selectedFileIds?: Set<string>;
    /** Bulk selection toggle */
    onToggleSelection?: (fileId: string, shiftKey?: boolean) => void;
    /** Bulk delete */
    onBulkDelete?: (fileIds: string[]) => void;
    /** Active open tabs (for Open Editors section) */
    openTabs?: string[];
    /** Close an individual tab */
    onCloseTab?: (fileId: string) => void;
    /** Close all tabs */
    onCloseAllTabs?: () => void;
    /** Close other tabs */
    onCloseOtherTabs?: (fileId: string) => void;
    onBulkMove?: (fileIds: string[], parentId: string | null) => void;
    /** The active project root ID */
    activeRootId?: string | null;
    /** Close the active project and return to dashboard */
    onCloseProject?: () => void;
    /** Navigate to the workspace dashboard (close all tabs + project) */
    onGoToDashboard?: () => void;
    /** All projects from the API */
    apiProjects?: Project[];
    /** The active cloud project ID */
    activeProjectId?: string | null;
    /** The active project object */
    currentProject?: Project | null;
    /** Whether files are currently being fetched (shows skeleton) */
    isLoading?: boolean;
}

export interface TreeNode {
    file: SqlFile;
    children: TreeNode[];
    depth: number;
}

export interface TreeItemProps {
    node: TreeNode;
    activeFileId?: string | null;
    expandedFolders: Set<string>;
    onToggleFolder: (id: string) => void;
    onFileClick: (id: string) => void;
    onFileDoubleClick?: (id: string) => void;
    onRenameFile?: (id: string, title: string) => void;
    onDeleteFile?: (id: string) => void;
    onCreateFileInFolder?: (parentId: string) => void;
    onCreateFolder?: (title?: string, parentId?: string | null) => void;
    renamingId: string | null;
    renameValue: string;
    onStartRename: (file: SqlFile) => void;
    onRenameChange: (value: string) => void;
    onCommitRename: () => void;
    onCancelRename: () => void;
    onMoveFile?: (fileId: string, parentId: string | null) => void;
    previewTabId?: string | null;
    /** Whether this item is selected (for bulk operations) */
    isSelected?: boolean;
    /** Toggle selection callback */
    onToggleSelection?: (fileId: string, shiftKey?: boolean) => void;
    /** Whether bulk selection mode is active */
    selectionMode?: boolean;
    /** Show file size indicator */
    showFileSize?: boolean;
    /** Full selection set (for recursive children) */
    selectedFileIds?: Set<string>;
}
