// =============================================================================
// useLinkedConnection
// Single source of truth for the current file's linked connection.
// Replaces duplicated getFileConnection() calls across 3 components.
// =============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getFileConnection,
    linkFileToConnection,
    unlinkFileFromConnection,
    type LinkedConnection,
} from '@/lib/file-management/api/client';
import { connectionKeys } from '@/lib/api/connection';
import { toast } from 'sonner';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const fileLinkKeys = {
    connection: (fileId: string) => ['file', fileId, 'connection'] as const,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useLinkedConnection(fileId: string | null) {
    const queryClient = useQueryClient();

    // Query: which connection is this file linked to?
    const query = useQuery({
        queryKey: fileLinkKeys.connection(fileId!),
        queryFn: () => getFileConnection(fileId!),
        enabled: !!fileId,
        select: (data) => data.connection,
        staleTime: 30_000,
    });

    // Mutation: link file to a connection
    const linkMutation = useMutation({
        mutationFn: (connectionId: string) => {
            if (!fileId) throw new Error('No file to link');
            return linkFileToConnection(fileId, connectionId);
        },
        onSuccess: (result) => {
            queryClient.setQueryData(
                fileLinkKeys.connection(fileId!),
                { connection: result.connection }
            );
            toast.success(`Linked to ${result.connection.name}`);
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to link connection');
        },
    });

    // Mutation: unlink file from connection
    const unlinkMutation = useMutation({
        mutationFn: () => {
            if (!fileId) throw new Error('No file to unlink');
            return unlinkFileFromConnection(fileId);
        },
        onSuccess: () => {
            queryClient.setQueryData(
                fileLinkKeys.connection(fileId!),
                { connection: null }
            );
            toast.success('Connection unlinked');
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to unlink connection');
        },
    });

    return {
        /** The linked connection object (or null) */
        linkedConnection: query.data ?? null,
        /** The linked connection's ID (shortcut) */
        linkedConnectionId: query.data?.id ?? null,
        /** Whether the link query is loading */
        isLoading: query.isLoading,
        /** Link the current file to a connection (pass connectionId) */
        link: linkMutation.mutate,
        /** Unlink the current file from its connection */
        unlink: unlinkMutation.mutate,
        /** Whether a link/unlink operation is in flight */
        isLinking: linkMutation.isPending || unlinkMutation.isPending,
    };
}
