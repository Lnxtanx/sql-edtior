import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CompilationIssue } from '@/lib/schema-compiler/types';
import { severityIcon, severityBadgeColor } from './utils';

export function IssueCard({ issue, compact = false }: { issue: CompilationIssue; compact?: boolean }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div
            className={cn(
                "rounded border p-1.5 cursor-pointer hover:bg-muted/40 transition-colors",
                issue.severity === 'error' || issue.severity === 'critical'
                    ? 'border-red-200/50'
                    : issue.severity === 'warning'
                        ? 'border-yellow-200/50'
                        : 'border-border'
            )}
            onClick={() => setExpanded(!expanded)}
        >
            <div className="flex items-start gap-1.5">
                {severityIcon(issue.severity)}
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-medium leading-tight">{issue.title}</div>
                    {!compact && (
                        <div className="text-[9px] text-muted-foreground mt-0.5 leading-snug">
                            {issue.message}
                        </div>
                    )}
                </div>
                <Badge
                    variant="outline"
                    className={cn("text-[8px] h-3.5 px-1 shrink-0", severityBadgeColor(issue.severity))}
                >
                    {issue.riskScore}
                </Badge>
            </div>

            {expanded && (
                <div className="mt-1.5 pl-4 space-y-1">
                    {compact && (
                        <div className="text-[9px] text-muted-foreground leading-snug">
                            {issue.message}
                        </div>
                    )}
                    {issue.remediation && (
                        <div className="text-[9px] text-emerald-700 bg-emerald-50/50 rounded px-1.5 py-0.5">
                            <span className="font-medium">Fix: </span>{issue.remediation}
                        </div>
                    )}
                    {issue.sqlFix && (
                        <pre className="text-[8px] bg-slate-800 text-slate-200 rounded px-1.5 py-1 overflow-x-auto">
                            {issue.sqlFix}
                        </pre>
                    )}
                    {issue.affectedObjects.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {issue.affectedObjects.slice(0, 6).map((obj, i) => (
                                <Badge key={i} variant="outline" className="text-[8px] h-3.5 px-1">
                                    {obj.type}: {obj.name}
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
