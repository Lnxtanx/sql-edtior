/**
 * SqlDiffViewer
 *
 * Side-by-side or unified SQL diff viewer using CodeMirror MergeView.
 * Shows original (live DB) and modified (local file) with premium diff highlights.
 * Optionally supports accept/reject merge controls for reviewing AI-proposed changes.
 */

import { useEffect, useRef, useState, memo } from 'react';
import { MergeView, unifiedMergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { sql } from '@codemirror/lang-sql';
import { githubLight, githubDark } from '@uiw/codemirror-theme-github';
import { useTheme } from 'next-themes';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SqlDiffViewerProps {
    /** Original SQL — left side (live database) */
    original: string;
    /** Modified SQL — right side (local file) */
    modified: string;
    /** Diff layout: left-right split or inline unified */
    layout?: 'split' | 'unified';
    /** When true, shows accept/reject arrows on each hunk (Cursor-style review) */
    enableMergeControls?: boolean;
    /** Callback with the final merged content when user accepts changes */
    onAcceptAll?: (mergedContent: string) => void;
    /** Optional CSS class */
    className?: string;
}

export const SqlDiffViewer = memo(function SqlDiffViewer({
    original, modified, layout = 'unified',
    enableMergeControls = false,
    onAcceptAll,
    className,
}: SqlDiffViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MergeView | EditorView | null>(null);
    const mergeViewRef = useRef<MergeView | null>(null);
    const { theme } = useTheme();
    const [isRendering, setIsRendering] = useState(true);

    useEffect(() => {
        if (!containerRef.current) return;

        setIsRendering(true);

        const timer = setTimeout(() => {
            if (!containerRef.current) return;

            // Destroy previous instance
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
            }

            const isDark = theme === 'dark';
            const cmTheme = isDark ? githubDark : githubLight;

            if (layout === 'split') {
                const sharedExtensions = [
                    sql(),
                    cmTheme,
                    EditorView.editable.of(false),
                    EditorState.readOnly.of(true),
                    EditorView.lineWrapping,
                ];

                const mergeView = new MergeView({
                    parent: containerRef.current,
                    a: {
                        doc: original,
                        extensions: sharedExtensions,
                    },
                    b: {
                        doc: modified,
                        extensions: sharedExtensions,
                    },
                    collapseUnchanged: { margin: 3, minSize: 4 },
                    gutter: true,
                });
                viewRef.current = mergeView;
                mergeViewRef.current = mergeView;
            } else {
                // Unified (inline) view
                const baseExtensions = [
                    sql(),
                    cmTheme,
                    EditorView.lineWrapping,
                ];

                // When merge controls are enabled, the editor becomes editable
                const isEditable = enableMergeControls;

                const unifiedExtensions = [
                    ...baseExtensions,
                    ...(isEditable ? [] : [
                        EditorView.editable.of(false),
                        EditorState.readOnly.of(true),
                    ]),
                    unifiedMergeView({
                        original: original,
                        syntaxHighlightDeletions: false,
                        mergeControls: isEditable,
                    }),
                ];

                const editorView = new EditorView({
                    parent: containerRef.current,
                    doc: modified,
                    extensions: unifiedExtensions,
                });
                viewRef.current = editorView;
                mergeViewRef.current = null;
            }

            setIsRendering(false);
        }, 50);

        return () => {
            clearTimeout(timer);
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
            }
            mergeViewRef.current = null;
        };
    }, [original, modified, layout, theme, enableMergeControls]);

    const handleAcceptAll = () => {
        if (!viewRef.current || !onAcceptAll) return;
        const content = viewRef.current.state.doc.toString();
        onAcceptAll(content);
    };

    return (
        <div className={cn("relative h-full w-full overflow-hidden flex flex-col", className)}>
            {/* Merge controls toolbar */}
            {enableMergeControls && onAcceptAll && (
                <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/40 shrink-0">
                    <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">
                        Review changes — accept or reject each hunk
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleAcceptAll}
                            className="text-[10px] px-2.5 py-1 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors font-medium"
                        >
                            Accept All & Apply
                        </button>
                    </div>
                </div>
            )}

            {isRendering && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px]">
                    <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-background/80 shadow-sm border border-border">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground font-medium">Computing diff...</span>
                    </div>
                </div>
            )}
            <div
                ref={containerRef}
                className={cn(
                    'h-full w-full flex flex-col',
                    '[&_.cm-mergeView]:h-full [&_.cm-mergeView]:flex-1',
                    '[&_.cm-editor]:h-full [&_.cm-editor]:flex-1',

                    // Panel headers (Split View only)
                    '[&_.cm-mergeViewEditor]:flex-1 [&_.cm-mergeViewEditor]:min-w-0',

                    // --- Premium Diff Colors ---
                    // Inline bold changes
                    '[&_.cm-changedText]:!bg-yellow-200/50 dark:[&_.cm-changedText]:!bg-yellow-500/30',

                    // Split View Chunks
                    '[&_.cm-changedLine]:!bg-blue-50/50 dark:[&_.cm-changedLine]:!bg-blue-900/10',
                    '[&_.cm-deletedChunk]:!bg-red-500/10 dark:[&_.cm-deletedChunk]:!bg-red-500/20',
                    '[&_.cm-deletedChunk]:border-l-[3px] [&_.cm-deletedChunk]:border-l-red-500',
                    '[&_.cm-insertedChunk]:!bg-green-500/10 dark:[&_.cm-insertedChunk]:!bg-green-500/20',
                    '[&_.cm-insertedChunk]:border-l-[3px] [&_.cm-insertedChunk]:border-l-green-500',

                    // Unified View Lines
                    '[&_.cm-deletedLine]:!bg-red-500/10 dark:[&_.cm-deletedLine]:!bg-red-500/20',
                    '[&_.cm-deletedLine_.cm-gutterElement]:!bg-red-500/10 [&_.cm-deletedLine_.cm-gutterElement]:!text-red-600 dark:[&_.cm-deletedLine_.cm-gutterElement]:!text-red-400',
                    '[&_.cm-insertedLine]:!bg-green-500/10 dark:[&_.cm-insertedLine]:!bg-green-500/20',
                    '[&_.cm-insertedLine_.cm-gutterElement]:!bg-green-500/10 [&_.cm-insertedLine_.cm-gutterElement]:!text-green-600 dark:[&_.cm-insertedLine_.cm-gutterElement]:!text-green-400',

                    // Diff gutters
                    '[&_.cm-mergeGutter]:border-x [&_.cm-mergeGutter]:border-border',

                    // Unified deleted line content (red only, no strike-through)
                    '[&_.cm-deletedText]:text-red-600 dark:[&_.cm-deletedText]:text-red-400 [&_.cm-deletedText]:!no-underline [&_.cm-deletedText]:!decoration-0',

                    // Unified inserted/changed text (green only, no underline)
                    '[&_.cm-insertedText]:text-green-600 dark:[&_.cm-insertedText]:text-green-400 [&_.cm-insertedText]:!no-underline [&_.cm-insertedText]:!decoration-0',

                    // Fonts and spacing
                    '[&_.cm-scroller]:font-mono [&_.cm-scroller]:text-[13px] [&_.cm-scroller]:leading-relaxed',
                    // Scrollbar
                    '[&_.cm-scroller]:scrollbar-thin'
                )}
            />
        </div>
    );
});
