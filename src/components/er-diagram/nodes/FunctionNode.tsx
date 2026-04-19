import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Code2 } from 'lucide-react';
import { useSchemaColor } from '../layout/elk/schemaColors';

export interface FunctionNodeData {
    label: string;
    schema?: string;
    isProcedure?: boolean;
    returnType?: string;
    isHighlighted?: boolean;
}

const FunctionNode = ({ data }: NodeProps<any>) => {
    const { label, schema, isProcedure, returnType, isHighlighted } = data as FunctionNodeData;

    const schemaColor = useSchemaColor(schema);
    const borderColor = schemaColor.border;
    const headerGradient = schemaColor.header;

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
                    <Code2 className="w-4 h-4 text-white/90 shrink-0" />
                    <div className="flex-1 min-w-0">
                        {schema && schema !== 'public' && (
                            <div className="text-[9px] uppercase tracking-wider text-white/70 font-semibold leading-none mb-0.5 truncate">
                                {schema}
                            </div>
                        )}
                        <div className="font-semibold text-xs truncate" title={label}>
                            {label}()
                        </div>
                    </div>
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider bg-black/20 px-1.5 py-0.5 rounded ml-2 shrink-0">
                    {isProcedure ? 'PROC' : 'FUNC'}
                </div>
            </div>

            {/* Body */}
            {returnType && (
                <div className="px-3 py-1.5 bg-muted/10 border-t border-border/50 text-[10px] text-muted-foreground">
                    Returns: <span className="font-mono text-foreground font-medium">{returnType}</span>
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

export default memo(FunctionNode);
