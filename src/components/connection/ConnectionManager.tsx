import { useState } from 'react';
import { ConnectionSwitcher } from './switcher/ConnectionSwitcher';
import { ConnectionFormModal } from './form/ConnectionFormModal';
import { DatabaseDashboardPanel } from './dashboard/DatabaseDashboardPanel';
import { Button } from '@/components/ui/button';
import { Database, Wifi } from 'lucide-react';
import { useCurrentFile } from './CurrentFileContext';
import { useLinkedConnection } from './hooks/useLinkedConnection';
import { useProjectConnection } from './hooks/useProjectConnection';
import { useConnections } from '@/lib/api/connection';
import { cn } from '@/lib/utils';

interface ConnectionManagerProps {
    onConnectionSaved?: () => void;
    onSchemaReady?: () => void;
    trigger?: React.ReactNode;
}

export function ConnectionManager({ trigger }: ConnectionManagerProps) {
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const { fileId, projectId } = useCurrentFile();
    const { linkedConnectionId: fileConnectionId } = useLinkedConnection(fileId);
    const { linkedConnectionId: projectConnectionId } = useProjectConnection(projectId ?? null);
    const { data: connections } = useConnections();

    // Project-level connection takes priority, then file-level
    const linkedConnectionId = projectConnectionId || fileConnectionId;
    const linkedConnection = connections?.find((c) => c.id === linkedConnectionId);

    const defaultTrigger = (
        <Button
            variant="outline"
            size="sm"
            className={cn(
                "h-7 text-xs px-2.5 gap-2 transition-all duration-300 font-semibold border-border/40 shadow-sm rounded-full",
                linkedConnectionId
                    ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:border-primary/30"
                    : "bg-background/50 backdrop-blur-sm hover:bg-accent/50 hover:border-border/60"
            )}
            title={linkedConnection ? `Linked to ${linkedConnection.name}` : "Manage database connections"}
        >
            {linkedConnectionId ? (
                <>
                    <Wifi className="w-3.5 h-3.5 shrink-0 animate-pulse text-primary/70" />
                    <span className="truncate max-w-[120px]">{linkedConnection?.name || 'Connected'}</span>
                </>
            ) : (
                <>
                    <Database className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0 group-hover:text-primary transition-colors" />
                    <span>Connect DB</span>
                </>
            )}
        </Button>
    );

    return (
        <>
            <ConnectionSwitcher
                onOpenAddForm={() => {
                    setEditingId(null);
                    setFormOpen(true);
                }}
                onOpenEditForm={(id) => {
                    setEditingId(id);
                    setFormOpen(true);
                }}
            >
                {trigger || defaultTrigger}
            </ConnectionSwitcher>

            <ConnectionFormModal
                isOpen={formOpen}
                onClose={() => {
                    setFormOpen(false);
                    setEditingId(null);
                }}
                editingId={editingId}
            />

            <DatabaseDashboardPanel />
        </>
    );
}
