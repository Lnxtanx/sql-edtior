/**
 * Syntax Highlighted Editor
 * 
 * A robust code editor with syntax highlighting using CodeMirror.
 * Replaces the previous custom overlay implementation to fix text doubling issues.
 */

import { useCallback, useEffect, useRef, useMemo } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView, highlightActiveLine as highlightActiveLineExt } from '@codemirror/view';
import { sql } from '@codemirror/lang-sql';
import { bracketMatching as bracketMatchingExt, foldGutter as foldGutterExt } from '@codemirror/language';
import { Extension } from '@codemirror/state';
import { githubLight, githubDark } from '@uiw/codemirror-theme-github';
import { useTheme } from 'next-themes';
import { showMinimap as showMinimapExtension } from '@replit/codemirror-minimap';
import { cn } from '@/lib/utils';
import type { DiffHunk } from '@/lib/diff/computeLineDiff';
import { diffHighlightExtension, applyDiffToView, clearDiffFromView } from './diffHighlightExtension';

export interface SyntaxHighlightedEditorProps {
    /** SQL value */
    value: string;
    /** Change handler */
    onChange: (value: string) => void;
    /** Placeholder text */
    placeholder?: string;
    /** Whether editor is disabled */
    disabled?: boolean;
    /** Whether to show line numbers */
    showLineNumbers?: boolean;
    /** Whether to show minimap */
    showMinimap?: boolean;
    /** Whether to wrap lines */
    wordWrap?: boolean;
    /** Whether to highlight matching brackets */
    bracketMatching?: boolean;
    /** Whether to automatically close brackets/quotes */
    autoCloseBrackets?: boolean;
    /** Whether to show fold gutter */
    foldGutter?: boolean;
    /** Whether to highlight active line */
    highlightActiveLine?: boolean;
    /** Optional class name */
    className?: string;
    /** Optional paste handler */
    onPaste?: (e: React.ClipboardEvent) => void;
    /** Optional keydown handler */
    onKeyDown?: (e: React.KeyboardEvent) => void;
    /** Optional selection state */
    selection?: { anchor: number; head?: number };
    /** Optional diff hunks for AI changes (highlights added lines) */
    diffHunks?: DiffHunk[] | null;
}

