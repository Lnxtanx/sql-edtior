import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertOctagon, AlertTriangle, Info, Database, ChevronRight } from 'lucide-react';
import type { CompilationLayer, CompilationResult } from '@/lib/schema-compiler/types';
import { LAYER_ICONS, gradeColor } from './utils';
import { IssueCard } from './IssueCard';

export function OverviewView({
    compilation,
    onSelectLayer,
}: {
    compilation: CompilationResult;
    onSelectLayer: (layer: CompilationLayer) => void;
}) {
    const metrics = compilation.metrics;
    const errorCount = compilation.issues.filter(i => i.severity === 'error' || i.severity === 'critical').length;
    const warningCount = compilation.issues.filter(i => i.severity === 'warning').length;
    const infoCount = compilation.issues.filter(i => i.severity === 'info' || i.severity === 'suggestion').length;

    return (
        <div className="p-3 space-y-3">
            {/* Score Card */}
            <div className="flex items-center gap-3 p-2.5 rounded-md bg-muted/40 border">
                <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold border",
                    gradeColor(compilation.overallGrade)
                )}>
                    {compilation.overallGrade}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium">Enterprise Readiness</div>
                    <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-1">
                        <span>Score: {compilation.overallScore}/100</span>
                        <span>&middot;</span>
                        <span>{compilation.totalObjects} objects</span>
                        <span>&middot;</span>
                        <span>{compilation.totalIssues} issues</span>
                    </div>
                    {/* Issue breakdown */}
                    <div className="flex flex-wrap gap-2 mt-1">
                        {errorCount > 0 && (
                            <span className="text-[9px] flex items-center gap-0.5 text-red-600 whitespace-nowrap">
                                <AlertOctagon className="w-2.5 h-2.5 shrink-0" /> {errorCount} errors
                            </span>
                        )}
                        {warningCount > 0 && (
                            <span className="text-[9px] flex items-center gap-0.5 text-yellow-600 whitespace-nowrap">
                                <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> {warningCount} warnings
                            </span>
                        )}
                        {infoCount > 0 && (
                            <span className="text-[9px] flex items-center gap-0.5 text-blue-600 whitespace-nowrap">
                                <Info className="w-2.5 h-2.5 shrink-0" /> {infoCount} info
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Quality Scores */}
            {metrics && (
                <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(metrics.qualityScores).map(([key, metric]) => (
                        <div key={key} className="p-1.5 rounded border bg-muted/20">
                            <div className="text-[9px] text-muted-foreground">{metric.name}</div>
                            <div className="flex items-center gap-1">
                                <div className="text-sm font-semibold">{metric.value}</div>
                                <div className="text-[8px] text-muted-foreground">{metric.unit}</div>
                                <div className={cn(
                                    "ml-auto w-1.5 h-1.5 rounded-full",
                                    metric.status === 'good' ? 'bg-emerald-500' :
                                        metric.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                                )} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Layer Grid */}
            <div>
                <div className="text-[10px] font-medium text-muted-foreground mb-1.5">Compilation Layers</div>
                <div className="space-y-0.5">
                    {compilation.layerSummaries
                        .filter(s => s.objectCount > 0 || s.issueCount > 0)
                        .map(summary => {
                            const Icon = LAYER_ICONS[summary.layer] || Database;
                            return (
                                <button
                                    key={summary.layer}
                                    className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/60 transition-colors text-left"
                                    onClick={() => onSelectLayer(summary.layer)}
                                >
                                    <Icon className="w-3 h-3 shrink-0 text-muted-foreground" />
                                    <span className="text-[10px] flex-1 truncate">{summary.label}</span>
                                    <div className="flex items-center gap-2 ml-auto shrink-0">
                                        <span className="text-[9px] text-muted-foreground w-6 text-right">
                                            {summary.objectCount > 0 ? summary.objectCount : ''}
                                        </span>
                                        <div className="w-4 flex justify-center">
                                            <Badge
                                                variant="outline"
                                                className={cn("text-[8px] h-3.5 px-1 shrink-0", gradeColor(summary.grade))}
                                            >
                                                {summary.grade}
                                            </Badge>
                                        </div>
                                        <div className="w-5 flex justify-center">
                                            {summary.issueCount > 0 && (
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "text-[8px] h-3.5 px-1 shrink-0",
                                                        summary.criticalCount > 0
                                                            ? "bg-red-50 text-red-600 border-red-200"
                                                            : "bg-yellow-50 text-yellow-600 border-yellow-200"
                                                    )}
                                                >
                                                    {summary.issueCount}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                                </button>
                            );
                        })}
                </div>
            </div>

            {/* Top Issues */}
            {compilation.issues.length > 0 && (
                <div>
                    <div className="text-[10px] font-medium text-muted-foreground mb-1.5">Top Issues</div>
                    <div className="space-y-1">
                        {compilation.issues
                            .sort((a, b) => b.riskScore - a.riskScore)
                            .slice(0, 8)
                            .map(issue => (
                                <IssueCard key={issue.id} issue={issue} compact />
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}
