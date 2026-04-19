import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Database } from 'lucide-react';
import type { CompilationLayer, CompilationResult } from '@/lib/schema-compiler/types';
import { LAYER_ICONS, gradeColor } from './utils';
import { LayerStats } from './LayerStats';
import { LayerObjects } from './LayerObjects';
import { IssueCard } from './IssueCard';

export function LayerDetailView({
    layer,
    compilation,
}: {
    layer: CompilationLayer;
    compilation: CompilationResult;
}) {
    const summary = compilation.layerSummaries.find(s => s.layer === layer);
    const layerIssues = compilation.issues.filter(i => i.layer === layer);
    const Icon = LAYER_ICONS[layer] || Database;

    return (
        <div className="p-3 space-y-3">
            {/* Layer Header */}
            <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-violet-600" />
                <span className="text-xs font-medium">{summary?.label || layer}</span>
                {summary && (
                    <>
                        <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", gradeColor(summary.grade))}>
                            {summary.grade}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                            {summary.objectCount} objects
                        </span>
                    </>
                )}
            </div>

            {/* Layer-specific summary stats */}
            <LayerStats layer={layer} compilation={compilation} />

            {/* Layer Objects Metadata */}
            <LayerObjects layer={layer} compilation={compilation} />

            {/* Issues */}
            {layerIssues.length > 0 ? (
                <div>
                    <div className="text-[10px] font-medium text-muted-foreground mb-1.5">
                        Issues ({layerIssues.length})
                    </div>
                    <div className="space-y-1.5">
                        {layerIssues
                            .sort((a, b) => b.riskScore - a.riskScore)
                            .map(issue => (
                                <IssueCard key={issue.id} issue={issue} />
                            ))}
                    </div>
                </div>
            ) : (
                <div className="text-[10px] text-muted-foreground/70 text-center py-4">
                    No issues found in this layer.
                </div>
            )}
        </div>
    );
}
