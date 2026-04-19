/**
 * fileTreeUtils.ts
 * 
 * Pure utility functions for file tree manipulation
 * No side effects, no hooks, pure functions
 */

import type { SqlFile } from '@/lib/file-management/api/client';

/**
 * Get all descendant IDs of a file in the tree (BFS)
 */
export function getDescendantIds(files: SqlFile[], rootId: string): Set<string> {
  const descendantIds = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const file of files) {
      if (file.parent_id === currentId && !descendantIds.has(file.id)) {
        descendantIds.add(file.id);
        queue.push(file.id);
      }
    }
  }
  return descendantIds;
}

/**
 * Find the workspace root ID for a file
 * Walks up the parent chain until root (parent_id === null)
 */
export function getWorkspaceRootId(files: SqlFile[], file: SqlFile): string | null {
  let cursor = file.parent_id ?? null;
  let rootId = cursor;

  while (cursor) {
    const parent = files.find(candidate => candidate.id === cursor);
    if (!parent?.parent_id) {
      rootId = parent?.id ?? cursor;
      break;
    }
    cursor = parent.parent_id;
    rootId = cursor;
  }

  return rootId;
}

/**
 * Sort workspace items: folders first, then by sort_order, then by title
 */
export function sortWorkspaceItems(a: SqlFile, b: SqlFile): number {
  if (a.is_folder && !b.is_folder) return -1;
  if (!a.is_folder && b.is_folder) return 1;

  const sortA = a.sort_order ?? 0;
  const sortB = b.sort_order ?? 0;
  if (sortA !== sortB) {
    return sortA - sortB;
  }

  return a.title.localeCompare(b.title);
}

/**
 * Order files for merge: depth-first traversal for proper SQL merging
 * Ensures parent files are processed before children
 */
export function orderFilesForMerge(files: SqlFile[]): SqlFile[] {
  const byParent = new Map<string | null, SqlFile[]>();

  // Group files by parent
  for (const file of files) {
    const key = file.parent_id ?? null;
    const siblings = byParent.get(key) ?? [];
    siblings.push(file);
    byParent.set(key, siblings);
  }

  // Sort each parent's children
  for (const siblings of byParent.values()) {
    siblings.sort(sortWorkspaceItems);
  }

  // DFS traversal to collect files in order
  const ordered: SqlFile[] = [];
  const visit = (parentId: string | null) => {
    const siblings = byParent.get(parentId) ?? [];
    for (const item of siblings) {
      if (item.is_folder) {
        visit(item.id);
      } else {
        ordered.push(item);
      }
    }
  };

  visit(null);
  return ordered;
}

/**
 * Get all non-folder descendants (leaf files only)
 */
export function getDescendantFiles(files: SqlFile[], rootId: string): SqlFile[] {
  const descendants = getDescendantIds(files, rootId);
  return files.filter(file => !file.is_folder && descendants.has(file.id));
}

/**
 * Check if a file is a descendant of another
 */
export function isDescendantOf(files: SqlFile[], childId: string, potentialParentId: string): boolean {
  const descendants = getDescendantIds(files, potentialParentId);
  return descendants.has(childId);
}

/**
 * Get the file tree branch from root to target file (breadcrumb trail)
 */
export function getFileTreeBranch(files: SqlFile[], fileId: string): SqlFile[] {
  const branch: SqlFile[] = [];
  let currentId: string | null = fileId;

  while (currentId) {
    const file = files.find(f => f.id === currentId);
    if (!file) break;
    branch.unshift(file);
    currentId = file.parent_id;
  }

  return branch;
}

/**
 * Type for file creation location specification
 */
export type CreateFileLocation =
  | string // parent_id
  | null // root level
  | {
      parent_id?: string | null;
      project_id?: string | null;
      file_extension?: string;
      connection_id?: string | null;
    };
