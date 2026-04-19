import { useState } from 'react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ConnectionSwitcherCard } from './ConnectionSwitcherCard';
import { ConnectionSwitcherEmpty } from './ConnectionSwitcherEmpty';
import { useConnections, useDeleteConnection, useConnectionHealth, useLinkedFiles } from '@/lib/api/connection';
import { useCurrentFile } from '../CurrentFileContext';
import { useLinkedConnection } from '../hooks/useLinkedConnection';
import { useProjectConnection } from '../hooks/useProjectConnection';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ConnectionSwitcherProps {
    children?: React.ReactNode;
    onOpenAddForm: () => void;
    onOpenEditForm: (id: string) => void;
}

function ConnectionCardWithData({
    connection,
    isLinked,
    onDelete,
    onEdit,
    closePopover
}: any) {
    const { data: health } = useConnectionHealth(connection.id);
    const { data: files } = useLinkedFiles(connection.id);
    const linkedFileName = files && files.length > 0 ? files[0].title : undefined;

    return (
        <ConnectionSwitcherCard
            connection={connection}
            health={health}
            isLinked={isLinked}
            linkedFileName={linkedFileName}
            onDelete={onDelete}
            onEdit={onEdit}
            closePopover={closePopover}
        />
    );
}

export function ConnectionSwitcher({ children, onOpenAddForm, onOpenEditForm }: ConnectionSwitcherProps) {
    const { data: connections, isLoading } = useConnections();
    const { fileId: currentFileId, projectId } = useCurrentFile();
    const { linkedConnectionId: fileConnectionId } = useLinkedConnection(currentFileId);
    const { linkedConnectionId: projectConnectionId } = useProjectConnection(projectId ?? null);
    const linkedConnectionId = projectConnectionId || fileConnectionId;
    const { mutate: deleteConnection } = useDeleteConnection();
    const [open, setOpen] = useState(false);

    const closePopover = () => setOpen(false);

    const handleAddClick = () => {
        closePopover();
        onOpenAddForm();
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent className="w-[360px] p-0" align="end" sideOffset={8}>
                <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/40">
                    <span className="font-semibold text-xs tracking-wide uppercase text-muted-foreground whitespace-nowrap">
                        Connections
                    </span>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs w-auto whitespace-nowrap"
                        onClick={handleAddClick}
                    >
                        <Plus className="w-3.5 h-3.5 mr-1 shrink-0" />
                        Add Connection
                    </Button>
                </div>

                <ScrollArea className="h-[min(480px,80vh)]">
                    <div className="p-2 space-y-2">
                        {isLoading ? (
                            <div className="flex justify-center py-6">
                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : !connections || connections.length === 0 ? (
                            <ConnectionSwitcherEmpty onAdd={handleAddClick} />
                        ) : (
                            connections.map(connection => (
                                <ConnectionCardWithData
                                    key={connection.id}
                                    connection={connection}
                                    isLinked={connection.id === linkedConnectionId}
                                    closePopover={closePopover}
                                    onDelete={() => {
                                        if (confirm(`Delete connection "${connection.name}"?`)) {
                                            deleteConnection(connection.id, {
                                                onSuccess: () => toast.success(`Deleted connection ${connection.name}`)
                                            });
                                        }
                                    }}
                                    onEdit={() => {
                                        closePopover();
                                        onOpenEditForm(connection.id);
                                    }}
                                />
                            ))
                        )}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
