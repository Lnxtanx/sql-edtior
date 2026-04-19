import { useConnectionEventsData } from '@/lib/api/connection';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import {
    Activity, ArrowDownToLine, ArrowUpFromLine,
    Link, Unlink, FileWarning, RefreshCcw, FilePenLine
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivitySectionProps {
    connectionId: string;
}

export function ActivitySection({ connectionId }: ActivitySectionProps) {
    const { data: events, isLoading, error } = useConnectionEventsData(connectionId, { limit: 20 });

    if (isLoading) {
        return (
            <div className="space-y-3 p-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        );
    }

    if (error) {
        return <div className="p-4 text-sm text-red-500">Failed to load activity</div>;
    }

    if (!events || events.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                <Activity className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-sm">No recent activity</p>
            </div>
        );
    }

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'PULL': return <ArrowDownToLine className="w-4 h-4 text-emerald-500" />;
            case 'PUSH': return <ArrowUpFromLine className="w-4 h-4 text-blue-500" />;
            case 'LINK': return <Link className="w-4 h-4 text-purple-500" />;
            case 'UNLINK': return <Unlink className="w-4 h-4 text-orange-500" />;
            case 'DRIFT_DETECTED': return <FileWarning className="w-4 h-4 text-yellow-500" />;
            case 'UPDATE': return <FilePenLine className="w-4 h-4 text-muted-foreground" />;
            case 'CONNECT': return <RefreshCcw className="w-4 h-4 text-sky-500" />;
            default: return <Activity className="w-4 h-4 text-muted-foreground" />;
        }
    };

    return (
        <div className="space-y-px bg-muted/20">
            {events.map((event) => (
                <div
                    key={event.id}
                    className="flex items-start gap-3 p-3 bg-card hover:bg-muted/50 transition-colors border-b border-border/40 last:border-0"
                >
                    <div className="mt-0.5 p-1.5 bg-background rounded border border-border/50 shadow-sm">
                        {getEventIcon(event.event_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">
                                {event.event_type.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                            </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-2">
                            <span className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                event.status === 'success' ? "bg-emerald-500" :
                                    event.status === 'warning' ? "bg-yellow-500" : "bg-red-500"
                            )} />
                            {event.status}
                            {event.metadata && Object.keys(event.metadata).length > 0 && (
                                <span className="opacity-70">
                                    · {JSON.stringify(event.metadata).substring(0, 50)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
