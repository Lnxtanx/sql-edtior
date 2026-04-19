/**
 * ResonaGlobalNode
 *
 * React Flow node for global schema-wide Resona AI chat.
 * Standalone — no connection edges. Connected to the real AI backend.
 *
 * ARCHITECTURE (matches AIPanelShell):
 *   useAIAgent is called ONCE here at the node level (persistent for the node's lifetime).
 *   ResonaChatBodyConnected receives the `ai` object as a prop — NEVER remounts.
 *   New chat / load chat are just state resets within the SAME hook instance.
 */

import { memo, useState, useCallback } from 'react';
import { NodeProps } from '@xyflow/react';
import ResonaNodeShell from './ResonaNodeShell';
import ResonaChatBodyConnected from './ResonaChatBodyConnected';
import type { ParsedSchema } from '@/lib/sql-parser';
import { useAIAgent } from '@/components/ai-panel/hooks/useAIAgent';
import { listSQLChatSessions, getSQLChatSessionMessages } from '@/lib/api';

export interface ResonaGlobalNodeData {
    onClose: () => void;
    connectionId?: string | null;
    projectId?: string | null;
    schema?: ParsedSchema | null;
    onApplySQL?: (sql: string) => void;
}

const GLOBAL_SUGGESTIONS = [
    'Give me an overall schema health check',
    'Identify the most critical tables',
    'Suggest cross-schema optimizations',
    'Find redundant or duplicate structures',
    'Recommend a migration strategy',
];

const ResonaGlobalNode = ({ data }: NodeProps<any>) => {
    const { onClose, connectionId, projectId, schema, onApplySQL } = data as ResonaGlobalNodeData;
    const [showHistory, setShowHistory] = useState(false);
    const [historySessions, setHistorySessions] = useState<Array<{ id: string; title: string; updatedAt: string }>>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // ── Persistent AI hook (called ONCE, never remounts) ─────────────────────
    const ai = useAIAgent({
        connectionId,
        projectId,
        currentSQL: null,
        onApplySQL,
    });

    const handleNewChat = useCallback(() => {
        ai.startNewChat();
        setShowHistory(false);
    }, [ai]);

    const handleViewHistory = useCallback(async () => {
        if (showHistory) {
            setShowHistory(false);
            return;
        }
        setLoadingHistory(true);
        try {
            const result = await listSQLChatSessions({
                connectionId: connectionId || undefined,
                projectId: projectId || undefined,
            });
            setHistorySessions(result.chats.map(c => ({ id: c.id, title: c.title, updatedAt: c.updatedAt })));
            setShowHistory(true);
        } catch {
            // silently fail
        } finally {
            setLoadingHistory(false);
        }
    }, [showHistory, connectionId, projectId]);

    const handleSelectChat = useCallback(async (chatId: string) => {
        try {
            const result = await getSQLChatSessionMessages(chatId);
            ai.loadChat(
                result.chat.id,
                result.messages.map(m => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    artifacts: m.artifacts,
                    modelUsed: m.modelUsed ?? null,
                    createdAt: m.createdAt,
                    executionTrace: m.executionTrace,
                    usage: m.usage,
                }))
            );
            setShowHistory(false);
        } catch {
            // silently fail
        }
    }, [ai]);

    return (
        <ResonaNodeShell
            scope="global"
            title="Resona AI"
            subtitle="Entire schema"
            onClose={onClose}
            showHandle={false}
            onNewChat={handleNewChat}
            onViewHistory={handleViewHistory}
        >
            {showHistory ? (
                <div className="flex-1 overflow-y-auto min-h-0 nodrag nopan p-2 space-y-1"
                     style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(128,128,128,0.25) transparent' }}
                     onWheel={(e) => e.stopPropagation()}>
                    {loadingHistory && (
                        <div className="flex items-center justify-center py-6">
                            <span className="text-[10px] text-muted-foreground/50">Loading...</span>
                        </div>
                    )}
                    {!loadingHistory && historySessions.length === 0 && (
                        <div className="flex items-center justify-center py-6">
                            <span className="text-[10px] text-muted-foreground/50 italic">No chat history yet</span>
                        </div>
                    )}
                    {historySessions.map(session => (
                        <button
                            key={session.id}
                            onClick={() => handleSelectChat(session.id)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-muted/50 transition-colors group"
                        >
                            <p className="text-[10px] font-medium text-foreground/80 truncate">{session.title || 'New Chat'}</p>
                            <p className="text-[8px] text-muted-foreground/40 mt-0.5">
                                {new Date(session.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </button>
                    ))}
                </div>
            ) : (
                <ResonaChatBodyConnected
                    ai={ai}
                    schema={schema}
                    projectId={projectId}
                    placeholder="Ask about your entire schema..."
                    suggestions={GLOBAL_SUGGESTIONS}
                    tagline="Your schema, understood."
                    scope="global"
                />
            )}
        </ResonaNodeShell>
    );
};

export default memo(ResonaGlobalNode);
