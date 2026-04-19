import { GraphStats } from '@/lib/schema-workspace';
import { AlertTriangle, ShieldCheck, Activity, Database, GitBranch, Hash, Eye, Zap, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImpactSummaryProps {
    stats: GraphStats | null;
    isLoading?: boolean;
}

export function ImpactSummary({ stats, isLoading }: ImpactSummaryProps) {
    if (!stats) return null;

    const getRiskColor = (level: string) => {
        switch (level) {
            case 'HIGH': return 'text-red-600 bg-red-50 border-red-200';
            case 'MEDIUM': return 'text-amber-600 bg-amber-50 border-amber-200';
            case 'LOW': return 'text-blue-600 bg-blue-50 border-blue-200';
            default: return 'text-slate-600 bg-slate-50 border-slate-200';
        }
    };

    const getRiskLabel = (level: string) => {
        switch (level) {
            case 'HIGH': return 'High Risk';
            case 'MEDIUM': return 'Medium Risk';
            case 'LOW': return 'Low Risk';
            default: return 'Safe';
        }
    };

    const hasFocusedDetail = stats.focusedTable !== undefined;

    return (
        <div className="space-y-3">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Impact Analysis
            </div>

            {/* Top stat cards */}
            <div className={cn("grid gap-2", hasFocusedDetail ? "grid-cols-3" : "grid-cols-2")}>
                <div className="bg-slate-50 border border-slate-100 rounded p-2 flex flex-col justify-center items-center">
                    <span className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                        <Database className="w-3 h-3" /> Tables
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{stats.tableCount}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded p-2 flex flex-col justify-center items-center">
                    <span className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                        <GitBranch className="w-3 h-3" /> Edges
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{stats.relationshipCount}</span>
                </div>
                {hasFocusedDetail && (
                    <div className="bg-slate-50 border border-slate-100 rounded p-2 flex flex-col justify-center items-center">
                        <span className="text-[10px] text-muted-foreground mb-0.5 flex items-center gap-1">
                            <Hash className="w-3 h-3" /> Indexes
                        </span>
                        <span className="text-sm font-semibold text-slate-700">{stats.indexCount ?? 0}</span>
                    </div>
                )}
            </div>

            {/* Focused table detail rows */}
            {hasFocusedDetail && (
                <div className="space-y-1.5 text-[10px]">
                    {stats.isViewFocus ? (
                        <>
                            {/* View-specific rows */}
                            <div className="flex items-center justify-between px-1">
                                <span className={cn("flex items-center gap-1.5", stats.sourceTableCount === 0 ? "text-slate-400" : "text-slate-600")}>
                                    <Database className="w-3 h-3" /> Source Tables
                                </span>
                                <span className={cn("font-medium", stats.sourceTableCount === 0 ? "text-slate-400" : "text-slate-700")}>{stats.sourceTableCount ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between px-1">
                                <span className={cn("flex items-center gap-1.5", stats.dependentViewCount === 0 ? "text-slate-400" : "text-slate-600")}>
                                    <Eye className="w-3 h-3" /> Dependent Views
                                </span>
                                <span className={cn("font-medium", stats.dependentViewCount === 0 ? "text-slate-400" : "text-slate-700")}>{stats.dependentViewCount ?? 0}</span>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Table-specific rows */}
                            <div className="flex items-center justify-between px-1">
                                <span className={cn("flex items-center gap-1.5", stats.inboundFkCount === 0 ? "text-slate-400" : "text-slate-600")}>
                                    <ArrowLeftRight className="w-3 h-3" /> Inbound FKs
                                </span>
                                <span className={cn("font-medium", stats.inboundFkCount === 0 ? "text-slate-400" : "text-slate-700")}>{stats.inboundFkCount ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between px-1">
                                <span className={cn("flex items-center gap-1.5", stats.outboundFkCount === 0 ? "text-slate-400" : "text-slate-600")}>
                                    <ArrowLeftRight className="w-3 h-3" /> Outbound FKs
                                </span>
                                <span className={cn("font-medium", stats.outboundFkCount === 0 ? "text-slate-400" : "text-slate-700")}>{stats.outboundFkCount ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between px-1">
                                <span className={cn("flex items-center gap-1.5", stats.dependentViewCount === 0 ? "text-slate-400" : "text-slate-600")}>
                                    <Eye className="w-3 h-3" /> Dependent Views
                                </span>
                                <span className={cn("font-medium", stats.dependentViewCount === 0 ? "text-slate-400" : "text-slate-700")}>{stats.dependentViewCount ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between px-1">
                                <span className={cn("flex items-center gap-1.5", stats.policyCount === 0 ? "text-slate-400" : "text-slate-600")}>
                                    <ShieldCheck className="w-3 h-3" /> RLS Policies
                                </span>
                                <span className={cn("font-medium", stats.policyCount === 0 ? "text-slate-400" : "text-slate-700")}>{stats.policyCount ?? 0}</span>
                            </div>
                            <div className="flex items-center justify-between px-1">
                                <span className={cn("flex items-center gap-1.5", stats.triggerCount === 0 ? "text-slate-400" : "text-slate-600")}>
                                    <Zap className="w-3 h-3" /> Triggers
                                </span>
                                <span className={cn("font-medium", stats.triggerCount === 0 ? "text-slate-400" : "text-slate-700")}>{stats.triggerCount ?? 0}</span>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Risk Badge */}
            <div className={cn(
                "border rounded px-3 py-2 flex items-center justify-between",
                getRiskColor(stats.cascadeRiskLevel)
            )}>
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-xs font-semibold">Cascade Risk</span>
                </div>
                <span className="text-xs font-bold" title={`Deleting this table cascades to ${stats.highRiskTableCount} dependent table${stats.highRiskTableCount !== 1 ? 's' : ''}`}>
                    {getRiskLabel(stats.cascadeRiskLevel)}
                </span>
            </div>

            {/* Additional Metrics */}
            {stats.highRiskTableCount > 0 && (
                <div className="text-[10px] text-red-600 flex items-center gap-1.5 px-1">
                    <Zap className="w-3 h-3" />
                    <span>{stats.highRiskTableCount} table{stats.highRiskTableCount !== 1 ? 's' : ''} initiate dangerous cascades</span>
                </div>
            )}

            {stats.avgConfidence < 0.9 && (
                <div className="text-[10px] text-amber-600 flex items-center gap-1.5 px-1">
                    <Activity className="w-3 h-3" />
                    <span>{Math.round(stats.avgConfidence * 100)}% Graph Confidence (inferred edges)</span>
                </div>
            )}
        </div>
    );
}
