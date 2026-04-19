import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Layers } from 'lucide-react';
import { EnumType, Domain } from '@/lib/sql-parser';
import { useSchemaColor } from '../layout/elk/schemaColors';

export interface TypeNodeData {
    label: string;
    schema?: string;
    typeKind: 'ENUM' | 'DOMAIN';
    enumDef?: EnumType;
    domainDef?: Domain;
    isHighlighted?: boolean;
}

const TypeNode = ({ data }: NodeProps<any>) => {
    const { label, schema, typeKind, enumDef, domainDef, isHighlighted } = data as TypeNodeData;

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
                    <Layers className="w-4 h-4 text-white/90 shrink-0" />
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
                    {typeKind}
                </div>
            </div>

            {/* Body for ENUM */}
            {typeKind === 'ENUM' && enumDef && (
                <div className="px-3 py-2 bg-muted/10 border-t border-border/50">
                    <div className="flex flex-wrap gap-1">
                        {enumDef.values.map((v, i) => (
                            <span key={i} className="text-[10px] font-mono bg-teal-50 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 px-1.5 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                                '{v}'
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Body for DOMAIN */}
            {typeKind === 'DOMAIN' && domainDef && (
                <div className="px-3 py-2 bg-muted/10 border-t border-border/50 space-y-1">
                    <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                        <span>Base Type:</span>
                        <span className="font-mono text-foreground font-medium">{domainDef.baseType}</span>
                    </div>
                    {domainDef.notNull && (
                        <div className="text-[10px] text-muted-foreground">Constraints: <span className="font-mono font-medium">NOT NULL</span></div>
                    )}
                    {domainDef.checkExpression && (
                        <div className="text-[10px] text-muted-foreground line-clamp-2" title={domainDef.checkExpression}>Check: <span className="font-mono font-medium">{domainDef.checkExpression}</span></div>
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

export default memo(TypeNode);
