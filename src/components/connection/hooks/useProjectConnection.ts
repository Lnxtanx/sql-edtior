// =============================================================================
// useProjectConnection
// Source of truth for a project's linked database connection.
// Mirrors useLinkedConnection but operates at the project level rather than file level.
// =============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getProjectConnection,
    linkProjectToConnection,
    unlinkProjectFromConnection,
} from '@/lib/file-management/api/client';
import { toast } from 'sonner';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const projectLinkKeys = {
    connection: (projectId: string) => ['project', projectId, 'connection'] as const,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useProjectConnection(projectId: string | null) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: projectLinkKeys.connection(projectId!),
        queryFn: () => getProjectConnection(projectId!),
        enabled: !!projectId,
        select: (data) => data.connection,
        staleTime: 30_000,
    });

    const linkMutation = useMutation({
        mutationFn: (connectionId: string) => {
            if (!projectId) throw new Error('No project to link');
            return linkProjectToConnection(projectId, connectionId);
        },
        onSuccess: () => {
            // Refetch to get the correct connection details from GET /connections/default
            queryClient.invalidateQueries({ queryKey: projectLinkKeys.connection(projectId!) });
            toast.success('Connection linked to project');
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to link connection');
        },
    });

    const unlinkMutation = useMutation({
        mutationFn: (connectionId: string) => {
            if (!projectId) throw new Error('No project to unlink');
            return unlinkProjectFromConnection(projectId, connectionId);
        },
        onSuccess: () => {
            queryClient.setQueryData(
                projectLinkKeys.connection(projectId!),
                { connection: null }
            );
            toast.success('Project connection unlinked');
        },
        onError: (err: any) => {
            toast.error(err.message || 'Failed to unlink connection');
        },
    });

    return {
        linkedConnection: query.data ?? null,
        linkedConnectionId: query.data?.id ?? null,
        isLoading: query.isLoading,
        link: linkMutation.mutate,
        unlink: unlinkMutation.mutate,
        isLinking: linkMutation.isPending || unlinkMutation.isPending,
    };
}
