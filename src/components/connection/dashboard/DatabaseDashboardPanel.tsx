import { useState, useRef, useEffect } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { X, GripHorizontal, Pin, Database, Wifi, WifiOff, Activity, Shield, FolderOpen, Link2, Unlink, Loader2 } from 'lucide-react';
import { useDashboardPanel } from './useDashboardPanel';
import { ActivitySection } from './ActivitySection';
import { LinkedFilesSection } from './LinkedFilesSection';
import { MigrationHistory } from '../panel/MigrationHistory';
import { useConnections, useConnectionHealth } from '@/lib/api/connection';
import { useConnectionActions } from '../hooks/useConnectionActions';
import { useProjectConnection } from '../hooks/useProjectConnection';
import { useCurrentFile } from '../CurrentFileContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PullOptionsDialog, PullMode } from './PullOptionsDialog';
import { useFileManager } from '@/hooks/useFileManager';

export function DatabaseDashboardPanel() {
    const { isOpen, close, forceClose, isPinned, togglePin, connectionId } = useDashboardPanel();
    const { data: connections } = useConnections();
    const connection = connections?.find((c) => c.id === connectionId);

    const { data: health, isLoading: healthLoading } = useConnectionHealth(connectionId);
    // Grab the current file's SQL so Diff can compare editor content vs live DB
    const { sql: currentFileSql, projectId, projectName } = useCurrentFile();
    const { linkedConnectionId: projectConnectionId, link: projectLink, unlink: projectUnlink, isLinking: isProjectLinking } = useProjectConnection(projectId ?? null);

    // We need fileManager to support workspace split pulls
    const fileManager = useFileManager();

    const actions = useConnectionActions({
        dispatchToEditor: true, // Pull → editorBus.setSql, Diff → editorBus.openDiff
        fileManager,
    });

    const dragControls = useDragControls();
    const [size, setSize] = useState({ width: 640, height: 500 });
    const [isResizing, setIsResizing] = useState(false);
    const [showPullDialog, setShowPullDialog] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // Resize handler
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !panelRef.current) return;
            const rect = panelRef.current.getBoundingClientRect();
            const newWidth = e.clientX - rect.left;
            const newHeight = e.clientY - rect.top;
            setSize({
                width: Math.max(400, Math.min(newWidth, 1200)),
                height: Math.max(300, Math.min(newHeight, 1000))
            });
        };
        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
        };
        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'nwse-resize';
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    if (!isOpen || !connection) return null;

    const isHealthy = health?.status === 'healthy';
    const isUnhealthy = health?.status === 'unhealthy';

    return (
        <motion.div
            ref={panelRef}
            drag
            dragListener={false}
            dragControls={dragControls}
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{ width: size.width, height: size.height }}
            className="fixed bottom-6 right-6 z-50 bg-card/95 backdrop-blur border border-border/50 shadow-2xl rounded-xl flex flex-col overflow-hidden ring-1 ring-black/5 dark:ring-white/10"
        >
            {/* Header / Drag Handle */}
            <div
                className="flex items-center justify-between px-3 py-2 bg-muted/60 cursor-grab active:cursor-grabbing border-b border-border/40 select-none"
                onPointerDown={(e) => dragControls.start(e)}
            >
                <div className="flex items-center gap-2.5 min-w-0 pl-1">
                    <GripHorizontal className="w-4 h-4 opacity-40 shrink-0" />
                    <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-sm font-semibold truncate">{connection.name}</span>
                    <span className="opacity-30 mx-0.5">|</span>

                    {/* Inline health badge */}
                    <div className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0",
                        isHealthy && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-200/50",
                        isUnhealthy && "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 border border-red-200/50",
                        !isHealthy && !isUnhealthy && "bg-slate-50 text-slate-500 dark:bg-slate-500/10 dark:text-slate-400 border border-slate-200/50"
                    )}>
                        {healthLoading ? <Activity className="w-3 h-3 animate-pulse" /> : isHealthy ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                        {isHealthy && health?.latencyMs && `${health.latencyMs}ms`}
                        {isUnhealthy && 'Offline'}
                        {!isHealthy && !isUnhealthy && !healthLoading && 'Checking...'}
                    </div>

                    <div className="hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground ml-2">
                        <span className="flex items-center gap-1 truncate"><Database className="w-3 h-3" /> {(connection as any).database_name || connection.database}</span>
                        {health?.serverVersion && (
                            <span className="flex items-center gap-1 truncate"><Activity className="w-3 h-3" /> pg {health.serverVersion}</span>
                        )}
                        <span className="flex items-center gap-1 truncate"><Shield className="w-3 h-3" /> {(connection as any).ssl_mode || 'disable'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-6 w-6 rounded hover:bg-muted", isPinned && "bg-muted text-primary")}
                        onClick={togglePin}
                        onPointerDown={(e) => e.stopPropagation()}
                        title={isPinned ? "Unpin dashboard" : "Pin dashboard (keep open)"}
                    >
                        <Pin className={cn("w-3.5 h-3.5", isPinned && "rotate-45")} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                        onClick={forceClose}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <X className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* Content Body - Split View */}
            <div className="flex-1 min-h-0 flex relative bg-background">
                {/* Left Column (Files & DB Actions) */}
                <div className="w-1/2 min-w-[280px] border-r border-border/40 flex flex-col h-full bg-muted/10">
                    {/* Quick Panel Actions */}
                    <div className="p-3 border-b border-border/40 bg-card">
                        <div className="flex gap-2 mb-2">
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs font-medium bg-blue-50/50 text-blue-700 hover:bg-blue-100/50 border-blue-200 dark:bg-blue-900/10 dark:text-blue-400 dark:border-blue-900/30" onClick={() => setShowPullDialog(true)} disabled={actions.isPulling}>
                                {actions.isPulling ? 'Pulling…' : 'Pull → Editor'}
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs font-medium bg-violet-50/50 text-violet-700 hover:bg-violet-100/50 border-violet-200 dark:bg-violet-900/10 dark:text-violet-400 dark:border-violet-900/30" onClick={() => actions.handleDiff(connection.id, currentFileSql ?? undefined)} disabled={actions.isBusy}>
                                {actions.isBusy ? 'Comparing…' : 'Diff → Panel'}
                            </Button>
                        </div>
                    </div>

                    <PullOptionsDialog
                        open={showPullDialog}
                        onOpenChange={setShowPullDialog}
                        onConfirm={(mode) => {
                            setShowPullDialog(false);
                            actions.handlePull(connection.id, mode);
                        }}
                        isPulling={actions.isPulling}
                    />

                    <ScrollArea className="flex-1">
                        <div className="p-3">
                            {/* Project Link Section */}
                            {projectId && (
                                <div className="mb-4">
                                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">Project Connection</h3>
                                    <div className="rounded-md border border-border/40 overflow-hidden shadow-sm bg-card">
                                        <div className="flex items-center justify-between p-3">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={cn(
                                                    "p-1.5 rounded",
                                                    projectConnectionId === connectionId
                                                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                        : "bg-muted"
                                                )}>
                                                    <FolderOpen className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium truncate">{projectName || 'Current Project'}</p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {projectConnectionId === connectionId ? '● Linked to this connection' : 'Not linked'}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                variant={projectConnectionId === connectionId ? 'outline' : 'default'}
                                                size="sm"
                                                className={cn(
                                                    "h-7 text-xs px-3",
                                                    projectConnectionId === connectionId
                                                        ? "text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                                )}
                                                onClick={() => {
                                                    if (projectConnectionId === connectionId) {
                                                        projectUnlink(connectionId);
                                                    } else {
                                                        projectLink(connectionId!);
                                                    }
                                                }}
                                                disabled={isProjectLinking}
                                            >
                                                {isProjectLinking ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : projectConnectionId === connectionId ? (
                                                    <><Unlink className="w-3 h-3 mr-1" />Unlink</>
                                                ) : (
                                                    <><Link2 className="w-3 h-3 mr-1" />Link</>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">Linked Files</h3>
                            <div className="rounded-md border border-border/40 overflow-hidden shadow-sm">
                                <LinkedFilesSection connectionId={connection.id} />
                            </div>

                            <div className="mt-6">
                                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">Migrations</h3>
                                <div className="rounded-md border border-border/40 overflow-hidden shadow-sm bg-card">
                                    <MigrationHistory
                                        connectionId={connection.id}
                                        onRollback={() => actions.handleRollback(connection.id)}
                                        isRollingBack={actions.isRollingBack}
                                        compact={true}
                                    />
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </div>

                {/* Right Column (Activity Feed) */}
                <div className="flex-1 flex flex-col min-w-[280px]">
                    <div className="px-3 py-2 border-b border-border/40 bg-card/50 flex items-center justify-between shadow-sm z-10">
                        <h3 className="text-xs font-semibold flex items-center gap-1.5 pt-0.5">
                            <Activity className="w-3.5 h-3.5 text-blue-500" />
                            Live Activity
                        </h3>
                    </div>
                    <ScrollArea className="flex-1">
                        <ActivitySection connectionId={connection.id} />
                    </ScrollArea>
                </div>

                {/* Resize Handle */}
                <div
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-center justify-center z-10 opacity-0 hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        setIsResizing(true);
                    }}
                >
                    <div className="w-2 h-2 border-r-2 border-b-2 border-primary/50 rounded-br-sm" />
                </div>
            </div>
        </motion.div>
    );
}
