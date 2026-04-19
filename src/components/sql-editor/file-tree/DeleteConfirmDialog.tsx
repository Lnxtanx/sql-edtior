// =============================================================================
// DeleteConfirmDialog — Confirmation dialog before deleting files/folders
// Shows child count for folders to warn about cascade deletion
// =============================================================================

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { SqlFile } from '@/lib/file-management';

// =============================================================================
// Types
// =============================================================================

export interface DeleteConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The file/folder being deleted */
    file: SqlFile | null;
    /** All files (to count descendants for folder deletion) */
    files: SqlFile[];
    /** Called when user confirms deletion */
    onConfirm: (fileId: string) => void;
}

// =============================================================================
// Helpers
// =============================================================================

function countDescendants(folderId: string, files: SqlFile[]): number {
    let count = 0;
    const queue = [folderId];
    while (queue.length > 0) {
        const parentId = queue.shift()!;
        for (const f of files) {
            if (f.parent_id === parentId) {
                count++;
                if (f.is_folder) queue.push(f.id);
            }
        }
    }
    return count;
}

// =============================================================================
// Component
// =============================================================================

export function DeleteConfirmDialog({
    open,
    onOpenChange,
    file,
    files,
    onConfirm,
}: DeleteConfirmDialogProps) {
    if (!file) return null;

    const isFolder = file.is_folder;
    const childCount = isFolder ? countDescendants(file.id, files) : 0;

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Delete &ldquo;{file.title}&rdquo;?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {isFolder && childCount > 0 ? (
                            <>
                                This folder contains <strong>{childCount}</strong>{' '}
                                {childCount === 1 ? 'item' : 'items'} that will also be
                                permanently deleted.
                            </>
                        ) : (
                            'This action cannot be undone.'
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => {
                            onConfirm(file.id);
                            onOpenChange(false);
                        }}
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
