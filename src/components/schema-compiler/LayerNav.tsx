import { BarChart2, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CompilationLayer, LayerSummary } from '@/lib/schema-compiler/types';
import { LAYER_ICONS } from './utils';

export function LayerNav({
    summaries,
    selected,
    onSelect,
}: {
    summaries: LayerSummary[];
    selected: CompilationLayer | 'overview';
    onSelect: (layer: CompilationLayer | 'overview') => void;
}) {
    return (
        <div className="py-1">
            <button
                className={cn(
                    "w-full flex items-center gap-1.5 px-2 py-1 text-[10px] hover:bg-muted/60 transition-colors",
                    selected === 'overview' && "bg-violet-50 text-violet-700 font-medium"
                )}
                onClick={() => onSelect('overview')}
            >
                <BarChart2 className="w-3 h-3 shrink-0" />
                <span className="truncate">Overview</span>
            </button>

            <div className="h-px bg-border mx-2 my-1" />

            {summaries.map(summary => {
                const Icon = LAYER_ICONS[summary.layer] || Database;
                const isSelected = selected === summary.layer;
                const hasIssues = summary.issueCount > 0;
                const hasCritical = summary.criticalCount > 0;

                return (
                    <button
                        key={summary.layer}
                        className={cn(
                            "w-full flex items-center gap-1.5 px-2 py-0.5 text-[10px] hover:bg-muted/60 transition-colors",
                            isSelected && "bg-violet-50 text-violet-700 font-medium"
                        )}
                        onClick={() => onSelect(summary.layer)}
                        title={`${summary.label}: ${summary.objectCount} objects, ${summary.issueCount} issues`}
                    >
                        <Icon className="w-3 h-3 shrink-0" />
                        <span className="truncate flex-1 text-left">{summary.label}</span>
                        <div className="flex items-center justify-end gap-1.5 shrink-0">
                            <span className="text-[8px] text-muted-foreground w-4 text-right">
                                {summary.objectCount > 0 ? summary.objectCount : ''}
                            </span>
                            <div className="w-[18px] flex justify-center">
                                {hasIssues && (
                                    <span className={cn(
                                        "text-[8px] min-w-[14px] text-center rounded px-0.5",
                                        hasCritical ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-600"
                                    )}>
                                        {summary.issueCount}
                                    </span>
                                )}
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
