import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteSQLChatSession,
  getSQLChatSessionMessages,
  listSQLChatSessions,
  type SQLChatSessionSummary,
  type SQLChatHistoryMessage,
} from '@/lib/api';

const SQL_CHAT_HISTORY_KEY = ['sql-editor', 'chat-history'] as const;

export function useSQLChatHistory() {
  const queryClient = useQueryClient();

  const sessionsQuery = useQuery({
    queryKey: SQL_CHAT_HISTORY_KEY,
    queryFn: listSQLChatSessions,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSQLChatSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SQL_CHAT_HISTORY_KEY });
    },
  });

  return {
    sessions: sessionsQuery.data?.chats ?? [],
    isLoading: sessionsQuery.isLoading,
    error: sessionsQuery.error,
    refetch: sessionsQuery.refetch,
    loadMessages: getSQLChatSessionMessages,
    deleteChat: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}

export type { SQLChatSessionSummary, SQLChatHistoryMessage };
