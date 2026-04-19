/**
 * ResonaGroupNode
 *
 * React Flow node for schema/group-scoped Resona AI chat.
 * Connected to its parent group via a "resonaEdge" (dashed violet line).
 */

import { memo, useState, useCallback } from 'react';
import { NodeProps } from '@xyflow/react';
import ResonaNodeShell from './ResonaNodeShell';
import ResonaChatBodyConnected from './ResonaChatBodyConnected';
import { useSchemaColor } from '../../layout/elk/schemaColors';
import { useAIAgent } from '@/components/ai-panel/hooks/useAIAgent';
import { listSQLChatSessions, getSQLChatSessionMessages } from '@/lib/api';

export interface ResonaGroupNodeData {
    schemaName: string;
    tableCount?: number;
    onClose: () => void;
    connectionId?: string | null;
    projectId?: string | null;
    apiSchema?: any | null;
    onApplySQL?: (sql: string) => void;
}

const GROUP_SUGGESTIONS = [
    'Summarize all tables in this schema',
    'Find missing foreign key relationships',
    'Suggest indexes across this schema',
    'Identify data quality risks',
    'Recommend normalization improvements',
];

const ResonaGroupNode = ({ data }: NodeProps<any>) => {
    const { schemaName, tableCount, onClose, connectionId, projectId, apiSchema, onApplySQL } = data as ResonaGroupNodeData;
    const schemaColor = useSchemaColor(schemaName);
    const [showHistory, setShowHistory] = useState(false);
    const [historySessions, setHistorySessions] = useState<Array<{ id: string; title: string; updatedAt: string }>>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const ai = useAIAgent({
        connectionId,
        projectId,
        currentSQL: null,
        onApplySQL,
        scope: 'group',
        contextName: schemaName,
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
            scope="group"
            title="Resona AI"
            subtitle={tableCount !== undefined ? `${schemaName} · ${tableCount} tables` : schemaName}
            onClose={onClose}
            showHandle={true}
            headerBg={schemaColor.header}
            onNewChat={handleNewChat}
            onViewHistory={handleViewHistory}
        >
            {showHistory ? (
                <div className="flex-1 overflow-y-auto min-h-0 nodrag nopan p-2 space-y-1"
                     style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(128,128,128,0.25) transparent' }}>
                    {!loadingHistory && historySessions.length === 0 && (
                        <div className="flex items-center justify-center py-6">
                            <span className="text-[10px] text-muted-foreground/50 italic">No chat history</span>
                        </div>
                    )}
                    {historySessions.map(session => (
                        <button
                            key={session.id}
                            onClick={() => handleSelectChat(session.id)}
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                            <p className="text-[10px] font-medium text-foreground/80 truncate">{session.title || 'New Chat'}</p>
                            <p className="text-[8px] text-muted-foreground/40">{new Date(session.updatedAt).toLocaleDateString()}</p>
                        </button>
                    ))}
                </div>
            ) : (
                <ResonaChatBodyConnected
                    ai={ai}
                    schema={apiSchema}
                    projectId={projectId}
                    placeholder={`Ask about ${schemaName} schema...`}
                    suggestions={GROUP_SUGGESTIONS}
                    tagline="Schema-wide intelligence."
                    scope="group"
                    contextName={schemaName}
                />
            )}
        </ResonaNodeShell>
    );
};

export default memo(ResonaGroupNode);