export function SyntaxHighlightedEditor({
    value,
    onChange,
    placeholder = 'Enter PostgreSQL schema...',
    disabled = false,
    showLineNumbers = false,
    showMinimap = true,
    wordWrap = false,
    bracketMatching = true,
    autoCloseBrackets = true,
    foldGutter = false,
    highlightActiveLine = true,
    className,
    onPaste,
    onKeyDown,
    selection,
    diffHunks,
}: SyntaxHighlightedEditorProps) {
    const { theme } = useTheme();
    const editorRef = useRef<ReactCodeMirrorRef>(null);

    // Programmatically update selection and scroll into view when selection prop changes
    useEffect(() => {
        if (selection && editorRef.current?.view) {
            // Need a tiny timeout to ensure the view is fully ready if it just mounted/updated
            setTimeout(() => {
                const view = editorRef.current?.view;
                if (!view) return;

                // Dispatch selection and use scrollIntoView effect to align at the top
                view.dispatch({
                    selection: { anchor: selection.anchor, head: selection.head ?? selection.anchor },
                    effects: EditorView.scrollIntoView(selection.anchor, { y: 'start', yMargin: 50 })
                });
            }, 10);
        }
    }, [selection]);

    // Handle change
    const handleChange = useCallback(
        (val: string) => {
            onChange(val);
        },
        [onChange]
    );

    // Handle keydown
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (onKeyDown) {
            onKeyDown(e);
        }
    }, [onKeyDown]);

    // Apply diff highlighting when hunks change
    useEffect(() => {
        const view = editorRef.current?.view;
        if (!view) return;
        if (diffHunks && diffHunks.length > 0) {
            applyDiffToView(view, diffHunks);
        } else {
            clearDiffFromView(view);
        }
    }, [diffHunks]);

    const extensions = useMemo(() => {
        const ext: Extension[] = [sql()];

        // Diff highlight extension — always included, hunks updated via effect
        ext.push(...diffHighlightExtension());

        if (showMinimap) {
            ext.push(
                showMinimapExtension.of({
                    create: (_view) => {
                        const dom = document.createElement("div")
                        return { dom }
                    },
                    displayText: 'characters',
                    showOverlay: 'always',
                })
            );
        }

        if (wordWrap) {
            ext.push(EditorView.lineWrapping);
        }

        if (bracketMatching) {
            ext.push(bracketMatchingExt());
        }

        if (foldGutter) {
            ext.push(foldGutterExt());
        }

        if (highlightActiveLine) {
            ext.push(highlightActiveLineExt());
        }

        return ext;
    }, [showMinimap, wordWrap, bracketMatching, foldGutter, highlightActiveLine]);

    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-md border text-sm',
                'bg-background',
                className
            )}
            onKeyDown={handleKeyDown}
        >
            <style>
                {`
                /* Minimap Styles */
                .cm-minimap {
                    max-width: 50px !important;
                    opacity: 0.4;
                    transition: opacity 0.3s ease-in-out;
                    background-color: transparent !important;
                }
                .cm-minimap:hover {
                    opacity: 0.9;
                }
                .cm-minimap-gutter, .cm-gutters.cm-minimap-gutter {
                    background-color: transparent !important;
                }
                .cm-minimap-overlay {
                    background-color: hsl(var(--primary)) !important;
                    opacity: 0.1 !important;
                    border-radius: 4px;
                    border: 1px solid hsl(var(--primary) / 0.2);
                }
                .cm-minimap-overlay-container:hover .cm-minimap-overlay,
                .cm-minimap-overlay-active .cm-minimap-overlay {
                    background-color: hsl(var(--primary)) !important;
                    opacity: 0.2 !important;
                    border: 1px solid hsl(var(--primary) / 0.4);
                }
                
                /* Selection Highlight */
                .cm-activeLine {
                    background-color: hsl(var(--primary) / 0.03) !important;
                }
                .cm-activeLineGutter {
                    background-color: hsl(var(--primary) / 0.05) !important;
                    color: hsl(var(--primary)) !important;
                    font-weight: bold;
                }
                
                /* Fold Gutter */
                .cm-foldGutter {
                    width: 14px;
                    padding-right: 2px;
                }
                .cm-gutters {
                    border-right: 1px solid hsl(var(--border) / 0.3) !important;
                    background-color: transparent !important;
                    color: hsl(var(--muted-foreground) / 0.5) !important;
                }
                .cm-lineNumbers .cm-gutterElement {
                    padding: 0 8px 0 4px !important;
                }
                
                /* CodeMirror general overrides */
                .cm-editor {
                    background-color: transparent !important;
                }
                .cm-scroller {
                    font-family: inherit !important;
                }
                .cm-content {
                    padding: 12px 0 !important;
                }
                .cm-placeholder {
                    color: hsl(var(--muted-foreground) / 0.4) !important;
                    font-style: italic;
                }
                `}
            </style>
            <CodeMirror
                ref={editorRef}
                value={value}
                height="100%"
                theme={theme === 'dark' ? githubDark : githubLight}
                extensions={extensions}
                onChange={handleChange}
                editable={!disabled}
                placeholder={placeholder}
                basicSetup={{
                    lineNumbers: showLineNumbers,
                    bracketMatching: false, // Managed manually
                    foldGutter: false, // Managed manually
                    highlightActiveLine: false, // Managed manually
                    dropCursor: false,
                    allowMultipleSelections: false,
                    indentOnInput: false,
                    closeBrackets: autoCloseBrackets,
                    autocompletion: true,
                }}
                className="h-full font-mono text-sm"
            />
        </div>
    );
}
