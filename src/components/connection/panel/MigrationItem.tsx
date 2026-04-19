// =============================================================================
// MigrationItem
// Single migration row — status icon + version + name + rollback button.
// ~35 lines of pure presentation.
// =============================================================================

import { CheckCircle, Clock, RotateCcw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Migration } from '@/lib/api/connection';

interface MigrationItemProps {
    migration: Migration;
    onRollback?: () => void;
    isRollingBack?: boolean;
}

export function MigrationItem({ migration, onRollback, isRollingBack }: MigrationItemProps) {
    const icon = {
        applied: <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />,
        pending: <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />,
        rolled_back: <RotateCcw className="w-3 h-3 text-muted-foreground flex-shrink-0" />,
        failed: <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />,
    }[migration.status] ?? <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />;

    return (
        <div className="flex items-center gap-2 px-2 py-1 rounded bg-muted/30 text-[10px]">
            {icon}
            <span className="font-mono truncate flex-1">{migration.version}</span>
            <span className="text-muted-foreground truncate max-w-[80px]" title={migration.name}>{migration.name}</span>
            {migration.status === 'applied' && onRollback && migration.canRollback && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 px-1 text-[9px] text-muted-foreground hover:text-red-600"
                    onClick={onRollback}
                    disabled={isRollingBack}
                    title="Rollback to this state"
                >
                    Rollback
                </Button>
            )}
            {migration.status === 'applied' && !migration.canRollback && (
                <span className="text-[9px] text-muted-foreground/50 ml-auto px-1" title="Missing snapshot — cannot rollback.">No Rollback</span>
            )}
        </div>
    );
}
