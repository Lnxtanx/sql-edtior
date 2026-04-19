import { ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import { Policy } from '@/lib/sql-parser';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { SchemaTheme } from '../../layout/elk/schemaColors';

interface TablePoliciesProps {
    policies: Policy[];
    expanded: boolean;
    onToggle: () => void;
    theme: SchemaTheme;
}

export const TablePolicies = ({ policies, expanded, onToggle, theme }: TablePoliciesProps) => {
    if (!policies || policies.length === 0) return null;

    return (
        <div className="flex flex-col border-b border-border/30 last:border-0">
            <div
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] transition-colors cursor-pointer select-none group/policyheader"
                style={{
                    backgroundColor: expanded ? `${theme.accent}80` : 'transparent',
                    color: theme.foreground
                }}
                onClick={onToggle}
            >
                <ShieldCheck className="w-3 h-3" />
                <span className="flex-1 font-medium">Policies ({policies.length})</span>
                {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </div>

            {expanded && (
                <div className="px-3 py-2 bg-background/30 border-t border-border/20">
                    <div className="space-y-2 text-xs">
                        {policies.map((p, i) => (
                            <Tooltip key={i} delayDuration={300}>
                                <TooltipTrigger asChild>
                                    <div className="flex flex-col gap-0.5 cursor-help">
                                        <div className="font-bold max-w-[170px] truncate block" style={{ color: theme.foreground }}>{p.name}</div>
                                        <div className="text-[9px] uppercase font-bold text-muted-foreground/80 tracking-wide">
                                            {p.command} {p.roles?.join(', ')}
                                        </div>
                                        {p.usingExpression && (
                                            <div className="text-[10px] bg-muted/50 p-1 rounded font-mono text-muted-foreground mt-0.5 max-w-[170px] truncate">
                                                USING ({p.usingExpression})
                                            </div>
                                        )}
                                        {p.checkExpression && (
                                            <div className="text-[10px] bg-muted/50 p-1 rounded font-mono text-muted-foreground mt-0.5 max-w-[170px] truncate">
                                                WITH CHECK ({p.checkExpression})
                                            </div>
                                        )}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="max-w-xs break-words font-mono text-[10px]">
                                    <div><strong>{p.name}</strong></div>
                                    <div>Roles: {p.roles?.join(', ')}</div>
                                    {p.usingExpression && <div className="mt-1">USING ({p.usingExpression})</div>}
                                    {p.checkExpression && <div className="mt-1">WITH CHECK ({p.checkExpression})</div>}
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
