/**
 * CodeMirror extension for highlighting added lines (AI changes).
 *
 * When the AI modifies a file, this extension highlights the added
 * lines with a green background and a "+" gutter marker.
 */

import { EditorView, Decoration, type DecorationSet, gutter, GutterMarker } from '@codemirror/view';
import { StateEffect, StateField, type Extension } from '@codemirror/state';
import type { DiffHunk } from '@/lib/diff/computeLineDiff';

// ── State effect: set the added-line ranges ──────────────────────────────

export const setDiffHunks = StateEffect.define<DiffHunk[] | null>();

// ── State field: track current diff hunks ────────────────────────────────

const diffHunksField = StateField.define<DiffHunk[]>({
    create() { return []; },
    update(value, tr) {
        for (const eff of tr.effects) {
            if (eff.is(setDiffHunks)) return eff.value ?? [];
        }
        return value;
    },
});

// ── Line decorations for added lines ─────────────────────────────────────

const addedLineDeco = Decoration.line({ attributes: { class: 'cm-ai-added-line' } });

function buildDeco(state: { doc: { line: (n: number) => { from: number } } }, hunks: DiffHunk[]): DecorationSet {
    let decorations = Decoration.none;
    for (const h of hunks) {
        if (h.type !== 'add') continue;
        for (let lineNum = h.fromB + 1; lineNum <= h.toB; lineNum++) {
            try {
                const line = state.doc.line(lineNum);
                decorations = decorations.update({
                    add: [addedLineDeco.range(line.from, line.from)],
                    filter: () => true,
                });
            } catch {
                // line out of range
            }
        }
    }
    return decorations;
}

const diffLineDecorations = StateField.define<DecorationSet>({
    create() { return Decoration.none; },
    update(value, tr) {
        value = value.map(tr.changes);
        for (const eff of tr.effects) {
            if (eff.is(setDiffHunks)) {
                return buildDeco(tr.state, eff.value ?? []);
            }
        }
        return value;
    },
    provide: f => EditorView.decorations.from(f),
});

// ── Gutter markers ───────────────────────────────────────────────────────

class PlusMarker extends GutterMarker {
    toDOM() {
        const el = document.createElement('div');
        el.className = 'cm-ai-gutter-marker';
        el.textContent = '+';
        return el;
    }
}

const diffGutterExt = gutter({
    class: 'cm-ai-gutter',
    lineMarker(view) {
        const hunks = view.state.field(diffHunksField);
        const markers: Array<{ line: number; marker: GutterMarker }> = [];
        const plusMarker = new PlusMarker();
        for (const h of hunks) {
            if (h.type === 'add') {
                for (let lineNum = h.fromB + 1; lineNum <= h.toB; lineNum++) {
                    markers.push({ line: lineNum, marker: plusMarker });
                }
            }
        }
        return markers;
    },
    lineMarkerChange(update) {
        return update.state.field(diffHunksField) !== update.startState.field(diffHunksField);
    },
});

// ── CSS (one-time injection) ─────────────────────────────────────────────

const AI_DIFF_CSS = `
.cm-ai-added-line {
    background: rgba(34, 197, 94, 0.12) !important;
}
.cm-ai-gutter-marker {
    color: #22c55e;
    font-weight: bold;
    font-family: monospace;
    font-size: 12px;
    padding-left: 4px;
}
.cm-ai-gutter {
    padding-left: 4px;
}
`;

let cssInjected = false;
function ensureCss() {
    if (cssInjected) return;
    const style = document.createElement('style');
    style.textContent = AI_DIFF_CSS;
    document.head.appendChild(style);
    cssInjected = true;
}

// ── Public API ───────────────────────────────────────────────────────────

export function diffHighlightExtension(): Extension[] {
    ensureCss();
    return [
        diffHunksField,
        diffLineDecorations,
        diffGutterExt,
    ];
}

/**
 * Apply diff highlighting to an existing CodeMirror view.
 */
export function applyDiffToView(view: EditorView | undefined, hunks: DiffHunk[] | null): void {
    if (!view) return;
    view.dispatch({ effects: [setDiffHunks.of(hunks)] });
}

/**
 * Clear diff highlighting from a CodeMirror view.
 */
export function clearDiffFromView(view: EditorView | undefined): void {
    if (!view) return;
    view.dispatch({ effects: [setDiffHunks.of(null)] });
}
