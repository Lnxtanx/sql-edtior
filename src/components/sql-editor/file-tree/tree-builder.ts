import type { SqlFile } from '@/lib/file-management';
import type { TreeNode } from './types';

function sortItems(a: SqlFile, b: SqlFile): number {
    if (a.is_folder && !b.is_folder) return -1;
    if (!a.is_folder && b.is_folder) return 1;
    if ((a.sort_order ?? 0) !== (b.sort_order ?? 0)) {
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    }
    return a.title.localeCompare(b.title);
}

export function buildTree(files: SqlFile[]): TreeNode[] {
    const childrenOf = (parentId: string) =>
        files.filter(f => f.parent_id === parentId);

    function buildNode(file: SqlFile, depth: number): TreeNode {
        const kids = childrenOf(file.id)
            .sort(sortItems)
            .map(child => buildNode(child, depth + 1));
        return { file, children: kids, depth };
    }

    return files
        .filter(f => !f.parent_id)
        .sort(sortItems)
        .map(f => buildNode(f, 0));
}
