import { useLinkedFiles } from '@/lib/api/connection';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { FileCode2, Info } from 'lucide-react';
import { useCurrentFile } from '../CurrentFileContext';
import { cn } from '@/lib/utils';

interface LinkedFilesSectionProps {
    connectionId: string;
}

export function LinkedFilesSection({ connectionId }: LinkedFilesSectionProps) {
    const { data: files, isLoading, error } = useLinkedFiles(connectionId);
    const { fileId } = useCurrentFile();

    if (isLoading) {
        return (
            <div className="space-y-2 p-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
            </div>
        );
    }

    if (error) {
        return <div className="p-4 text-sm text-red-500">Failed to load linked files</div>;
    }

    if (!files || files.length === 0) {
        return (
            <div className="p-6 text-center text-muted-foreground flex flex-col items-center">
                <FileCode2 className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-sm">No files linked to this connection</p>
                <div className="mt-2 text-xs opacity-70 flex items-start gap-1 max-w-[200px] text-left">
                    <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>Multiple files can share a single database connection.</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-px bg-muted/20">
            {files.map((file) => {
                const isCurrent = file.id === fileId;
                return (
                    <div
                        key={file.id}
                        className={cn(
                            "flex items-center justify-between p-3 bg-card border-b border-border/40 last:border-0",
                            isCurrent && "bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-inset ring-blue-500/20"
                        )}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                                "p-1.5 rounded",
                                isCurrent ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-muted"
                            )}>
                                <FileCode2 className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium truncate flex items-center gap-2">
                                    {file.title || 'Untitled file'}
                                    {isCurrent && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 font-semibold uppercase tracking-wide">
                                            Current
                                        </span>
                                    )}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                    Updated {formatDistanceToNow(new Date(file.updated_at), { addSuffix: true })}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
