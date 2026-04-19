import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { DatabaseZap } from 'lucide-react';
import { Sequence } from '@/lib/sql-parser';
import { useSchemaColor } from '../layout/elk/schemaColors';

export interface SequenceNodeData {
    label: string;
    schema?: string;
    sequenceDef?: Sequence;
    isHighlighted?: boolean;
}

const SequenceNode = ({ data }: NodeProps<any>) => {
    const { label, schema, sequenceDef, isHighlighted } = data as SequenceNodeData;

    const schemaColor = useSchemaColor(schema);
    const headerGradient = schemaColor.header;
    const borderColor = schemaColor.border;

    return (
        <div
            className={`relative bg-background rounded-lg shadow-sm border overflow-hidden flex flex-col`}
            style={{
                borderColor: isHighlighted ? borderColor : 'var(--border)',
                boxShadow: isHighlighted ? `0 0 0 1px ${borderColor}, 0 4px 6px -1px rgb(0 0 0 / 0.1)` : undefined,
                minWidth: '200px',
            }}
        >
            {/* Header */}
            <div className="px-3 py-2 text-white flex items-center justify-between" style={{ background: headerGradient }}>
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <DatabaseZap className="w-4 h-4 text-white/90 shrink-0" />
                    <div className="flex-1 min-w-0">
                        {schema && schema !== 'public' && (
                            <div className="text-[9px] uppercase tracking-wider text-white/70 font-semibold leading-none mb-0.5 truncate">
                                {schema}
                            </div>
                        )}
                        <div className="font-semibold text-xs truncate" title={label}>
                            {label}
                        </div>
                    </div>
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider bg-black/20 px-1.5 py-0.5 rounded ml-2 shrink-0">
                    SEQUENCE
                </div>
            </div>

            {/* Body */}
            {sequenceDef && (
                <div className="px-3 py-2 bg-muted/10 border-t border-border/50 text-[10px] space-y-1">
                    {sequenceDef.start !== undefined && (
                        <div className="flex justify-between text-muted-foreground">
                            <span>Start:</span>
                            <span className="font-mono text-foreground">{sequenceDef.start}</span>
                        </div>
                    )}
                    {sequenceDef.increment !== undefined && (
                        <div className="flex justify-between text-muted-foreground">
                            <span>Increment:</span>
                            <span className="font-mono text-foreground">{sequenceDef.increment}</span>
                        </div>
                    )}
                    {sequenceDef.minValue !== undefined && (
                        <div className="flex justify-between text-muted-foreground">
                            <span>Min:</span>
                            <span className="font-mono text-foreground">{sequenceDef.minValue}</span>
                        </div>
                    )}
                    {sequenceDef.maxValue !== undefined && (
                        <div className="flex justify-between text-muted-foreground">
                            <span>Max:</span>
                            <span className="font-mono text-foreground">{sequenceDef.maxValue}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Handles */}
            <Handle
                type="target"
                position={Position.Left}
                className="!w-2 !h-2 !bg-border border-2 !border-background"
                isConnectable={false}
            />
            <Handle
                type="source"
                position={Position.Right}
                className="!w-2 !h-2 !bg-border border-2 !border-background"
                isConnectable={false}
            />
        </div>
    );
};

export default memo(SequenceNode);
