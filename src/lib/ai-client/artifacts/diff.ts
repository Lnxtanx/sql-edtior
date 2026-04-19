/**
 * SQL Diff helpers — pure logic, no UI.
 * Compares original vs modified SQL and produces structured diff chunks
 * that the DiffView UI component can render and apply.
 */

import { ArtifactItem } from './types';

export type DiffLineKind = 'unchanged' | 'added' | 'removed';

export interface DiffLine {
  kind:    DiffLineKind;
  content: string;
  lineNo?: number;
}

export interface DiffChunk {
  heading:  string;
  lines:    DiffLine[];
}

export interface DiffResult {
  chunks:   DiffChunk[];
  addCount: number;
  delCount: number;
  hasChanges: boolean;
}

/**
 * Produce a line-by-line diff between original and modified SQL.
 * Simple LCS-based diff — sufficient for SQL output (short, structured).
 */
export function diffSQL(original: string, modified: string): DiffResult {
  const origLines = original.split('\n');
  const modLines  = modified.split('\n');

  const lines: DiffLine[] = [];
  let addCount = 0;
  let delCount = 0;

  // LCS via dynamic programming
  const m = origLines.length;
  const n = modLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origLines[i - 1] === modLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  let i = m, j = n;
  const result: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === modLines[j - 1]) {
      result.unshift({ kind: 'unchanged', content: origLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ kind: 'added',   content: modLines[j - 1] });
      addCount++;
      j--;
    } else {
      result.unshift({ kind: 'removed', content: origLines[i - 1] });
      delCount++;
      i--;
    }
  }

  lines.push(...result);

  return {
    chunks:     [{ heading: 'Changes', lines }],
    addCount,
    delCount,
    hasChanges: addCount > 0 || delCount > 0,
  };
}

/**
 * Build a DiffResult from an ArtifactItem of kind 'diff' or 'sql'.
 * - For 'diff' artifacts: uses original + modified fields directly.
 * - For 'sql' artifacts: treats content as the new SQL, original as empty.
 */
export function artifactToDiff(artifact: ArtifactItem): DiffResult {
  if (artifact.kind === 'diff' && artifact.original != null && artifact.modified != null) {
    return diffSQL(artifact.original, artifact.modified);
  }
  // New SQL with no prior content — show as fully added
  return diffSQL(artifact.original ?? '', artifact.content);
}

/**
 * Apply a diff to the current editor SQL.
 * For SQL artifacts: replaces the editor content with the artifact's SQL.
 * For diff artifacts: uses the modified field.
 */
export function applyArtifact(artifact: ArtifactItem, _currentSQL: string): string {
  if (artifact.kind === 'diff') {
    return artifact.modified ?? artifact.content;
  }
  return artifact.content;
}
