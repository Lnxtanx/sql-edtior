import { SyntaxHighlightedEditor } from './SyntaxHighlightedEditor';
import { SqlEditorToolbar } from './SqlEditorToolbar';
import { MarkdownText } from '@/components/ai-panel/MarkdownText';
import React, { useState } from 'react';
import { ParsedSchema } from '@/lib/sql-parser';
import { SchemaAnalysis } from '@/lib/schema-utils/schema-analysis';
import { CompilationResult } from '@/lib/schema-compiler/types';
import { FormatterResult } from '@/lib/schema-utils/sql-formatter';
import { Dashboard } from './Dashboard';
import type { Project, SqlFile } from '@/lib/file-management';
import type { RecentFile } from '@/lib/cookies';
import type { DiffHunk } from '@/lib/diff/computeLineDiff';
import { useEditorSettings } from '../settings/EditorSettingsContext';

export interface SqlEditorPanelProps {
    // Editor State
    sql: string;
    onSqlChange: (sql: string) => void;
    isProcessing: boolean;
    isReadOnly?: boolean;
    schema: ParsedSchema | null;
    analysis: SchemaAnalysis | null;
    compilation?: CompilationResult | null;
    formatResult: FormatterResult | null;
    onFormat: () => void;
    onGenerate: () => void;
    onClear: () => void;
    onCopy: () => void;
    onPaste?: (e: React.ClipboardEvent) => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    onApplySQL?: (sql: string) => void;

    // Actions
    onOpenAI: () => void;
    searchQuery?: string;
    hasOpenTabs?: boolean;
    onCreateFileClick?: () => void;

    // File context (for markdown rendering)
    activeFile?: SqlFile | null;

    // Dashboard props
    files?: SqlFile[];
    recentFiles?: RecentFile[];
    activeRootId?: string | null;
    activeProjectId?: string | null;
    onSetActiveRootId?: (id: string | null) => void;
    onSetActiveProjectId?: (id: string | null) => void;
    onOpenProject?: (rootId: string | null, projectId?: string | null) => void;
    onOpenFileClick?: (id: string) => void;
    onCreateProject?: () => void;
    onDeleteProject?: (id: string) => void;
    isGuest?: boolean;
    apiProjects?: Project[];

    // Diff highlighting for AI changes
    diffHunks?: DiffHunk[] | null;
}

/** Check if the file extension indicates a markdown file */
function isMarkdownFile(file: SqlFile | null | undefined, content: string): boolean {
    if (file) {
        const ext = (file.file_extension || '').toLowerCase();
        if (ext === 'md' || ext === 'markdown') return true;
        // Fallback: check the title for .md extension
        const titleExt = file.title.includes('.') ? file.title.split('.').pop()?.toLowerCase() : '';
        if (titleExt === 'md' || titleExt === 'markdown') return true;
    }
    // Content-based heuristic: if it looks like markdown and NOT like SQL
    if (content.trim().length > 0) {
        const trimmed = content.trim();
        // Starts with markdown heading or table, not SQL keywords
        const isMarkdownLike =
            /^#{1,6}\s/.test(trimmed) ||           // # heading
            /^\|[^|]+\|\s*\n/.test(trimmed) ||      // | table | header |
            /^\*\*[^*]+\*\*/.test(trimmed) ||       // **bold**
            /^\*[^*]+\*/.test(trimmed) ||           // *italic*
            /^>\s/.test(trimmed) ||                 // > blockquote
            /^[-*]\s/.test(trimmed) ||              // - list item
            /^\d+\.\s/.test(trimmed);               // 1. ordered list

        const isSqlLike =
            /^(create|select|insert|update|delete|alter|drop|with)\s/i.test(trimmed);

        return isMarkdownLike && !isSqlLike;
    }
    return false;
}

