// =============================================================================
// Configuration Tab
// Professional database connection settings and configuration
// =============================================================================

import { useMemo } from 'react';
import { useConnections } from '@/lib/api/connection';
import { AlertCircle, Lock, Server, Database as DatabaseIcon, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface ConfigTabProps {
  databaseId: string;
}

export function ConfigTab({ databaseId }: ConfigTabProps) {
  const { data: connections, isLoading, error } = useConnections();

  const connection = useMemo(() => {
    return connections?.find(c => c.id === databaseId);
  }, [connections, databaseId]);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 p-8">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h3 className="text-lg font-semibold">Failed to load configuration</h3>
        <p className="text-sm text-muted-foreground">Please try again later</p>
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 p-8">
        <AlertCircle className="w-12 h-12 text-yellow-500" />
        <h3 className="text-lg font-semibold">Connection not found</h3>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 max-w-4xl">
        {/* Connection Settings */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Connection Settings</h3>
          <div className="border border-border rounded-lg p-6 bg-card space-y-6">
            {/* Connection Name */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                Connection Name
              </label>
              <p className="text-sm text-foreground bg-accent/30 px-3 py-2 rounded">{connection.name}</p>
            </div>

            {/* SSL Mode and Created */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                  SSL Mode
                </label>
                <p className="text-sm text-foreground bg-accent/30 px-3 py-2 rounded">{connection.sslMode || 'require'}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                  Created
                </label>
                <p className="text-sm text-foreground bg-accent/30 px-3 py-2 rounded">{new Date(connection.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Database */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                Database Name
              </label>
              <p className="text-sm text-foreground bg-accent/30 px-3 py-2 rounded">{connection.database}</p>
            </div>
          </div>
        </div>

        {/* Authentication Settings */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Authentication</h3>
          <div className="border border-border rounded-lg p-6 bg-card space-y-4">
            <div className="flex items-start gap-4 p-4 bg-accent/20 rounded-lg border border-accent/30">
              <Lock className="w-5 h-5 text-blue-500 shrink-0 mt-1" />
              <div>
                <p className="text-sm font-medium text-foreground">Username/Password Authentication</p>
                <p className="text-xs text-muted-foreground mt-1">Configured and active</p>
              </div>
            </div>
            <div className="pt-2">
              <Button variant="outline" size="sm" className="gap-2">
                <Key className="w-4 h-4" />
                Update Credentials
              </Button>
            </div>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Advanced Settings</h3>
          <div className="border border-border rounded-lg p-6 bg-card space-y-4">
            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div>
                <p className="text-sm font-medium text-foreground">SSL Connection</p>
                <p className="text-xs text-muted-foreground mt-1">Encrypt connection to database</p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 rounded">
                Enabled
              </span>
            </div>
            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div>
                <p className="text-sm font-medium text-foreground">Connection Pool</p>
                <p className="text-xs text-muted-foreground mt-1">Maximum: 10 connections</p>
              </div>
              <Button variant="outline" size="sm">
                Configure
              </Button>
            </div>
            <div className="flex items-center justify-between p-4 border border-border rounded-lg">
              <div>
                <p className="text-sm font-medium text-foreground">Timeout</p>
                <p className="text-xs text-muted-foreground mt-1">30 seconds</p>
              </div>
              <Button variant="outline" size="sm">
                Modify
              </Button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button>Save Changes</Button>
          <Button variant="outline">Discard</Button>
          <Button variant="destructive" className="ml-auto">
            Remove Connection
          </Button>
        </div>
      </div>
    </div>
  );
}
