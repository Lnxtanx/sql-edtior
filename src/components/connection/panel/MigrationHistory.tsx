// =============================================================================
// MigrationHistory
// Fetches and renders the migration list via React Query.
// Delegates each row to <MigrationItem>.
// =============================================================================

import { History } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { MigrationItem } from './MigrationItem';
import { useMigrations } from '../hooks';

interface MigrationHistoryProps {
    connectionId: string | null;
    onRollback?: (migrationId: string) => void;
    isRollingBack?: boolean;
    maxItems?: number;
    compact?: boolean;
}

export function MigrationHistory({
    connectionId,
    onRollback,
    isRollingBack,
    maxItems = 5,
}: MigrationHistoryProps) {
    const { data: migrations, isLoading } = useMigrations(connectionId);

    return (
        <div className="px-3 py-2 border-b border-border flex-shrink-0">
            <div className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wide flex items-center gap-1">
                <History className="w-3 h-3" />
                Migration History
            </div>
            <div className="max-h-[120px] overflow-auto scrollbar-thin space-y-1">
                {isLoading ? (
                    <div className="space-y-1">
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-full" />
                    </div>
                ) : !migrations || migrations.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground italic py-2 text-center">
                        No migrations yet
                    </div>
                ) : (
                    migrations.slice(0, maxItems).map((m) => (
                        <MigrationItem
                            key={m.id}
                            migration={m}
                            onRollback={onRollback ? () => onRollback(m.id) : undefined}
                            isRollingBack={isRollingBack}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