export function SqlEditorPanel(props: SqlEditorPanelProps) {
    const {
        sql,
        onSqlChange,
        isProcessing,
        isReadOnly,
        schema,
        analysis,
        formatResult,
        onFormat,
        onGenerate,
        onClear,
        onCopy,
        onPaste,
        onKeyDown,
        onOpenAI,
        searchQuery,
        hasOpenTabs = true,
        onCreateFileClick,
        activeFile,
        files = [],
        recentFiles = [],
        activeRootId = null,
        activeProjectId = null,
        onSetActiveRootId,
        onSetActiveProjectId,
        onOpenProject,
        onOpenFileClick,
        onCreateProject,
        onDeleteProject,
        isGuest,
        apiProjects,
        diffHunks,
    } = props;

    const editorSettings = useEditorSettings();
    const [editorSelection, setEditorSelection] = useState<{ anchor: number; head?: number } | undefined>();

    const isMarkdown = isMarkdownFile(activeFile, sql);

    React.useEffect(() => {
        if (!searchQuery || !sql) {
            setEditorSelection(undefined);
            return;
        }

        const q = searchQuery.toLowerCase();

        // 1. Try to match CREATE <OBJECT_TYPE> <name>
        // Matches CREATE TABLE, CREATE VIEW, CREATE TYPE, etc.
        const ddlRegex = new RegExp(`create\\s+(?:or\\s+replace\\s+)?(?:materialized\\s+)?(table|view|type|index|function|trigger|policy|sequence|domain)\\s+(?:[a-zA-Z0-9_"]+\\.)?["\']?${q}["\']?\\b`, 'gi');

        let match = ddlRegex.exec(sql);

        // 2. Fallback: If no DDL matches, try to find the exact word (e.g., column name)
        if (!match) {
            const fallbackRegex = new RegExp(`\\b["\']?${q}["\']?\\b`, 'gi');
            match = fallbackRegex.exec(sql);
        }

        if (match) {
            setEditorSelection({ anchor: match.index, head: match.index + match[0].length });
        } else {
            setEditorSelection(undefined);
        }
    }, [searchQuery, sql]);

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Editor Area */}
            <div className="flex-1 overflow-hidden relative">
                {!hasOpenTabs ? (
                    <Dashboard
                        files={files}
                        recentFiles={recentFiles}
                        apiProjects={apiProjects}
                        activeProjectId={activeProjectId}
                        activeRootId={activeRootId}
                        onOpenProject={(rootId, projectId) => {
                            if (onOpenProject) {
                                onOpenProject(rootId, projectId);
                                return;
                            }
                            onSetActiveRootId?.(rootId);
                            onSetActiveProjectId?.(projectId ?? null);
                        }}
                        onOpenFile={(id) => onOpenFileClick?.(id)}
                        onCreateProject={() => onCreateProject?.()}
                        onCreateFile={() => onCreateFileClick?.()}
                        isGuest={isGuest}
                        onSelectProject={onSetActiveProjectId}
                        onDeleteProject={onDeleteProject}
                    />
                ) : isMarkdown ? (
                    /* Markdown preview mode — no toolbar below, rendered content only */
                    <div className="h-full overflow-auto p-6 prose prose-sm dark:prose-invert max-w-none">
                        <MarkdownText content={sql} />
                    </div>
                ) : (
                    <SyntaxHighlightedEditor
                        value={sql}
                        onChange={onSqlChange}
                        onPaste={onPaste}
                        onKeyDown={onKeyDown}
                        className="h-full border-0 rounded-none"
                        showLineNumbers={editorSettings.showLineNumbers}
                        showMinimap={editorSettings.showMinimap}
                        wordWrap={editorSettings.wordWrap}
                        bracketMatching={editorSettings.bracketMatching}
                        autoCloseBrackets={editorSettings.autoCloseBrackets}
                        foldGutter={editorSettings.foldGutter}
                        highlightActiveLine={editorSettings.highlightActiveLine}
                        selection={editorSelection}
                        disabled={isReadOnly}
                        diffHunks={diffHunks}
                    />
                )}
            </div>

            {/* Toolbar */}
            <div className="px-2 py-1 border-t flex items-center justify-between flex-shrink-0 bg-background text-xs">
                <SqlEditorToolbar
                    hasSql={sql.trim().length > 0}
                    isProcessing={isProcessing}
                    isReadOnly={isReadOnly}
                    onFormat={onFormat}
                    onGenerate={onGenerate}
                    onCopy={onCopy}
                    onClear={onClear}
                    onOpenAI={onOpenAI}
                />
            </div>
        </div>
    );
}
