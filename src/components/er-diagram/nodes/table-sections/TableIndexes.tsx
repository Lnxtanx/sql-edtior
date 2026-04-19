import { ChevronDown, ChevronRight, ListTree } from 'lucide-react';
import { Index } from '@/lib/sql-parser';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { SchemaTheme } from '../../layout/elk/schemaColors';

interface TableIndexesProps {
    indexes: Index[];
    expanded: boolean;
    onToggle: () => void;
    theme: SchemaTheme;
}

export const TableIndexes = ({ indexes, expanded, onToggle, theme }: TableIndexesProps) => {
    if (!indexes || indexes.length === 0) return null;

    return (
        <div className="flex flex-col border-b border-border/30 last:border-0">
            <div
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] transition-colors cursor-pointer select-none group/indexheader"
                style={{
                    backgroundColor: expanded ? `${theme.accent}80` : 'transparent',
                    color: theme.foreground
                }}
                onClick={onToggle}
            >
                <ListTree className="w-3 h-3" />
                <span className="flex-1 font-medium">Indexes ({indexes.length})</span>
                {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </div>

            {expanded && (
                <div className="px-3 py-2 bg-background/30 border-t border-border/20">
                    <div className="space-y-2 text-xs">
                        {indexes.map((idx, i) => (
                            <Tooltip key={i} delayDuration={300}>
                                <TooltipTrigger asChild>
                                    <div className="flex flex-col gap-0.5 cursor-help">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-bold max-w-[120px] truncate block" style={{ color: theme.foreground }}>{idx.name}</span>
                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">— {idx.type}</span>
                                            {idx.isUnique && <span className="text-[8px] font-bold text-foreground bg-primary/10 rounded-full px-1.5 py-0.5 leading-none self-center border border-primary/20">UNIQUE</span>}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground pl-1 max-w-[170px] truncate">
                                            Columns: <span className="font-medium text-foreground">{idx.columns.join(', ')}</span>
                                        </div>
                                        {idx.whereClause && (
                                            <div className="text-[10px] text-teal-600 dark:text-teal-400 pl-1 font-mono max-w-[170px] truncate block">
                                                WHERE {idx.whereClause}
                                            </div>
                                        )}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs break-words font-mono text-[10px]">
                                    <div><strong>{idx.name}</strong></div>
                                    <div>Type: {idx.type}</div>
                                    <div className="mt-1">Columns: {idx.columns.join(', ')}</div>
                                    {idx.whereClause && <div className="mt-1">WHERE {idx.whereClause}</div>}
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
