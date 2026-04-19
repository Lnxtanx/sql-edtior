// =============================================================================
// Recent Migrations Card
// Shows latest migrations with status and wired rollback actions
// =============================================================================

import { useMemo, useState } from 'react';
import { Migration, useRollbackMigrations } from '@/lib/api/connection';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ChevronRight, RotateCcw, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RecentMigrationsCardProps {
  databaseId: string;
  migrations: Migration[];
  isLoading: boolean;
  error?: Error | null;
}

export function RecentMigrationsCard({
  databaseId,
  migrations,
  isLoading,
  error,
}: RecentMigrationsCardProps) {
  const recentMigrations = useMemo(() =>
    (migrations || [])
      .sort((a, b) => new Date(b.applied_at || 0).getTime() - new Date(a.applied_at || 0).getTime())
      .slice(0, 5),
    [migrations]
  );

  // Only the most recently applied migration is eligible for rollback
  const latestAppliedId = useMemo(() => {
    const applied = recentMigrations.filter(m => m.status === 'applied');
    return applied[0]?.id ?? null;
  }, [recentMigrations]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Migrations</h3>
        <div className="space-y-1">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded p-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
          <p className="text-xs font-medium text-red-900 dark:text-red-100">Failed to load migrations</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Migrations</h3>
        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5">
          View All
          <ChevronRight className="w-2.5 h-2.5" />
        </Button>
      </div>

      {recentMigrations.length === 0 ? (
        <div className="bg-background border border-border rounded p-4 text-center">
          <p className="text-xs text-muted-foreground">No migrations yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {recentMigrations.map((migration) => (
            <MigrationItemCard
              key={migration.id}
              migration={migration}
              databaseId={databaseId}
              isLatestApplied={migration.id === latestAppliedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MigrationItemCardProps {
  migration: Migration;
  databaseId: string;
  isLatestApplied: boolean;
}

function MigrationItemCard({ migration, databaseId, isLatestApplied }: MigrationItemCardProps) {
  const [rolling, setRolling] = useState(false);
  const [forceConfirm, setForceConfirm] = useState(false);
  const rollbackMutation = useRollbackMigrations();

  const hasDownSql = !!(migration.down_sql && migration.down_sql.trim());

  const handleRollback = async (force = false) => {
    if (!force && !hasDownSql) {
      setForceConfirm(true);
      return;
    }
    setRolling(true);
    setForceConfirm(false);
    try {
      const result = await rollbackMutation.mutateAsync({
        connectionId: databaseId,
        count: 1,
        forceSnapshotRollback: force,
      });
      if (result.success) {
        const mode = result.results[0]?.mode;
        toast.success(`Rolled back via ${mode === 'down_sql' ? 'down_sql' : 'snapshot'}`);
      } else {
        toast.error(result.results[0]?.error || 'Rollback failed');
      }
    } catch (err: any) {
      const msg: string = err.message || 'Rollback failed';
      if (msg.includes('requiresForce') || msg.includes('SNAPSHOT_ROLLBACK')) {
        setForceConfirm(true);
      } else {
        toast.error(msg);
      }
    } finally {
      setRolling(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'applied':     return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
      case 'pending':     return <Clock className="w-3.5 h-3.5 text-amber-500" />;
      case 'rolled_back': return <RotateCcw className="w-3.5 h-3.5 text-gray-500" />;
      case 'failed':      return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
      default:            return null;
    }
  };

  const getStatusLabel = (status: string) =>
    status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');

  return (
    <div className="bg-background border border-border rounded p-2.5 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {getStatusIcon(migration.status)}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{migration.name}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{migration.version}</p>
          </div>
        </div>
        {migration.status === 'applied' && isLatestApplied && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 gap-0.5 text-[10px] px-1.5 shrink-0',
              'text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20'
            )}
            title={hasDownSql ? 'Rollback via down_sql' : 'Rollback requires snapshot restore'}
            disabled={rolling || rollbackMutation.isPending}
            onClick={() => handleRollback(false)}
          >
            <RotateCcw className={cn('w-2.5 h-2.5', rolling && 'animate-spin')} />
            <span className="hidden sm:inline">Rollback</span>
          </Button>
        )}
      </div>

      {/* Snapshot rollback confirmation */}
      {forceConfirm && (
        <div className="mt-1 p-2 rounded border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 space-y-1.5">
          <p className="text-[10px] font-semibold text-orange-900 dark:text-orange-100">
            ⚠ No down SQL — drop &amp; restore schema?
          </p>
          <p className="text-[10px] text-orange-800 dark:text-orange-200">
            This will DROP the entire schema and restore from a snapshot. All data added since this migration will be lost.
          </p>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="destructive"
              className="h-5 text-[10px] px-2"
              onClick={() => handleRollback(true)}
              disabled={rolling}
            >
              {rolling ? 'Rolling back…' : 'Confirm'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-5 text-[10px] px-2"
              onClick={() => setForceConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{getStatusLabel(migration.status)}</span>
        <div className="flex items-center gap-2">
          {migration.applied_at && (
            <span>{new Date(migration.applied_at).toLocaleDateString()}</span>
          )}
          {migration.execution_time_ms && (
            <span>{migration.execution_time_ms}ms</span>
          )}
        </div>
      </div>

      {migration.error_message && (
        <p className="text-[10px] text-red-500 p-1.5 bg-red-50 dark:bg-red-950/20 rounded mt-1">
          {migration.error_message}
        </p>
      )}
    </div>
  );
}
