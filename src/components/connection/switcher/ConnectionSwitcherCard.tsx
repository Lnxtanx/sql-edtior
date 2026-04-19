import { Trash2, Pencil, Link, Unlink, Shield, LayoutDashboard, Link2, Loader2, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Connection, ConnectionHealth } from '@/lib/api/connection';
import { useDashboardPanel } from '../dashboard/useDashboardPanel';
import { useProjectConnection } from '../hooks/useProjectConnection';
import { useCurrentFile } from '../CurrentFileContext';

interface ConnectionSwitcherCardProps {
    connection: Connection;
    health?: ConnectionHealth | null;
    isLinked: boolean;
    linkedFileName?: string;
    onDelete: () => void;
    onEdit: () => void;
    closePopover: () => void;
}

export function ConnectionSwitcherCard({
    connection,
    health,
    isLinked,
    linkedFileName,
    onDelete,
    onEdit,
    closePopover,
}: ConnectionSwitcherCardProps) {
    const { open: openDashboard } = useDashboardPanel();
    const { projectId } = useCurrentFile();
    const { linkedConnectionId: projectConnectionId, link: projectLink, unlink: projectUnlink, isLinking: isProjectLinking } = useProjectConnection(projectId ?? null);
    const statusColor = health?.status === 'healthy' ? 'bg-emerald-500' : health?.status === 'unhealthy' ? 'bg-red-500' : 'bg-slate-300';
    const isHealthy = health?.status === 'healthy';
    const isProjectLinked = projectConnectionId === connection.id;

    const handleOpenDashboard = () => {
        openDashboard(connection.id);
        closePopover();
    };

    return (
        <div className={cn(
            "group flex flex-col gap-1.5 px-2.5 py-2 rounded-lg border transition-all text-sm",
            isLinked
                ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/50 dark:bg-emerald-950/20"
                : "border-border/40 hover:border-border hover:bg-muted/30"
        )}>
            {/* Top Row: Status + Name + Badge + Actions */}
            <div className="flex items-center justify-between min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0', statusColor)} />
                    <span className="font-semibold truncate text-[13px]">{connection.name}</span>
                    {isLinked && (
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-medium flex-shrink-0 uppercase tracking-wider">
                            Linked
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={onEdit} title="Edit connection">
                        <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-red-500" onClick={onDelete} title="Delete connection">
                        <Trash2 className="w-3 h-3" />
                    </Button>
                </div>
            </div>

            {/* Meta + Actions Row (combined) */}
            <div className="flex items-center justify-between gap-2 pl-3.5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground min-w-0">
                    <div className="flex items-center gap-1 shrink-0">
                        <Database className="w-3 h-3" />
                        <span className="truncate max-w-[100px]">{(connection as any).database_name || connection.database || '—'}</span>
                    </div>
                    {isHealthy && health?.latencyMs && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium shrink-0">{health.latencyMs}ms</span>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                        <Shield className="w-3 h-3" />
                        <span>{(connection as any).ssl_mode || 'req'}</span>
                    </div>
                    {linkedFileName && (
                        <div className="flex items-center gap-1 shrink-0 text-blue-600 dark:text-blue-400">
                            <Link className="w-3 h-3" />
                            <span className="truncate max-w-[110px] font-medium">{linkedFileName}</span>
                        </div>
                    )}
                </div>

                {/* Inline action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                    {projectId && (
                        <Button
                            size="sm"
                            variant={isProjectLinked ? 'outline' : 'default'}
                            className={cn(
                                "h-6 text-[11px] px-2",
                                isProjectLinked
                                    ? "border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-800"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isProjectLinked) {
                                    projectUnlink(connection.id);
                                } else {
                                    projectLink(connection.id);
                                }
                            }}
                            disabled={isProjectLinking}
                        >
                            {isProjectLinking ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <Link2 className="w-3 h-3" />
                            )}
                            <span className="ml-1">{isProjectLinked ? 'Linked' : 'Link'}</span>
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="default"
                        className="h-6 text-[11px] px-2"
                        onClick={handleOpenDashboard}
                    >
                        <LayoutDashboard className="w-3 h-3" />
                        <span className="ml-1">Dashboard</span>
                    </Button>
                </div>
            </div>
        </div>
    );
}
