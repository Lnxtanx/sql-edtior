// =============================================================================
// Overview Tab
// Professional dashboard view with database stats and quick actions
// =============================================================================

import { useMemo } from 'react';
import { useConnections, useMigrations } from '@/lib/api/connection';
import { AlertCircle, RefreshCw, Heart, GitBranch, Clock, Calendar, CheckCircle, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface OverviewTabProps {
  databaseId: string;
}

export function OverviewTab({ databaseId }: OverviewTabProps) {
  const { data: connections, isLoading: connectionsLoading, error: connectionsError } = useConnections();
  const { data: migrations, isLoading: migrationsLoading } = useMigrations(databaseId);

  const connection = useMemo(() => {
    return connections?.find(c => c.id === databaseId);
  }, [connections, databaseId]);

  if (connectionsLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (connectionsError || !connection) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 p-8">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h3 className="text-lg font-semibold">Failed to load database</h3>
        <p className="text-sm text-muted-foreground text-center">
          {connectionsError?.message || 'Database connection not found'}
        </p>
      </div>
    );
  }

  const appliedCount = migrations?.filter(m => m.status === 'applied').length || 0;
  const pendingCount = migrations?.filter(m => m.status === 'pending').length || 0;
  const totalMigrations = migrations?.length || 0;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 max-w-6xl">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Health Status */}
          <div className="border border-border rounded-lg p-6 bg-card hover:border-accent transition-colors">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Health Status
              </span>
              <Heart className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-foreground capitalize">
                {connection.health_status || 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground">
                {connection.last_health_check ? `Last checked ${new Date(connection.last_health_check).toLocaleDateString()}` : 'Never checked'}
              </p>
            </div>
          </div>

          {/* Applied Migrations */}
          <div className="border border-border rounded-lg p-6 bg-card hover:border-accent transition-colors">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Applied Migrations
              </span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-foreground">{appliedCount}</p>
              <p className="text-xs text-muted-foreground">of {totalMigrations} migrations</p>
            </div>
          </div>

          {/* Pending Migrations */}
          <div className="border border-border rounded-lg p-6 bg-card hover:border-accent transition-colors">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Pending Migrations
              </span>
              <Clock className="w-4 h-4 text-yellow-500" />
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">waiting for deployment</p>
            </div>
          </div>

          {/* Connection Info */}
          <div className="border border-border rounded-lg p-6 bg-card hover:border-accent transition-colors">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Database
              </span>
              <GitBranch className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground truncate">{connection.database}</p>
              <p className="text-xs text-muted-foreground truncate">PostgreSQL</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Health Check
            </Button>
            <Button variant="outline" className="gap-2">
              <GitBranch className="w-4 h-4" />
              Compare
            </Button>
            <Button variant="outline" className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Deploy
            </Button>
            <Button variant="outline" className="gap-2">
              <MoreVertical className="w-4 h-4" />
              More
            </Button>
          </div>
        </div>

        {/* Connection Details */}
        <div className="border border-border rounded-lg p-6 bg-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Connection Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                Connection Name
              </label>
              <p className="text-sm text-foreground">{connection.name}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                SSL Mode
              </label>
              <p className="text-sm text-foreground">{connection.sslMode || 'require'}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                Created
              </label>
              <p className="text-sm text-foreground">{new Date(connection.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">
                Database
              </label>
              <p className="text-sm text-foreground">{connection.database}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
