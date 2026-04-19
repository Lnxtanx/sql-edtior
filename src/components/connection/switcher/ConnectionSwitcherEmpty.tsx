import { Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyProps {
    onAdd: () => void;
}

export function ConnectionSwitcherEmpty({ onAdd }: EmptyProps) {
    return (
        <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                <Database className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-sm">No connections</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto mb-4">
                Add a database connection to start pulling schemas and running migrations.
            </p>
            <Button size="sm" onClick={onAdd} className="w-full">
                Add Connection
            </Button>
        </div>
    );
}
