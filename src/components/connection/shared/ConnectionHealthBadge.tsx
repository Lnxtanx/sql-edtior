// =============================================================================
// ConnectionHealthBadge
// Tiny status indicator for a connection's health.
// Shows: colored dot + latency, or offline/checking state.
// =============================================================================

import { Wifi, WifiOff, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConnectionHealth } from '@/lib/api/connection';

interface ConnectionHealthBadgeProps {
    health?: ConnectionHealth | null;
    showLatency?: boolean;
    className?: string;
}

export function ConnectionHealthBadge({
    health,
    showLatency = true,
    className,
}: ConnectionHealthBadgeProps) {
    if (!health) {
        return (
            <span className={cn("flex items-center gap-1 text-muted-foreground", className)}>
                <Activity className="w-3 h-3 animate-pulse" />
                {showLatency && <span className="text-[10px]">checking...</span>}
            </span>
        );
    }

    if (health.status === 'healthy') {
        return (
            <span className={cn("flex items-center gap-1 text-emerald-600", className)}>
                <Wifi className="w-3 h-3" />
                {showLatency && health.latencyMs && (
                    <span className="text-[10px]">{health.latencyMs}ms</span>
                )}
            </span>
        );
    }

    return (
        <span className={cn("flex items-center gap-1 text-red-500", className)}>
            <WifiOff className="w-3 h-3" />
            {showLatency && <span className="text-[10px]">offline</span>}
        </span>
    );
}
