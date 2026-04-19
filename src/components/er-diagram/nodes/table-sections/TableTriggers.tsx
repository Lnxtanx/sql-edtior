import { ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { Trigger } from '@/lib/sql-parser';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { SchemaTheme } from '../../layout/elk/schemaColors';

interface TableTriggersProps {
    triggers: Trigger[];
    expanded: boolean;
    onToggle: () => void;
    theme: SchemaTheme;
}

export const TableTriggers = ({ triggers, expanded, onToggle, theme }: TableTriggersProps) => {
    if (!triggers || triggers.length === 0) return null;

    return (
        <div className="flex flex-col border-b border-border/30 last:border-0">
            <div
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] transition-colors cursor-pointer select-none group/triggerheader"
                style={{
                    backgroundColor: expanded ? `${theme.accent}80` : 'transparent',
                    color: theme.foreground
                }}
                onClick={onToggle}
            >
                <Zap className="w-3 h-3" />
                <span className="flex-1 font-medium">Triggers ({triggers.length})</span>
                {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </div>

            {expanded && (
                <div className="px-3 py-2 bg-background/30 border-t border-border/20">
                    <div className="space-y-2 text-xs">
                        {triggers.map((t, i) => (
                            <Tooltip key={i} delayDuration={300}>
                                <TooltipTrigger asChild>
                                    <div className="flex flex-col gap-0.5 cursor-help">
                                        <div className="font-bold max-w-[170px] truncate block" style={{ color: theme.foreground }}>{t.name}</div>
                                        <div className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wide">
                                            {t.timing} {t.events.join(' OR ')}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 max-w-[170px] truncate block">
                                            Calls: <span className="font-mono text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline">{t.functionName}()</span>
                                        </div>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs break-words font-mono text-[10px]">
                                    <div><strong>{t.name}</strong></div>
                                    <div>Events: {t.timing} {t.events.join(' OR ')}</div>
                                    <div className="mt-1 text-indigo-400">Calls: {t.functionName}()</div>
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
