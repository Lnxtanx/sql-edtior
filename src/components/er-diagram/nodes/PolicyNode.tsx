import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ShieldCheck } from 'lucide-react';
import { Policy } from '@/lib/sql-parser';

import { useSchemaColor } from '../layout/elk/schemaColors';

export interface PolicyNodeData {
    label: string;
    schema?: string;
    policyDef: Policy;
}

const PolicyNode = ({ data }: NodeProps<any>) => {
    const { label, schema, policyDef } = data as PolicyNodeData;

    const schemaColor = useSchemaColor(schema);
    const borderColor = schemaColor.border;
    const headerGradient = schemaColor.header;

    return (
        <div
            className="bg-card border-2 rounded-lg shadow-sm min-w-[200px] max-w-[280px] overflow-hidden"
            style={{ borderColor }}
        >
            {/* Header */}
            <div className="px-3 py-2 border-b flex items-center justify-between shadow-sm" style={{ background: headerGradient, borderColor: 'rgba(0,0,0,0.1)' }}>
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-white/90" />
                    <h3 className="font-semibold text-sm text-white truncate pr-2">
                        {label}
                    </h3>
                </div>
            </div>

            {/* Content */}
            <div className="p-3 text-xs space-y-2">
                <div className="flex flex-col gap-1">
                    <div className="text-muted-foreground font-mono text-[10px]">COMMAND</div>
                    <div className="font-semibold text-foreground uppercase">
                        {policyDef.command}
                    </div>
                </div>

                {policyDef.roles && policyDef.roles.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <div className="text-muted-foreground font-mono text-[10px]">ROLES</div>
                        <div className="flex flex-wrap gap-1">
                            {policyDef.roles.map(role => (
                                <span key={role} className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                    {role}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {policyDef.usingExpression && (
                    <div className="flex flex-col gap-1 mt-2">
                        <div className="text-muted-foreground font-mono text-[10px]">USING</div>
                        <div className="font-mono text-[10px] bg-muted/30 p-1.5 rounded text-muted-foreground truncate" title={policyDef.usingExpression}>
                            {policyDef.usingExpression}
                        </div>
                    </div>
                )}

                {policyDef.checkExpression && (
                    <div className="flex flex-col gap-1 mt-2">
                        <div className="text-muted-foreground font-mono text-[10px]">WITH CHECK</div>
                        <div className="font-mono text-[10px] bg-muted/30 p-1.5 rounded text-muted-foreground truncate" title={policyDef.checkExpression}>
                            {policyDef.checkExpression}
                        </div>
                    </div>
                )}
            </div>

            <Handle
                type="target"
                position={Position.Left}
                id="default-target"
                className="!w-2 !h-2 !bg-indigo-500 !border-indigo-600 opacity-0"
            />
            <Handle
                type="source"
                position={Position.Right}
                id="default-source"
                className="!w-2 !h-2 !bg-indigo-500 !border-indigo-600 opacity-0"
            />
        </div>
    );
};

export default memo(PolicyNode);
