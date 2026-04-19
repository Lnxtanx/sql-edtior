/**
 * Version History Panel
 * 
 * Shows file version history with restore capability.
 * Displays snapshots with timestamps, trigger types, and commit messages.
 */

import { useState, useEffect, useCallback } from 'react';
import {
    History, RotateCcw, Download, Trash2, ChevronDown, ChevronUp,
    Clock, GitCommit, Upload, Link2, Save, Loader2, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
    getFileSnapshots,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    type Snapshot,
    type SnapshotTriggerType,
} from '@/lib/file-management/api/client';
import { formatDistanceToNow } from 'date-fns';

// =============================================================================
// Types
// =============================================================================

interface VersionHistoryPanelProps {
    fileId: string | null;
    currentContent?: string;
    onRestore?: (content: string) => void;
    className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function getTriggerIcon(trigger: SnapshotTriggerType) {
    switch (trigger) {
        case 'manual': return <Save className="w-3 h-3" />;
        case 'auto': return <Clock className="w-3 h-3" />;
        case 'pull': return <Download className="w-3 h-3" />;
        case 'push': return <Upload className="w-3 h-3" />;
        case 'connection': return <Link2 className="w-3 h-3" />;
        case 'restore': return <RotateCcw className="w-3 h-3" />;
        default: return <GitCommit className="w-3 h-3" />;
    }
}

function getTriggerLabel(trigger: SnapshotTriggerType): string {
    switch (trigger) {
        case 'manual': return 'Saved';
        case 'auto': return 'Auto-saved';
        case 'pull': return 'Pulled';
        case 'push': return 'Pushed';
        case 'connection': return 'Connected';
        case 'restore': return 'Restored';
        default: return trigger;
    }
}

function formatBytes(bytes?: number): string {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =============================================================================
// Component
// =============================================================================

export function VersionHistoryPanel({
    fileId,
    currentContent,
    onRestore,
    className,
}: VersionHistoryPanelProps) {
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isRestoring, setIsRestoring] = useState<string | null>(null);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);

    // Load snapshots
    const loadSnapshots = useCallback(async (append = false) => {
        if (!fileId) {
            setSnapshots([]);
            return;
        }

        setIsLoading(true);
        try {
            const offset = append ? snapshots.length : 0;
            const result = await getFileSnapshots(fileId, { limit: 20, offset });

            if (append) {
                setSnapshots(prev => [...prev, ...result.snapshots]);
            } else {
                setSnapshots(result.snapshots);
            }
            setTotal(result.total);
            setHasMore(result.hasMore);
        } catch (err) {
            console.error('Failed to load snapshots:', err);
            toast.error('Failed to load version history');
        } finally {
            setIsLoading(false);
        }
    }, [fileId, snapshots.length]);

    // Load on mount and when fileId changes
    useEffect(() => {
        loadSnapshots();
    }, [fileId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Save new version
    const handleSaveVersion = async () => {
        if (!fileId || !currentContent) return;

        setIsSaving(true);
        try {
            const result = await createSnapshot(fileId, currentContent, {
                triggerType: 'manual',
                commitMessage: 'Manual save'
            });

            toast.success(`Saved as v${result.snapshot.version_number}`);
            loadSnapshots(); // Refresh list
        } catch (err) {
            console.error('Failed to save version:', err);
            toast.error('Failed to save version');
        } finally {
            setIsSaving(false);
        }
    };

    // Restore version
    const handleRestore = async (snapshotId: string) => {
        if (!fileId) return;

        setIsRestoring(snapshotId);
        try {
            const result = await restoreSnapshot(fileId, snapshotId);

            if (result.success) {
                onRestore?.(result.file.content);
                toast.success(`Restored to v${result.restoredFrom}`);
                loadSnapshots(); // Refresh list
            }
        } catch (err) {
            console.error('Failed to restore:', err);
            toast.error('Failed to restore version');
        } finally {
            setIsRestoring(null);
        }
    };

    // Delete version
    const handleDelete = async (snapshotId: string) => {
        if (!fileId) return;

        try {
            await deleteSnapshot(fileId, snapshotId);
            setSnapshots(prev => prev.filter(s => s.id !== snapshotId));
            setTotal(prev => prev - 1);
            toast.success('Version deleted');
        } catch (err) {
            console.error('Failed to delete:', err);
            toast.error('Failed to delete version');
        }
    };

    // Guest mode
    if (!fileId) {
        return (
            <div className={cn("p-4 text-center text-xs text-muted-foreground", className)}>
                <History className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p>Sign in to access version history</p>
            </div>
        );
    }

    return (
        <div className={cn("border rounded-lg bg-background", className)}>
            {/* Header */}
            <div
                className="flex items-center justify-between px-3 py-2 border-b cursor-pointer hover:bg-muted/30"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-medium">Version History</span>
                    {total > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {total}
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSaveVersion();
                        }}
                        disabled={isSaving || !currentContent}
                    >
                        {isSaving ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <>
                                <Save className="w-3 h-3 mr-1" />
                                Save
                            </>
                        )}
                    </Button>
                    {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <ScrollArea className="h-60">
                    {isLoading && snapshots.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : snapshots.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <AlertCircle className="w-6 h-6 mb-2 opacity-50" />
                            <p className="text-xs">No versions saved yet</p>
                            <p className="text-[10px] opacity-70">Click "Save" to create a version</p>
                        </div>
                    ) : (
                        <div className="p-2 space-y-1">
                            {snapshots.map((snapshot, index) => (
                                <div
                                    key={snapshot.id}
                                    className={cn(
                                        "flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 group",
                                        index === 0 && "bg-blue-50/50"
                                    )}
                                >
                                    {/* Trigger icon */}
                                    <div className="flex-shrink-0 text-muted-foreground">
                                        {getTriggerIcon(snapshot.trigger_type)}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-medium">
                                                v{snapshot.version_number}
                                            </span>
                                            <Badge
                                                variant="outline"
                                                className="text-[9px] px-1 py-0 h-4"
                                            >
                                                {getTriggerLabel(snapshot.trigger_type)}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                            <span>
                                                {formatDistanceToNow(new Date(snapshot.created_at), { addSuffix: true })}
                                            </span>
                                            <span>•</span>
                                            <span>{formatBytes(snapshot.byte_size)}</span>
                                        </div>
                                        {snapshot.commit_message && (
                                            <p className="text-[10px] text-muted-foreground truncate">
                                                {snapshot.commit_message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {/* Restore */}
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    disabled={isRestoring === snapshot.id}
                                                >
                                                    {isRestoring === snapshot.id ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <RotateCcw className="w-3 h-3" />
                                                    )}
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Restore to v{snapshot.version_number}?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will replace your current content with version {snapshot.version_number}.
                                                        A backup of the current state will be saved automatically.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleRestore(snapshot.id)}>
                                                        Restore
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>

                                        {/* Delete */}
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete version?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete version {snapshot.version_number}.
                                                        This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleDelete(snapshot.id)}
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    >
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}

                            {/* Load More */}
                            {hasMore && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full mt-2 text-xs"
                                    onClick={() => loadSnapshots(true)}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                    ) : null}
                                    Load more
                                </Button>
                            )}
                        </div>
                    )}
                </ScrollArea>
            )}
        </div>
    );
}

export default VersionHistoryPanel;
