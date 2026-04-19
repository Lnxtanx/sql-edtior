// =============================================================================
// FileLinkButton
// Small toggle button to link/unlink the current file to a connection.
// ~30 lines of UI — all logic lives in useLinkedConnection hook.
// =============================================================================

import { Link2, Unlink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileLinkButtonProps {
    isLinked: boolean;
    isLinking: boolean;
    onLink: () => void;
    onUnlink: () => void;
    className?: string;
    /** Compact mode: icon-only */
    compact?: boolean;
}

export function FileLinkButton({
    isLinked,
    isLinking,
    onLink,
    onUnlink,
    className,
    compact = false,
}: FileLinkButtonProps) {
    if (isLinking) {
        return (
            <Button variant="ghost" size="icon" className={cn("h-6 w-6", className)} disabled>
                <Loader2 className="w-3 h-3 animate-spin" />
            </Button>
        );
    }

    if (isLinked) {
        return (
            <Button
                variant={compact ? 'ghost' : 'outline'}
                size={compact ? 'icon' : 'sm'}
                className={cn(
                    compact ? 'h-6 w-6 text-emerald-600 hover:text-red-500' : 'h-6 text-[10px] px-2 text-red-600 hover:text-red-700 hover:bg-red-50',
                    className
                )}
                onClick={onUnlink}
                title="Unlink from file"
            >
                <Unlink className="w-3 h-3" />
                {!compact && <span className="ml-1">Unlink</span>}
            </Button>
        );
    }

    return (
        <Button
            variant={compact ? 'ghost' : 'default'}
            size={compact ? 'icon' : 'sm'}
            className={cn(
                compact
                    ? 'h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-emerald-600'
                    : 'h-6 text-[10px] px-2 bg-emerald-600 hover:bg-emerald-700 text-white',
                className
            )}
            onClick={onLink}
            title="Link to current file"
        >
            <Link2 className="w-3 h-3" />
            {!compact && <span className="ml-1">Link</span>}
        </Button>
    );
}
