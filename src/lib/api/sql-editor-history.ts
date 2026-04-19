import { del, get, post } from './client';
import { buildArtifact, type ArtifactItem, type ChatMessage } from '@/lib/ai-client';

export interface SQLChatSessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  connectionId?: string | null;
  projectId?: string | null;
  modelUsed?: string | null;
  messageCount?: number;
  preview?: string;
  previewRole?: string | null;
}

export interface SQLChatHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  artifacts?: ArtifactItem[];
  tokenCount?: number | null;
  modelUsed?: string | null;
  executionTrace?: ChatMessage['executionTrace'];
  usage?: ChatMessage['usage'];
  createdAt?: string;
}

export async function listSQLChatSessions(filters?: {
  projectId?: string | null;
  connectionId?: string | null;
}): Promise<{ chats: SQLChatSessionSummary[] }> {
  const params = new URLSearchParams();
  if (filters?.projectId)    params.set('projectId', filters.projectId);
  if (filters?.connectionId) params.set('connectionId', filters.connectionId);
  const qs = params.toString();
  return get<{ chats: SQLChatSessionSummary[] }>(`/api/sql-editor/chats${qs ? `?${qs}` : ''}`);
}

/** Returns the most recent chat session for a given project, or null if none. */
export async function getProjectLatestChat(projectId: string): Promise<{
  chat: SQLChatSessionSummary;
  messages: SQLChatHistoryMessage[];
} | null> {
  const { chats } = await listSQLChatSessions({ projectId });
  if (!chats.length) return null;
  return getSQLChatSessionMessages(chats[0].id);
}

export async function getSQLChatSessionMessages(chatId: string): Promise<{
  chat: SQLChatSessionSummary;
  messages: SQLChatHistoryMessage[];
}> {
  const result = await get<{ chat: SQLChatSessionSummary; messages: Array<SQLChatHistoryMessage & { artifacts?: Array<Record<string, unknown>> }> }>(
    `/api/sql-editor/chats/${chatId}/messages`
  );
  return {
    chat: result.chat,
    messages: result.messages.map(message => ({
      ...message,
      artifacts: (message.artifacts ?? []).map(artifact => buildArtifact(artifact)),
    })),
  };
}

export async function deleteSQLChatSession(chatId: string): Promise<{ success: boolean }> {
  return del<{ success: boolean }>(`/api/sql-editor/chats/${chatId}`);
}
