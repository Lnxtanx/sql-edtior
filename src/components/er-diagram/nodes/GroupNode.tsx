import { memo } from 'react';
import { NodeProps, NodeResizer, Handle, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { useSchemaColor } from '../layout/elk/schemaColors';
import { Button } from '@/components/ui/button';
import { Layers, Sparkles, Maximize2 } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface GroupStats {
    tableCount: number;
    viewCount: number;
    relCount: number;
}

interface GroupNodeData {
    label: string;
    schemaColor?: { bg: string; border: string; header: string };
    stats?: GroupStats;
    onResize?: (schema: string, width: number, height: number) => void;
    onAutoFit?: (schema: string) => void;
}

const GroupNode = ({ data, selected }: NodeProps<any>) => {
    const { label, stats } = data as GroupNodeData;
    const schemaColor = useSchemaColor(label);
    const borderColor = schemaColor.border;

    // Apply alpha transparency to the HSL color
    const applyAlpha = (colorStr: string, alpha: number) => {
        if (colorStr.startsWith('hsl(')) {
            return colorStr.replace('hsl(', 'hsla(').replace(')', `, ${alpha})`);
        }
        return `rgba(248, 250, 252, ${alpha})`;
    };

    const bgColor = applyAlpha(borderColor, selected ? 0.12 : 0.04);

    return (
        <>
            <NodeResizer
                color={borderColor}
                isVisible={true}
                minWidth={300}
                minHeight={300}
                handleStyle={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    opacity: selected ? 1 : 0.25,
                }}
                lineStyle={{
                    opacity: selected ? 1 : 0,
                }}
                onResizeEnd={(event, params) => {
                    data.onResize?.(label, params.width, params.height);
                }}
            />
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        className={cn(
                            "w-full h-full rounded-2xl border-2 shadow-sm transition-all overflow-hidden flex flex-col hover:shadow-lg",
                            selected && "ring-4 shadow-md"
                        )}
                        style={{
                            borderColor,
                            backgroundColor: bgColor,
                            backdropFilter: 'blur(4px)',
                            ...(selected ? { '--tw-ring-color': applyAlpha(borderColor, 0.4) } as React.CSSProperties : {})
                        }}
                    >
                        {/* Header */}
                        <div
                            className="px-3 py-2 flex items-center gap-2 border-b border-black/10 dark:border-white/10"
                            style={{ background: schemaColor.header }}
                        >
                            <Layers className="w-3.5 h-3.5 text-white/90 shrink-0" />
                            <span className="font-bold text-xs text-white/95 uppercase tracking-wider truncate">{label}</span>

                            {/* Stats badges */}
                            {stats && (
                                <div className="ml-auto flex items-center gap-1 shrink-0">
                                    {stats.tableCount > 0 && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="text-[9px] font-semibold bg-white/20 text-white/90 px-1.5 py-0.5 rounded-full cursor-default">
                                                    {stats.tableCount} {stats.tableCount === 1 ? 'table' : 'tables'}
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom">
                                                <p className="text-xs">{stats.tableCount} Tables</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                    {stats.viewCount > 0 && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="text-[9px] font-semibold bg-white/20 text-white/90 px-1.5 py-0.5 rounded-full cursor-default">
                                                    {stats.viewCount} {stats.viewCount === 1 ? 'view' : 'views'}
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom">
                                                <p className="text-xs">{stats.viewCount} Views / Materialized Views</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                    {stats.relCount > 0 && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span className="text-[9px] font-semibold bg-white/20 text-white/90 px-1.5 py-0.5 rounded-full cursor-default">
                                                    {stats.relCount} {stats.relCount === 1 ? 'relation' : 'relations'}
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom">
                                                <p className="text-xs">{stats.relCount} Internal Relationships</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                    {/* Group AI button */}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (data.onGroupAI) {
                                                        data.onGroupAI(label);
                                                    }
                                                }}
                                            >
                                                <img src="/resona.png" alt="Resona" className="w-3 h-3" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">Resona AI</TooltipContent>
                                    </Tooltip>

                                    {/* AutoFit button */}
                                    {data.onAutoFit && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); data.onAutoFit?.(label); }}
                                            className="ml-1 flex items-center justify-center w-4 h-4 bg-white/20 hover:bg-white/35 rounded-full transition-colors"
                                            title="Auto-fit to contents"
                                        >
                                            <Maximize2 className="w-2.5 h-2.5 text-white/90" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 relative">
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <Layers
                                    className="opacity-[0.04]"
                                    style={{ width: 80, height: 80, color: borderColor }}
                                />
                            </div>
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                    <div className="space-y-1 text-xs">
                        <p className="font-bold text-sm">{label} schema</p>
                        {stats && (
                            <>
                                <p><strong>Tables:</strong> {stats.tableCount}</p>
                                <p><strong>Views:</strong> {stats.viewCount}</p>
                                <p><strong>Relationships:</strong> {stats.relCount}</p>
                            </>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
            {/* Source handle for Resona AI edge — must be outside TooltipTrigger (asChild expects single child) */}
            <Handle
                type="source"
                position={Position.Right}
                id="resona-source"
                className="!w-0 !h-0 !border-0 !bg-transparent"
                style={{ top: 20 }}
            />
        </>
    );
};

export default memo(GroupNode);
