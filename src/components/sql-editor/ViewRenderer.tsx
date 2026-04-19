/**
 * ViewRenderer — renders the active sidebar view content.
 *
 * Handles the switch between editor, AI, connect, graph, compiler, diff views.
 * Extracted from SqlEditor.tsx to reduce file size.
 */

import React from 'react';
import type { SidebarView } from '@/components/layout/types';
import type { ParsedSchema } from '@/lib/sql-parser';
import type { SubgraphConfig } from '@/components/schema-workspace/SubgraphPanel';
import type { GraphStats } from '@/lib/schema-workspace';
import type { UseAIAgentReturn } from '@/components/ai-panel';
import type { CompilationResult } from '@/lib/schema-compiler/types';
import type { IntrospectedSchema } from '@/lib/schema-utils/schema-to-sql';
import type { DiffResult } from '@/components/sql-diff/SqlDiffPanel';

import { EditorViewContent, EditorViewContentProps } from './EditorViewContent';
import { AIPanelShell } from '@/components/ai-panel';
import { ConnectionPanel } from '@/components/connection';
import { SubgraphPanel } from '@/components/schema-workspace/SubgraphPanel';
import { SchemaCompilerPanel } from '@/components/schema-compiler/SchemaCompilerPanel';
import { SqlDiffPanel } from '@/components/sql-diff/SqlDiffPanel';
import { schemaToSql } from '@/lib/schema-utils/schema-to-sql';

export interface ViewRendererProps {
    view: SidebarView;
    setActiveView: (view: SidebarView) => void;

    // Editor view
    editorViewProps: EditorViewContentProps;

    // AI
    activeSchema: ParsedSchema | null;
    ai: UseAIAgentReturn;
    allowedModels?: string[];

    // Connection
    editor: {
        setSql: (sql: string) => void;
        compilation: CompilationResult | null | undefined;
        sql: string;
    };
    onManualSave?: (content?: string) => void;

    // Graph
    subgraphConfig?: SubgraphConfig;
    onSubgraphConfigChange?: (config: SubgraphConfig) => void;
    graphStats?: GraphStats | null;
    onOpenGraphSettings?: () => void;

    // Diff
    pendingDiff: DiffResult | null;
    onClearDiff: () => void;

    // Project
    activeProjectId?: string | null;

    // AI file changes
    pendingAiFile?: {
        nodeId: string;
        fileName: string;
        originalContent: string;
        proposedContent: string;
        toolName: string;
    } | null;
    onAcceptAiChanges?: () => void;
    onRejectAiChanges?: () => void;
}

export function renderView({
    view,
    setActiveView,
    editorViewProps,
    activeSchema,
    ai,
    allowedModels,
    editor,
    onManualSave,
    subgraphConfig,
    onSubgraphConfigChange,
    graphStats,
    onOpenGraphSettings,
    pendingDiff,
    onClearDiff,
    activeProjectId,
    pendingAiFile,
    onAcceptAiChanges,
    onRejectAiChanges,
}: ViewRendererProps): React.ReactNode {
    switch (view) {
        case 'editor':
            return <EditorViewContent {...editorViewProps}
                pendingAiFile={pendingAiFile}
                onAcceptAiChanges={onAcceptAiChanges}
                onRejectAiChanges={onRejectAiChanges}
            />;

        case 'ai':
            return (
                <AIPanelShell
                    schema={activeSchema}
                    ai={ai}
                    compact={true}
                    allowedModels={allowedModels}
                    onClose={() => setActiveView('editor')}
                    onNavigateToTable={() => setActiveView('editor')}
                    projectId={activeProjectId ?? null}
                />
            );

        case 'connect':
            return (
                <ConnectionPanel
                    onClose={() => setActiveView('editor')}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onSchemaPulled={(pullResult: any) => {
                        try {
                            const generatedSql = pullResult.sql
                                ? String(pullResult.sql)
                                : schemaToSql((pullResult.schema ?? pullResult) as IntrospectedSchema);
                            editor.setSql(generatedSql);
                            onManualSave?.(generatedSql);
                            import('sonner').then(({ toast }) =>
                                toast.success('SQL updated from database. You can now close this panel.')
                            );
                        } catch (error: unknown) {
                            const message = error instanceof Error ? error.message : String(error);
                            console.error('Failed to convert schema to SQL:', error);
                            import('sonner').then(({ toast }) =>
                                toast.error('Failed to update editor: ' + message)
                            );
                        }
                    }}
                />
            );

        case 'graph':
            return (
                <SubgraphPanel
                    schema={activeSchema}
                    config={subgraphConfig!}
                    onConfigChange={onSubgraphConfigChange!}
                    onClose={() => setActiveView('editor')}
                    stats={graphStats}
                    onOpenSettings={onOpenGraphSettings}
                />
            );

        case 'compiler':
            return (
                <SchemaCompilerPanel
                    compilation={editor.compilation ?? null}
                    schema={activeSchema}
                    onClose={() => setActiveView('editor')}
                />
            );

        case 'diff':
            return (
                <SqlDiffPanel
                    onClose={() => {
                        setActiveView('editor');
                        onClearDiff();
                    }}
                    editorSql={editor.sql}
                    initialDiff={pendingDiff}
                />
            );

        default:
            return <div className="p-4 text-sm text-muted-foreground">Select a view</div>;
    }
}
