// =============================================================================
// Migrations Tab
// Professional migration history view with filtering, SQL viewer, and rollback
// =============================================================================

import { useMemo, useState } from 'react';
import { useMigrations, useRollbackMigrations } from '@/lib/api/connection';
import { AlertCircle, CheckCircle2, Clock, RotateCcw, XCircle, ChevronDown, ChevronUp, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface MigrationsTabProps {
  databaseId: string;
}

type FilterStatus = 'applied' | 'pending' | 'failed' | 'rolled_back';

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'applied':
      return (
        <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> Applied
        </span>
      );
    case 'pending':
      return (
        <span className="flex items-center gap-1.5 text-sm text-yellow-600 dark:text-yellow-400">
          <Clock className="w-4 h-4 shrink-0" /> Pending
        </span>
      );
    case 'rolled_back':
      return (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <RotateCcw className="w-4 h-4 shrink-0" /> Rolled back
        </span>
      );
    case 'failed':
      return (
        <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
          <XCircle className="w-4 h-4 shrink-0" /> Failed
        </span>
      );
    default:
      return <span className="text-sm text-muted-foreground capitalize">{status}</span>;
  }
}

interface SqlViewerProps {
  upSql?: string;
  downSql?: string;
}

function SqlViewer({ upSql, downSql }: SqlViewerProps) {
  const [tab, setTab] = useState<'up' | 'down'>('up');

  return (
    <div className="mt-3 rounded-md border border-border overflow-hidden">
      <div className="flex border-b border-border bg-muted/40">
        <button
          onClick={() => setTab('up')}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${tab === 'up' ? 'bg-background text-foreground border-r border-border' : 'text-muted-foreground hover:text-foreground'}`}
        >
          up.sql
        </button>
        <button
          onClick={() => setTab('down')}
          className={`px-3 py-1.5 text-xs font-medium transition-colors ${tab === 'down' ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          down.sql {!downSql && <span className="text-muted-foreground/60">(none)</span>}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono overflow-x-auto max-h-48 text-foreground bg-card whitespace-pre-wrap break-words">
        {tab === 'up'
          ? (upSql || '-- No up SQL recorded')
          : (downSql || '-- No down SQL available. Use forceSnapshotRollback to revert via snapshot.')}
      </pre>
    </div>
  );
}

interface MigrationRowProps {
  migration: any;
  databaseId: string;
  isLatestApplied: boolean;
}

function MigrationRow({ migration, databaseId, isLatestApplied }: MigrationRowProps) {
  const [expanded, setExpanded] = useState(false);
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
        toast.success(`Rolled back via ${mode === 'down_sql' ? 'down_sql' : 'snapshot restore'}`);
      } else {
        toast.error(result.results[0]?.error || 'Rollback failed');
      }
    } catch (err: any) {
      const msg: string = err.message || 'Rollback failed';
      if (msg.includes('SNAPSHOT_ROLLBACK_REQUIRES_CONFIRMATION') || msg.includes('requiresForce')) {
        setForceConfirm(true);
      } else {
        toast.error(msg);
      }
    } finally {
      setRolling(false);
    }
  };

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-accent/30 transition-colors">
        {/* Name + checksum */}
        <div className="col-span-4">
          <p className="text-sm font-medium text-foreground truncate" title={migration.name}>
            {migration.name || migration.id}
          </p>
          <p className="text-xs text-muted-foreground font-mono truncate" title={migration.checksum}>
            {migration.checksum ? migration.checksum.slice(0, 12) + '…' : 'N/A'}
          </p>
        </div>

        {/* Status */}
        <div className="col-span-3">
          <StatusBadge status={migration.status} />
        </div>

        {/* Date */}
        <div className="col-span-3">
          <p className="text-sm text-muted-foreground">
            {migration.applied_at
              ? new Date(migration.applied_at).toLocaleDateString()
              : migration.created_at
              ? new Date(migration.created_at).toLocaleDateString()
              : 'N/A'}
          </p>
          {migration.execution_time_ms && (
            <p className="text-xs text-muted-foreground">{migration.execution_time_ms}ms</p>
          )}
        </div>

        {/* Actions */}
        <div className="col-span-2 flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(e => !e)}
            title="View SQL"
            className="gap-1 px-2"
          >
            <Code className="w-3.5 h-3.5" />
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          {migration.status === 'applied' && isLatestApplied && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRollback(false)}
              disabled={rolling || rollbackMutation.isPending}
              title={hasDownSql ? 'Rollback (down_sql)' : 'Rollback (requires snapshot)'}
              className="gap-1 px-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${rolling ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </div>

      {/* Snapshot rollback confirmation prompt */}
      {forceConfirm && (
        <div className="mx-6 mb-4 p-4 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 text-sm space-y-2">
          <p className="font-semibold text-orange-900 dark:text-orange-100">⚠ No down_sql — snapshot rollback required</p>
          <p className="text-orange-800 dark:text-orange-200 text-xs">
            This migration has no down SQL. Rolling back will <strong>DROP the entire schema and restore from a snapshot</strong>.
            All data added since this migration was applied will be lost.
          </p>
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleRollback(true)}
              disabled={rolling}
            >
              {rolling ? 'Rolling back…' : 'Yes, drop & restore snapshot'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setForceConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* SQL Viewer */}
      {expanded && (
        <div className="px-6 pb-4">
          <SqlViewer upSql={migration.up_sql} downSql={migration.down_sql} />
          {migration.commit_message && (
            <p className="mt-2 text-xs text-muted-foreground italic">"{migration.commit_message}"</p>
          )}
          {migration.metadata?.warnings?.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {migration.metadata.warnings.map((w: string, i: number) => (
                <p key={i} className="text-xs text-yellow-600 dark:text-yellow-400">⚠ {w}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MigrationsTab({ databaseId }: MigrationsTabProps) {
  const { data: migrations, isLoading, error } = useMigrations(databaseId);
  const [statusFilter, setStatusFilter] = useState<FilterStatus | 'all'>('all');

  const filteredMigrations = useMemo(() => {
    if (!migrations) return [];
    if (statusFilter === 'all') return migrations;
    return migrations.filter((m: any) => m.status === statusFilter);
  }, [migrations, statusFilter]);

  // The most recently applied migration is the only one eligible for rollback
  const latestAppliedId = useMemo(() => {
    if (!migrations) return null;
    const applied = migrations
      .filter((m: any) => m.status === 'applied')
      .sort((a: any, b: any) => new Date(b.applied_at || 0).getTime() - new Date(a.applied_at || 0).getTime());
    return applied[0]?.id ?? null;
  }, [migrations]);

  if (isLoading) {
    return (
      <div className="p-8 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 p-8">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <h3 className="text-lg font-semibold">Failed to load migrations</h3>
        <p className="text-sm text-muted-foreground">Please try again later</p>
      </div>
    );
  }

  if (!migrations || migrations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 p-8">
        <CheckCircle2 className="w-12 h-12 text-green-500" />
        <h3 className="text-lg font-semibold">No migrations yet</h3>
        <p className="text-sm text-muted-foreground">Push a schema change to create your first migration</p>
      </div>
    );
  }

  const statusCounts = {
    all: migrations.length,
    applied: migrations.filter((m: any) => m.status === 'applied').length,
    pending: migrations.filter((m: any) => m.status === 'pending').length,
    failed: migrations.filter((m: any) => m.status === 'failed').length,
    rolled_back: migrations.filter((m: any) => m.status === 'rolled_back').length,
  };

  const FILTER_OPTIONS: { key: FilterStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'applied', label: 'Applied' },
    { key: 'pending', label: 'Pending' },
    { key: 'rolled_back', label: 'Rolled Back' },
    { key: 'failed', label: 'Failed' },
  ];

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Migration History</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {statusCounts.applied} applied · {statusCounts.pending} pending · {statusCounts.rolled_back} rolled back
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTER_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === key
                  ? 'bg-blue-600 text-white'
                  : 'border border-border text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {label} ({statusCounts[key]})
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          {/* Header row */}
          <div className="bg-muted/40 border-b border-border px-6 py-3 grid grid-cols-12 gap-4 items-center">
            <div className="col-span-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Migration</div>
            <div className="col-span-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</div>
            <div className="col-span-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</div>
            <div className="col-span-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Actions</div>
          </div>

          {filteredMigrations.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No {statusFilter === 'all' ? '' : statusFilter} migrations found
            </div>
          ) : (
            <div>
              {filteredMigrations.map((migration: any) => (
                <MigrationRow
                  key={migration.id}
                  migration={migration}
                  databaseId={databaseId}
                  isLatestApplied={migration.id === latestAppliedId}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
