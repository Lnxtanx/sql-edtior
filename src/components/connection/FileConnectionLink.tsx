/**
 * FileConnectionLink — Slim shell (~60 lines)
 *
 * Shows the current file's linked connection and allows switching.
 * All state comes from useLinkedConnection + useConnections hooks.
 */

import { Link2, Plug, ChevronDown, Check, Loader2, Database, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useLinkedConnection } from './hooks/useLinkedConnection';
import { useConnections } from './hooks';
import type { LinkedConnection } from '@/lib/file-management/api/client';

interface FileConnectionLinkProps {
    fileId: string | null;
    onConnectionChange?: (connection: LinkedConnection | null) => void;
    className?: string;
}

export function FileConnectionLink({ fileId, onConnectionChange, className }: FileConnectionLinkProps) {
    const { linkedConnection, link, unlink, isLinking } = useLinkedConnection(fileId);
    const { data: connections } = useConnections();

    // Guest mode — no file ID
    if (!fileId) {
        return (
            <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
                <Database className="w-3.5 h-3.5" />
                <span>Sign in to link</span>
            </div>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-7 px-2 gap-1.5 text-xs font-normal",
                        linkedConnection ? "text-emerald-600" : "text-muted-foreground",
                        className
                    )}
                    disabled={isLinking}
                >
                    {isLinking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : linkedConnection ? (
                        <Link2 className="w-3.5 h-3.5" />
                    ) : (
                        <Plug className="w-3.5 h-3.5" />
                    )}
                    <span className="max-w-[100px] truncate">
                        {linkedConnection?.name || 'No connection'}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                {/* Current connection info */}
                {linkedConnection && (
                    <>
                        <div className="px-2 py-1.5">
                            <div className="flex items-center gap-2">
                                <Database className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-xs font-medium">{linkedConnection.name}</span>
                            </div>
                            {linkedConnection.database_name && (
                                <span className="text-[10px] text-muted-foreground ml-5">
                                    {linkedConnection.database_name}
                                </span>
                            )}
                        </div>
                        <DropdownMenuSeparator />
                    </>
                )}

                {/* Available connections */}
                {!connections || connections.length === 0 ? (
                    <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                        No connections saved.
                        <br />
                        <span className="text-[10px]">Use the Connection panel to add one.</span>
                    </div>
                ) : (
                    <>
                        <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                            {linkedConnection ? 'Switch to' : 'Link to'}
                        </div>
                        {connections.map((conn) => (
                            <DropdownMenuItem
                                key={conn.id}
                                onClick={() => link(conn.id)}
                                className="gap-2"
                            >
                                <Plug className="w-3.5 h-3.5" />
                                <span className="flex-1 truncate">{conn.name}</span>
                                {linkedConnection?.id === conn.id && (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                )}
                            </DropdownMenuItem>
                        ))}
                    </>
                )}

                {/* Unlink option */}
                {linkedConnection && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => unlink()}
                            className="gap-2 text-destructive focus:text-destructive"
                        >
                            <Unlink className="w-3.5 h-3.5" />
                            <span>Unlink connection</span>
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default FileConnectionLink;
