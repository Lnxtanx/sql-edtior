import { Check } from 'lucide-react';
import { NamedConstraint } from '@/lib/sql-parser';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TableCheckConstraintsProps {
    constraints: NamedConstraint[];
}

export const TableCheckConstraints = ({ constraints }: TableCheckConstraintsProps) => {
    if (!constraints || constraints.length === 0) return null;

    return (
        <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-emerald-700 bg-emerald-50/50 cursor-pointer">
                    <Check className="w-3 h-3" />
                    <span>{constraints.length} check constraint{constraints.length !== 1 ? 's' : ''}</span>
                </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs space-y-1 text-xs break-words font-mono">
                {constraints.map((c, i) => (
                    <div key={i}><strong>{c.name ?? `check_${i + 1}`}:</strong> {c.expression}</div>
                ))}
            </TooltipContent>
        </Tooltip>
    );
};
