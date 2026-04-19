import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Eye, Database, RefreshCw, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

import { useSchemaColor } from '../layout/elk/schemaColors';
export interface ViewNodeData {
    label: string;
    schema?: string;
    isMaterialized?: boolean;
    columnCount?: number;
    columns?: string[];
    onSubgraph?: (viewId: string) => void;
}

const ViewNode = ({ id, data, selected }: NodeProps) => {
    const { label, schema, isMaterialized, columnCount, columns, onSubgraph } = data as unknown as ViewNodeData;

    const schemaColor = useSchemaColor(schema);
    const borderColor = schemaColor.border;
    const headerGradient = schemaColor.header;
    const badge = isMaterialized ? 'MAT VIEW' : 'VIEW';
    const Icon = isMaterialized ? Database : Eye;

    return (
        <div
            className={cn(
                "bg-card border-2 border-dashed rounded-xl shadow-md min-w-[180px] max-w-[260px] overflow-hidden transition-all font-sans",
                selected && "ring-2 ring-offset-1 shadow-lg",
            )}
            style={{ borderColor }}
        >
            <div className="px-3 py-2 relative" style={{ background: headerGradient }}>
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-white/90" />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-white truncate">{label}</h3>
                        <div className="flex items-center gap-1.5">
                            {schema && (
                                <span className="text-[10px] text-white/70">{schema}.</span>
                            )}
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-white/20 text-white px-1.5 py-0.5 rounded">
                                {badge}
                            </span>
                            {isMaterialized && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <RefreshCw className="w-3 h-3 text-white/70 hover:text-white cursor-help transition-colors" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-xs">
                                        <p className="text-xs font-medium">Materialized View</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            Refresh with: <code className="bg-muted px-1 rounded">REFRESH MATERIALIZED VIEW {schema ? `${schema}.` : ''}{label}</code>
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            {columnCount !== undefined && (
                                <span className="text-[10px] text-white/70 ml-auto">
                                    {columnCount} col{columnCount !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    </div>
                    {onSubgraph && (
                        <button
                            className="w-6 h-6 bg-white/20 hover:bg-white/30 rounded flex items-center justify-center cursor-pointer transition-colors flex-shrink-0"
                            onClick={(e) => { e.stopPropagation(); onSubgraph(id); }}
                            title="View Graph Network"
                        >
                            <Network className="w-3 h-3 text-white" />
                        </button>
                    )}
                </div>
            </div>

            {/* View columns */}
            {columns && columns.length > 0 && (
                <div className="max-h-[120px] overflow-y-auto">
                    {columns.map((col, i) => (
                        <div
                            key={col}
                            className="flex items-center gap-2 px-3 py-1 text-xs border-t border-border/50 hover:bg-muted/50 transition-colors"
                        >
                            <Eye className="w-2.5 h-2.5 text-muted-foreground/50" />
                            <span className="text-muted-foreground truncate">{col}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Default handles */}
            <Handle
                type="target"
                position={Position.Left}
                id="default-target"
                className="!w-3 !h-3 !bg-muted !border-muted-foreground !opacity-0"
            />
            <Handle
                type="source"
                position={Position.Right}
                id="default-source"
                className="!w-3 !h-3 !bg-muted !border-muted-foreground !opacity-0"
            />
        </div>
    );
};

export default memo(ViewNode);

