/**
 * Connection Control Panel — Sidebar Terminal Takeover
 *
 * Two modes:
 *  1. Dashboard mode (default): ConnectionSelector + DatabaseDashboard fill sidebar
 *  2. Terminal mode: Dashboard collapses to thin strip, terminal fills remaining space
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Plug, X, TerminalSquare, Database, LayoutDashboard, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { ConnectionSelector } from './ConnectionSelector';
import { DatabaseDashboard } from './DatabaseDashboard';
import { ConnectionCLI, type ConnectionCLIHandle } from '../ConnectionCLI';
import { useConnections, useConnectionHealth } from '../hooks';
import { useProjectConnection } from '../hooks/useProjectConnection';
import { useCurrentFile } from '../CurrentFileContext';

// =============================================================================
// Types
// =============================================================================

interface ConnectionPanelProps {
    onClose: () => void;
    onSchemaPulled?: (schema: any) => void;
}

// =============================================================================
// Connection Panel Component
// =============================================================================

export function ConnectionPanel({ onClose, onSchemaPulled }: ConnectionPanelProps) {
    const { fileId: currentFileId, fileName: currentFileName, connectionId: fileLinkedConnectionId, projectId } = useCurrentFile();
    const { linkedConnectionId: projectConnectionId } = useProjectConnection(projectId ?? null);

    // Project-level connection takes priority over file-level
    const linkedConnectionId = projectConnectionId || fileLinkedConnectionId;

    // Connection selection
    // Auto-select the linked connection on mount if one exists
    const [selectedId, setSelectedId] = useState<string | null>(linkedConnectionId ?? null);
    const { data: connections } = useConnections();
    const selectedConnection = connections?.find(c => c.id === selectedId);

    // Terminal takeover state
    const cliRef = useRef<ConnectionCLIHandle>(null);
    const [showTerminal, setShowTerminal] = useState(false);

    // Auto-select connection when file or project connection changes
    useEffect(() => {
        if (linkedConnectionId) {
            setSelectedId(linkedConnectionId);
        }
    }, [linkedConnectionId]);

    // ─── Command dispatch (from CommandReference clicks) ─────────────────────


    const handleOpenTerminal = useCallback(() => {
        setShowTerminal(true);
    }, []);

    const handleCloseTerminal = useCallback(() => {
        setShowTerminal(false);
    }, []);

    const handleShowDashboard = useCallback(() => {
        setShowTerminal(false);
    }, []);

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="h-full flex flex-col bg-background border-r border-border">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                    <Plug className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-medium">Database Connection</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-5 w-5", showTerminal && "bg-muted")}
                        onClick={() => setShowTerminal(!showTerminal)}
                        title={showTerminal ? "Show Dashboard" : "Open Terminal"}
                    >
                        <TerminalSquare className="w-3 h-3 text-muted-foreground" />
                    </Button>
                </div>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
                    <X className="w-3 h-3" />
                </Button>
            </div>

            {/* Connection Selector — always visible */}
            <div className="px-3 py-2 border-b border-border">
                <ConnectionSelector
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    linkedConnectionId={linkedConnectionId ?? null}
                />
            </div>

            {/* ─── MODE: Terminal Open ─────────────────────────────────────── */}
            {showTerminal ? (
                <>
                    {/* Collapsed dashboard strip */}
                    {selectedConnection && (
                        <CollapsedDashboardStrip
                            connection={selectedConnection}
                            onShowDashboard={handleShowDashboard}
                        />
                    )}

                    {/* Terminal fills remaining space */}
                    <ConnectionCLI
                        ref={cliRef}
                        connectionId={selectedId}
                        connectionName={selectedConnection?.name}
                        onClose={handleCloseTerminal}
                        fileName={currentFileName || undefined}
                        onSchemaPulled={onSchemaPulled}
                    />
                </>
            ) : (
                /* ─── MODE: Dashboard (default) ──────────────────────────── */
                <>
                    {selectedConnection ? (
                        <DatabaseDashboard
                            connection={selectedConnection}
                            onSchemaPulled={onSchemaPulled}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground px-6">
                            <Database className="w-10 h-10 mb-3 text-muted-foreground/30" />
                            <p className="text-xs font-medium mb-1">No connection selected</p>
                            <p className="text-[11px] text-center text-muted-foreground/60">
                                Select a connection above or create one from the header button to get started.
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

// =============================================================================
// Collapsed Dashboard Strip — Thin bar when terminal is open
// =============================================================================

function CollapsedDashboardStrip({
    connection,
    onShowDashboard,
}: {
    connection: { id: string; name: string };
    onShowDashboard: () => void;
}) {
    const { data: health } = useConnectionHealth(connection.id);
    const isHealthy = health?.status === 'healthy';

    return (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/20 min-h-[32px]">
            <div className="flex items-center gap-2 min-w-0">
                <Database className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-[11px] font-medium truncate">{connection.name}</span>
                {isHealthy && health?.latencyMs && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                        <Wifi className="w-2.5 h-2.5" />
                        {health.latencyMs}ms
                    </span>
                )}
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={onShowDashboard}
                title="Show Dashboard"
            >
                <LayoutDashboard className="w-3 h-3 text-muted-foreground" />
            </Button>
        </div>
    );
}

export default ConnectionPanel;
