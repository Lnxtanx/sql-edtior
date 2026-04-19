/**
 * Compute a line-level diff between two strings.
 *
 * Returns an array of DiffHunk objects, each representing
 * a contiguous block of added, removed, or unchanged lines.
 *
 * Uses a simple LCS-based diff (good enough for SQL files).
 */

export interface DiffHunk {
    type: 'add' | 'remove' | 'equal';
    fromA: number; // line number in original (0-based, inclusive)
    toA: number;   // line number in original (0-based, exclusive)
    fromB: number; // line number in proposed  (0-based, inclusive)
    toB: number;   // line number in proposed  (0-based, exclusive)
    lines?: string[]; // the actual lines (for removed hunks)
}

/**
 * Simple LCS-based diff. Returns hunks where:
 *  - type === 'equal' → unchanged lines
 *  - type === 'add'   → lines only in proposed
 *  - type === 'remove' → lines only in original
 */
export function lineDiff(original: string, proposed: string): DiffHunk[] {
    const origLines = original.split('\n');
    const propLines = proposed.split('\n');

    const m = origLines.length;
    const n = propLines.length;

    // Build LCS table
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (origLines[i - 1] === propLines[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // Backtrack to find diff
    const ops: Array<{ type: 'equal' | 'add' | 'remove'; line: string; origIdx: number; propIdx: number }> = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && origLines[i - 1] === propLines[j - 1]) {
            ops.unshift({ type: 'equal', line: origLines[i - 1], origIdx: i - 1, propIdx: j - 1 });
            i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= (dp[i - 1]?.[j] ?? 0))) {
            ops.unshift({ type: 'add', line: propLines[j - 1], origIdx: i, propIdx: j - 1 });
            j--;
        } else {
            ops.unshift({ type: 'remove', line: origLines[i - 1], origIdx: i - 1, propIdx: j });
            i--;
        }
    }

    // Group consecutive ops into hunks
    const hunks: DiffHunk[] = [];
    let current: DiffHunk | null = null;

    for (const op of ops) {
        if (!current || current.type !== op.type) {
            // Start new hunk
            if (current) hunks.push(current);
            current = {
                type: op.type,
                fromA: op.type === 'equal' || op.type === 'remove' ? op.origIdx : op.origIdx,
                toA: op.type === 'equal' || op.type === 'remove' ? op.origIdx + 1 : op.origIdx,
                fromB: op.type === 'equal' || op.type === 'add' ? op.propIdx : op.propIdx,
                toB: op.type === 'equal' || op.type === 'add' ? op.propIdx + 1 : op.propIdx,
                lines: op.type === 'remove' ? [op.line] : undefined,
            };
        } else {
            // Extend current hunk
            if (op.type === 'equal' || op.type === 'remove') current.toA++;
            if (op.type === 'equal' || op.type === 'add') current.toB++;
            if (op.type === 'remove') current.lines!.push(op.line);
        }
    }
    if (current) hunks.push(current);

    // Filter out 'equal' hunks — we only care about changes
    return hunks.filter(h => h.type !== 'equal');
}

/**
 * Count stats from diff hunks.
 */
export function diffStats(hunks: DiffHunk[]): { added: number; removed: number } {
    let added = 0, removed = 0;
    for (const h of hunks) {
        if (h.type === 'add') added += h.toB - h.fromB;
        if (h.type === 'remove') removed += h.toA - h.fromA;
    }
    return { added, removed };
}
