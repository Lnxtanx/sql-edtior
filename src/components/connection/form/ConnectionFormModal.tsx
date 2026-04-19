import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ConnectionForm } from '../shared/ConnectionForm';
import { useConnections, useSaveConnection, useUpdateConnection, useTestConnection } from '@/lib/api/connection';
import { useLinkedConnection } from '../hooks/useLinkedConnection';
import { useCurrentFile } from '../CurrentFileContext';
import { toast } from 'sonner';

interface ConnectionFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    editingId?: string | null;
}

export function ConnectionFormModal({ isOpen, onClose, editingId }: ConnectionFormModalProps) {
    const { data: connections } = useConnections();
    const editingConnection = connections?.find((c) => c.id === editingId);

    const { mutate: saveConnection, isPending: isSavingNew } = useSaveConnection();
    const { mutate: updateConnection, isPending: isUpdating } = useUpdateConnection();
    const { mutate: testConnection, isPending: isTesting, data: testResult, reset: resetTest } = useTestConnection();

    const { fileId } = useCurrentFile();
    const { link } = useLinkedConnection(fileId);

    const isSaving = isSavingNew || isUpdating;

    const handleSave = (name: string, credentials: any) => {
        if (editingConnection) {
            updateConnection(
                { id: editingConnection.id, name, credentials },
                {
                    onSuccess: () => {
                        toast.success(`Updated connection ${name}`);
                        onClose();
                    },
                    onError: (err: any) => toast.error(`Failed to update: ${err.message}`)
                }
            );
        } else {
            saveConnection(
                { name, credentials },
                {
                    onSuccess: (data: any) => {
                        toast.success(`Saved connection ${name}`);
                        if (fileId && data.connection) {
                            link(data.connection.id);
                        }
                        onClose();
                    },
                    onError: (err: any) => toast.error(`Failed to save: ${err.message}`)
                }
            );
        }
    };

    const handleTest = (credentials: any) => {
        testConnection(credentials, {
            onSuccess: (res) => {
                if (res.success) {
                    toast.success(`Connected — ${res.serverVersion || 'OK'}`);
                }
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                resetTest();
                onClose();
            }
        }}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{editingConnection ? 'Edit Connection' : 'Add Connection'}</DialogTitle>
                    <DialogDescription>
                        {editingConnection ? 'Update database connection details.' : 'Connect to a new PostgreSQL database.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[70vh] overflow-y-auto overflow-x-hidden pr-2 -mr-2">
                    <div className="pb-2">
                        <ConnectionForm
                            key={editingId || 'new'}
                            initialValues={editingConnection ? {
                                name: editingConnection.name,
                                host: '',
                                port: '5432',
                                database: editingConnection.database || (editingConnection as any).database_name || '',
                                username: '',
                                password: '',
                                sslMode: (editingConnection as any).ssl_mode || 'disable',
                            } : undefined}
                            onSave={handleSave}
                            onTest={handleTest}
                            isSaving={isSaving}
                            isTesting={isTesting}
                            testResult={testResult}
                            onClearResult={resetTest}
                            saveLabel={editingConnection ? 'Update' : 'Save'}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
