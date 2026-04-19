// =============================================================================
// DatabaseDashboard
// Rich dashboard for the connected/selected database.
// Shows health, quick actions, event log, and migration history.
// Replaces the flat list layout in ConnectionPanel.
// =============================================================================

import { useState } from 'react';
import {
    Download,
    Upload,
    Activity,
    GitCompare,
    Wifi,
    WifiOff,
    Database,
    Shield,
    Clock,
    FileText,
    FolderOpen,
    Link2,
    ChevronDown,
    ChevronRight,
    Loader2,
    RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { useConnectionHealth, useHealthEvents, connectionKeys } from '../hooks';
import { useLinkedConnection } from '../hooks/useLinkedConnection';
import { useProjectConnection } from '../hooks/useProjectConnection';
import { useConnectionActions } from '../hooks/useConnectionActions';
import { useCurrentFile } from '../CurrentFileContext';
import { FileLinkButton } from '../shared/FileLinkButton';
import { MigrationHistory } from './MigrationHistory';
import type { Connection } from '@/lib/api/connection';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DatabaseDashboardProps {
    connection: Connection;
    onSchemaPulled?: (schema: any) => void;
}

// ─── Event Type Config ───────────────────────────────────────────────────────

const EVENT_ICONS: Record<string, { icon: typeof Download; color: string }> = {
    PULL: { icon: Download, color: 'text-blue-500' },
    PUSH: { icon: Upload, color: 'text-amber-500' },
    LINK: { icon: Link2, color: 'text-emerald-500' },
    UNLINK: { icon: Link2, color: 'text-red-400' },
    CONNECT: { icon: Wifi, color: 'text-emerald-500' },
    UPDATE: { icon: RefreshCw, color: 'text-blue-400' },
    DRIFT_CHECK: { icon: GitCompare, color: 'text-slate-400' },
    DRIFT_DETECTED: { icon: GitCompare, color: 'text-orange-500' },
    HEALTH_CHECK: { icon: Activity, color: 'text-emerald-500' },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function DatabaseDashboard({ connection, onSchemaPulled }: DatabaseDashboardProps) {
    const { fileId: currentFileId, fileName: currentFileName, projectId, projectName } = useCurrentFile();
    const { data: health, isLoading: healthLoading } = useConnectionHealth(connection.id);
    const { data: events, isLoading: eventsLoading } = useHealthEvents(connection.id, { limit: 10 });
    const { linkedConnectionId: fileConnectionId, link: fileLink, unlink: fileUnlink, isLinking: isFileLinking } = useLinkedConnection(currentFileId);
    const { linkedConnectionId: projectConnectionId, link: projectLink, unlink: projectUnlink, isLinking: isProjectLinking } = useProjectConnection(projectId ?? null);
    const actions = useConnectionActions({ onSchemaPulled });

    // Project-level connection takes priority
    const linkedConnectionId = projectConnectionId || fileConnectionId;
    const isLinked = linkedConnectionId === connection.id;
    const isLinking = isFileLinking || isProjectLinking;
    const link = projectId ? projectLink : fileLink;
    const unlink = projectId ? projectUnlink : fileUnlink;

    // Collapsible sections
    const [showEvents, setShowEvents] = useState(true);

    return (
        <div className={cn(
            "flex-1 overflow-y-auto",
            // Thin scrollbar (4px) — consistent with terminal
            "[&::-webkit-scrollbar]:w-[4px]",
            "[&::-webkit-scrollbar-track]:bg-transparent",
            "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/20",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/30"
        )}>
            {/* ─── Health Header ──────────────────────────────────────────── */}
            <div className="px-3 py-3 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <Database className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span className="text-sm font-semibold truncate">{connection.name}</span>
                    </div>
                    <HealthBadge health={health} isLoading={healthLoading} />
                </div>

                {/* Connection meta */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-muted-foreground pl-6">
                    <div className="flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        <span className="truncate">{connection.database || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        <span>SSL: {connection.sslMode || 'require'}</span>
                    </div>
                    {health?.serverVersion && (
                        <div className="flex items-center gap-1 col-span-2">
                            <Activity className="w-3 h-3" />
                            <span>PostgreSQL {health.serverVersion}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Project Link ────────────────────────────────────────── */}
            {projectId && (
                <div className="px-3 py-2 border-b border-border bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 text-xs">
                            <FolderOpen className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            <div className="min-w-0">
                                <span className="truncate font-medium block">{projectName || 'Current Project'}</span>
                                <span className={`text-[10px] ${projectConnectionId === connection.id ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                    {projectConnectionId === connection.id ? '● Linked' : 'Not linked'}
                                </span>
                            </div>
                        </div>
                        <FileLinkButton
                            isLinked={projectConnectionId === connection.id}
                            isLinking={isProjectLinking}
                            onLink={() => projectLink(connection.id)}
                            onUnlink={() => projectUnlink(connection.id)}
                        />
                    </div>
                    {projectConnectionId && projectConnectionId !== connection.id && (
                        <div className="mt-1 text-[10px] text-amber-600 pl-5">
                            ⚠ Project linked to a different connection
                        </div>
                    )}
                </div>
            )}

            {/* ─── File Link ──────────────────────────────────────────────── */}
            {currentFileId && !projectId && (
                <div className="px-3 py-2 border-b border-border bg-muted/20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 text-xs">
                            <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{currentFileName || 'Current file'}</span>
                        </div>
                        <FileLinkButton
                            isLinked={fileConnectionId === connection.id}
                            isLinking={isFileLinking}
                            onLink={() => fileLink(connection.id)}
                            onUnlink={() => fileUnlink()}
                        />
                    </div>
                    {fileConnectionId && fileConnectionId !== connection.id && (
                        <div className="mt-1 text-[10px] text-amber-600 pl-5">
                            ⚠ Currently linked to a different connection
                        </div>
                    )}
                </div>
            )}

            {/* ─── Quick Actions ──────────────────────────────────────────── */}
            <div className="px-3 py-2.5 border-b border-border">
                <div className="grid grid-cols-4 gap-1.5">
                    <ActionButton
                        icon={Download}
                        label="Pull"
                        color="text-blue-600"
                        hoverBg="hover:bg-blue-50"
                        onClick={() => actions.handlePull(connection.id)}
                        disabled={actions.isBusy}
                        loading={actions.isPulling}
                    />
                    <ActionButton
                        icon={Upload}
                        label="Push"
                        color="text-amber-600"
                        hoverBg="hover:bg-amber-50"
                        onClick={() => {
                            // Push requires generating migration from local schema
                            import('sonner').then(({ toast }) =>
                                toast.info('Use the CLI terminal to push: sw push')
                            );
                        }}
                        disabled={actions.isBusy}
                    />
                    <ActionButton
                        icon={GitCompare}
                        label="Diff"
                        color="text-violet-600"
                        hoverBg="hover:bg-violet-50"
                        onClick={() => actions.handleDiff(connection.id)}
                        disabled={actions.isBusy}
                    />
                    <ActionButton
                        icon={Activity}
                        label="Health"
                        color="text-emerald-600"
                        hoverBg="hover:bg-emerald-50"
                        onClick={() => actions.handleHealthCheck(connection.id)}
                        disabled={actions.isBusy}
                    />
                </div>
            </div>

            {/* ─── Event Log ──────────────────────────────────────────────── */}
            <div className="border-b border-border">
                <button
                    className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground hover:bg-muted/30 transition-colors"
                    onClick={() => setShowEvents(!showEvents)}
                >
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        Recent Events
                        {events && <span className="text-[9px] opacity-60">({events.length})</span>}
                    </div>
                    {showEvents ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>

                {showEvents && (
                    <div className="px-3 pb-2">
                        {eventsLoading ? (
                            <div className="space-y-1.5">
                                <Skeleton className="h-5 w-full" />
                                <Skeleton className="h-5 w-full" />
                                <Skeleton className="h-5 w-3/4" />
                            </div>
                        ) : !events || events.length === 0 ? (
                            <div className="text-[11px] text-muted-foreground/60 py-2 text-center">
                                No events recorded yet
                            </div>
                        ) : (
                            <div className="space-y-0.5 max-h-[180px] overflow-y-auto">
                                {events.map((event: any) => (
                                    <EventRow key={event.id} event={event} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ─── Migration History ──────────────────────────────────────── */}
            <MigrationHistory
                connectionId={connection.id}
                onRollback={() => actions.handleRollback(connection.id)}
                isRollingBack={actions.isRollingBack}
            />
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function HealthBadge({ health, isLoading }: { health: any; isLoading: boolean }) {
    if (isLoading) {
        return <Skeleton className="h-5 w-16 rounded-full" />;
    }

    const isHealthy = health?.status === 'healthy';
    const isUnhealthy = health?.status === 'unhealthy';

    return (
        <div className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium",
            isHealthy && "bg-emerald-50 text-emerald-700 border border-emerald-200",
            isUnhealthy && "bg-red-50 text-red-700 border border-red-200",
            !isHealthy && !isUnhealthy && "bg-slate-50 text-slate-500 border border-slate-200"
        )}>
            {isHealthy ? (
                <Wifi className="w-3 h-3" />
            ) : isUnhealthy ? (
                <WifiOff className="w-3 h-3" />
            ) : (
                <Activity className="w-3 h-3 animate-pulse" />
            )}
            {isHealthy && health?.latencyMs && `${health.latencyMs}ms`}
            {isUnhealthy && 'Offline'}
            {!isHealthy && !isUnhealthy && 'Checking...'}
        </div>
    );
}

function ActionButton({
    icon: Icon,
    label,
    color,
    hoverBg,
    onClick,
    disabled,
    loading,
}: {
    icon: typeof Download;
    label: string;
    color: string;
    hoverBg: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
}) {
    return (
        <Button
            variant="outline"
            size="sm"
            className={cn(
                "h-8 text-[11px] justify-center gap-1.5 bg-background font-medium",
                hoverBg
            )}
            onClick={onClick}
            disabled={disabled}
        >
            {loading ? (
                <Loader2 className={cn("w-3.5 h-3.5 animate-spin", color)} />
            ) : (
                <Icon className={cn("w-3.5 h-3.5", color)} />
            )}
            {label}
        </Button>
    );
}

function EventRow({ event }: { event: any }) {
    const config = EVENT_ICONS[event.event_type] || { icon: Activity, color: 'text-slate-400' };
    const Icon = config.icon;
    const time = new Date(event.created_at);
    const timeStr = formatRelativeTime(time);

    return (
        <div className="flex items-center gap-2 py-1 px-1 rounded-sm hover:bg-muted/30 transition-colors">
            <Icon className={cn("w-3 h-3 flex-shrink-0", config.color)} />
            <span className="text-[11px] flex-1 truncate">
                {formatEventType(event.event_type)}
                {event.status === 'warning' && ' ⚠'}
            </span>
            <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
                {timeStr}
            </span>
        </div>
    );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatEventType(type: string): string {
    const labels: Record<string, string> = {
        PULL: 'Schema pulled',
        PUSH: 'Migration pushed',
        LINK: 'File linked',
        UNLINK: 'File unlinked',
        CONNECT: 'Connection created',
        UPDATE: 'Connection updated',
        DRIFT_CHECK: 'Drift check — clean',
        DRIFT_DETECTED: 'Drift detected',
        HEALTH_CHECK: 'Health check',
    };
    return labels[type] || type;
}

function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return date.toLocaleDateString();
}
