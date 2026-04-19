import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Blocks } from 'lucide-react';
import { Extension } from '@/lib/sql-parser';

interface ExtensionNodeData {
    label: string;
    extensionDef: Extension;
}

const ExtensionNode = ({ data }: NodeProps<any>) => {
    const { label, extensionDef } = data as ExtensionNodeData;

    return (
        <div className="bg-card border-2 border-emerald-500/50 rounded-lg shadow-sm min-w-[150px] overflow-hidden">
            {/* Header */}
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2 border-b border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Blocks className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="font-semibold text-sm text-emerald-800 dark:text-emerald-200 truncate pr-2">
                        {label}
                    </h3>
                </div>
            </div>

            {/* Content */}
            <div className="p-3 text-xs space-y-2 font-mono">
                <div className="flex flex-col gap-1">
                    <div className="text-muted-foreground">VERSION</div>
                    <div className="font-semibold text-foreground bg-muted/30 px-2 py-1 rounded">
                        {extensionDef.version || 'latest'}
                    </div>
                </div>
                {extensionDef.schema && (
                    <div className="flex flex-col gap-1">
                        <div className="text-muted-foreground">SCHEMA</div>
                        <div className="font-semibold text-foreground bg-muted/30 px-2 py-1 rounded">
                            {extensionDef.schema}
                        </div>
                    </div>
                )}
            </div>

            <Handle
                type="target"
                position={Position.Left}
                id="default-target"
                className="!w-2 !h-2 !bg-emerald-500 !border-emerald-600"
            />
            <Handle
                type="source"
                position={Position.Right}
                id="default-source"
                className="!w-2 !h-2 !bg-emerald-500 !border-emerald-600"
            />
        </div>
    );
};

export default memo(ExtensionNode);
