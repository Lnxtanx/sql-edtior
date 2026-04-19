// =============================================================================
// ConnectionSelector
// shadcn Command-based dropdown for selecting a connection.
// Shows health status + latency for each option. Keyboard accessible.
// =============================================================================

import { useState } from 'react';
import { Check, ChevronsUpDown, Link2, Wifi, WifiOff, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useConnections, useConnectionHealth } from '../hooks';
import type { Connection } from '@/lib/api/connection';

interface ConnectionSelectorProps {
    selectedId: string | null;
    onSelect: (id: string) => void;
    linkedConnectionId?: string | null;
}

export function ConnectionSelector({
    selectedId,
    onSelect,
    linkedConnectionId,
}: ConnectionSelectorProps) {
    const [open, setOpen] = useState(false);
    const { data: connections } = useConnections();

    const selected = connections?.find(c => c.id === selectedId);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full h-8 justify-between text-xs bg-muted/50"
                >
                    <div className="flex items-center gap-2 truncate">
                        <HealthIcon connectionId={selectedId} />
                        <span className="truncate">
                            {selected?.name || 'Select connection...'}
                        </span>
                        <LatencyLabel connectionId={selectedId} />
                    </div>
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search connections..." className="h-8 text-xs" />
                    <CommandList>
                        <CommandEmpty className="py-3 text-xs text-center">No connections found.</CommandEmpty>
                        <CommandGroup>
                            {(connections || []).map((conn) => (
                                <CommandItem
                                    key={conn.id}
                                    value={conn.name}
                                    onSelect={() => {
                                        onSelect(conn.id);
                                        setOpen(false);
                                    }}
                                    className="text-xs"
                                >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <HealthIcon connectionId={conn.id} />
                                        <span className="truncate">{conn.name}</span>
                                        <span className="text-muted-foreground truncate">({conn.database_name})</span>
                                        {conn.id === linkedConnectionId && (
                                            <Link2 className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <LatencyLabel connectionId={conn.id} />
                                        <Check className={cn("h-3 w-3", selectedId === conn.id ? "opacity-100" : "opacity-0")} />
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

// ─── Small helpers using the shared health query ─────────────────────────────

function HealthIcon({ connectionId }: { connectionId: string | null }) {
    const { data } = useConnectionHealth(connectionId);
    if (!connectionId) return <Activity className="w-3 h-3 text-muted-foreground" />;
    if (data?.status === 'healthy') return <Wifi className="w-3 h-3 text-emerald-500" />;
    if (data?.status === 'unhealthy') return <WifiOff className="w-3 h-3 text-red-500" />;
    return <Activity className="w-3 h-3 text-muted-foreground animate-pulse" />;
}

function LatencyLabel({ connectionId }: { connectionId: string | null }) {
    const { data } = useConnectionHealth(connectionId);
    if (!connectionId || !data) return null;
    if (data.status === 'healthy' && data.latencyMs) {
        return <span className="text-[10px] text-emerald-600">{data.latencyMs}ms</span>;
    }
    if (data.status === 'unhealthy') {
        return <span className="text-[10px] text-red-500">offline</span>;
    }
    return null;
}
