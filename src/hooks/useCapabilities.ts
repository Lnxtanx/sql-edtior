/**
 * useCapabilities.ts
 * 
 * Hook that fetches the current user's workspace capabilities (role + feature access).
 * Used to control which navigation items, settings, and features are visible.
 * 
 * Solo users (not part of any team) get full access to all features.
 * Team members get access based on their team_members.feature_access array.
 */

import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api/client';
import { useAuth } from '@/components/auth/AuthProvider';

export interface UserCapabilities {
  role: 'owner' | 'developer' | 'analyst' | 'viewer';
  features: string[];
}

const DEFAULT_CAPABILITIES: UserCapabilities = {
  role: 'owner',
  features: ['sql_editor', 'explorer', 'db_admin', 'schema_designer'],
};

async function fetchCapabilities(): Promise<UserCapabilities> {
  return get<UserCapabilities>('/api/auth/capabilities');
}

export function useCapabilities() {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['capabilities', user?.id],
    queryFn: fetchCapabilities,
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });

  // If not logged in, return full access (guest/solo user behavior)
  const capabilities = data || DEFAULT_CAPABILITIES;

  return {
    capabilities,
    isLoading: !!user && isLoading,
    error,
    // Convenience helpers
    canAccessSQL: capabilities.features.includes('sql_editor'),
    canAccessExplorer: capabilities.features.includes('explorer'),
    canAccessAdmin: capabilities.features.includes('db_admin'),
    canAccessSchema: capabilities.features.includes('schema_designer'),
    workspaceRole: capabilities.role,
  };
}
