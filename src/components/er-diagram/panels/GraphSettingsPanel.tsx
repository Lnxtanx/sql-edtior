import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { X, GripHorizontal, Settings2, Activity, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import { ImpactSummary } from '@/components/schema-workspace/ImpactSummary';
import { GraphStats, SchemaGraph } from '@/lib/schema-workspace';
import { getGraphStats } from '@/lib/schema-workspace';

export interface GraphSettingsConfig {
    focusTable: string | null;
    depth: number;
    direction: 'outbound' | 'inbound' | 'both';
    showViews?: boolean;
    showMaterializedViews?: boolean;
    showFunctions?: boolean;
    showEnums?: boolean;
    showDomains?: boolean;
    showRoles?: boolean;
    showSequences?: boolean;
    showExtensions?: boolean;
    showPolicies?: boolean;
    minConfidence?: number;
    strictMode?: boolean;
}

interface GraphSettingsPanelProps {
    config: GraphSettingsConfig;
    onConfigChange: (config: GraphSettingsConfig) => void;
    stats: GraphStats | null;
    defaultTab?: 'settings' | 'impact';
    onClose: () => void;
    graph?: SchemaGraph | null;
}

export function GraphSettingsPanel({
    config,
    onConfigChange,
    stats,
    defaultTab = 'settings',
    onClose,
    graph,
}: GraphSettingsPanelProps) {
    const [activeTab, setActiveTab] = useState<'settings' | 'impact'>(defaultTab);
    const dragControls = useDragControls();
    const [size, setSize] = useState({ width: 420, height: 420 });
    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const schemaStats = useMemo(() => graph ? getGraphStats(graph) : null, [graph]);

    const depth = config.depth;
    const direction = config.direction;
    const showViews = config.showViews ?? true;
    const showMaterializedViews = config.showMaterializedViews ?? true;
    const showFunctions = config.showFunctions ?? true;
    const showEnums = config.showEnums ?? true;
    const showDomains = config.showDomains ?? true;
    const showRoles = config.showRoles ?? true;
    const showSequences = config.showSequences ?? true;
    const showExtensions = config.showExtensions ?? true;
    const showPolicies = config.showPolicies ?? true;
    const minConfidence = config.minConfidence ?? 0;

    const updateConfig = (updates: Partial<GraphSettingsConfig>) => {
        onConfigChange({ ...config, ...updates });
    };

    // Resize handler
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !panelRef.current) return;
            const rect = panelRef.current.getBoundingClientRect();
            setSize({
                width: Math.max(300, Math.min(e.clientX - rect.left, 600)),
                height: Math.max(300, Math.min(e.clientY - rect.top, 800)),
            });
        };
        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
        };
        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'nwse-resize';
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    return (
        <motion.div
            ref={panelRef}
            drag
            dragListener={false}
            dragControls={dragControls}
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={{ width: size.width, height: size.height }}
            className="absolute top-[5%] right-4 z-50
                 bg-card border border-border
                 shadow-2xl rounded-xl flex flex-col overflow-hidden
                 ring-1 ring-black/5 dark:ring-white/10"
        >
            {/* Header / Drag Handle */}
            <div
                className="flex items-center justify-between px-3 py-2
                       bg-muted cursor-grab active:cursor-grabbing
                       border-b border-border select-none"
                onPointerDown={(e) => dragControls.start(e)}
            >
                <div className="flex items-center gap-2">
                    <GripHorizontal className="w-4 h-4 opacity-40" />
                    <span className="text-xs font-medium text-muted-foreground">Graph</span>
                    {config.focusTable && (
                        <span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded truncate max-w-[140px]">
                            {config.focusTable}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'settings' | 'impact')}>
                        <TabsList className="h-7 bg-background/50">
                            <TabsTrigger value="settings" className="text-xs gap-1 px-2.5 h-6">
                                <Settings2 className="w-3 h-3" /> Settings
                            </TabsTrigger>
                            <TabsTrigger value="impact" className="text-xs gap-1 px-2.5 h-6">
                                <Activity className="w-3 h-3" /> Impact
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Button
                        variant="ghost" size="icon"
                        className="h-6 w-6 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                        onClick={onClose}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        <X className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4 scrollbar-thin">
                {activeTab === 'settings' && (
                    <div className="space-y-4">
                        {/* Depth */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-600">Depth</span>
                                <span className="text-[10px] font-medium bg-slate-100 px-1.5 py-0.5 rounded">{depth} levels</span>
                            </div>
                            <Slider
                                value={[depth]}
                                onValueChange={(vals) => updateConfig({ depth: vals[0] })}
                                min={1}
                                max={3}
                                step={1}
                                className="w-full [&_.bg-primary]:bg-indigo-500"
                            />
                            {stats?.depthCounts ? (
                                <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500">
                                    {Array.from(stats.depthCounts.entries())
                                        .sort((a, b) => a[0] - b[0])
                                        .map(([d, count]) => (
                                            <span key={d} className="bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                                L{d}: {count}
                                            </span>
                                        ))}
                                </div>
                            ) : config.focusTable ? (
                                <div className="flex items-center gap-1 mt-2">
                                    <div className="h-4 w-10 bg-slate-100 rounded animate-pulse" />
                                    <div className="h-4 w-10 bg-slate-100 rounded animate-pulse" />
                                </div>
                            ) : null}
                        </div>

                        {/* Direction */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-slate-600 block">Direction</span>
                            <div className="flex bg-slate-50 rounded p-0.5 w-full border border-slate-100">
                                <button
                                    className={cn("flex-1 px-2 py-1 rounded-sm text-[10px] text-center transition-all", direction === 'outbound' ? "bg-card shadow-sm text-indigo-600 font-medium border border-slate-100" : "text-slate-500 hover:text-slate-700")}
                                    onClick={() => updateConfig({ direction: 'outbound' })}
                                >Out</button>
                                <button
                                    className={cn("flex-1 px-2 py-1 rounded-sm text-[10px] text-center transition-all", direction === 'inbound' ? "bg-card shadow-sm text-indigo-600 font-medium border border-slate-100" : "text-slate-500 hover:text-slate-700")}
                                    onClick={() => updateConfig({ direction: 'inbound' })}
                                >In</button>
                                <button
                                    className={cn("flex-1 px-2 py-1 rounded-sm text-[10px] text-center transition-all", direction === 'both' ? "bg-card shadow-sm text-indigo-600 font-medium border border-slate-100" : "text-slate-500 hover:text-slate-700")}
                                    onClick={() => updateConfig({ direction: 'both' })}
                                >Both</button>
                            </div>
                        </div>

                        {/* Include */}
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-slate-600 block">Include</span>
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <div className={cn("w-3 h-3 rounded border flex items-center justify-center transition-colors", showViews ? "bg-indigo-500 border-indigo-500" : "border-slate-300 bg-card")}>
                                        {showViews && <Check className="w-2 h-2 text-white" />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={showViews}
                                        onChange={(e) => updateConfig({ showViews: e.target.checked })}
                                        className="sr-only"
                                    />
                                    <span className="text-[10px] text-slate-600">Views</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <div className={cn("w-3 h-3 rounded border flex items-center justify-center transition-colors", showMaterializedViews ? "bg-indigo-500 border-indigo-500" : "border-slate-300 bg-card")}>
                                        {showMaterializedViews && <Check className="w-2 h-2 text-white" />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={showMaterializedViews}
                                        onChange={(e) => updateConfig({ showMaterializedViews: e.target.checked })}
                                        className="sr-only"
                                    />
                                    <span className="text-[10px] text-slate-600">Mat Views</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <div className={cn("w-3 h-3 rounded border flex items-center justify-center transition-colors", showFunctions ? "bg-indigo-500 border-indigo-500" : "border-slate-300 bg-card")}>
                                        {showFunctions && <Check className="w-2 h-2 text-white" />}
                                    </div>
                                    <input type="checkbox" checked={showFunctions} onChange={(e) => updateConfig({ showFunctions: e.target.checked })} className="sr-only" />
                                    <span className="text-[10px] text-slate-600">Functions</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <div className={cn("w-3 h-3 rounded border flex items-center justify-center transition-colors", showEnums ? "bg-indigo-500 border-indigo-500" : "border-slate-300 bg-card")}>
                                        {showEnums && <Check className="w-2 h-2 text-white" />}
                                    </div>
                                    <input type="checkbox" checked={showEnums} onChange={(e) => updateConfig({ showEnums: e.target.checked })} className="sr-only" />
                                    <span className="text-[10px] text-slate-600">Enums</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <div className={cn("w-3 h-3 rounded border flex items-center justify-center transition-colors", showDomains ? "bg-indigo-500 border-indigo-500" : "border-slate-300 bg-card")}>
                                        {showDomains && <Check className="w-2 h-2 text-white" />}
                                    </div>
                                    <input type="checkbox" checked={showDomains} onChange={(e) => updateConfig({ showDomains: e.target.checked })} className="sr-only" />
                                    <span className="text-[10px] text-slate-600">Domains</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <div className={cn("w-3 h-3 rounded border flex items-center justify-center transition-colors", showRoles ? "bg-indigo-500 border-indigo-500" : "border-slate-300 bg-card")}>
                                        {showRoles && <Check className="w-2 h-2 text-white" />}
                                    </div>
                                    <input type="checkbox" checked={showRoles} onChange={(e) => updateConfig({ showRoles: e.target.checked })} className="sr-only" />
                                    <span className="text-[10px] text-slate-600">Roles</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <div className={cn("w-3 h-3 rounded border flex items-center justify-center transition-colors", showSequences ? "bg-indigo-500 border-indigo-500" : "border-slate-300 bg-card")}>
                                        {showSequences && <Check className="w-2 h-2 text-white" />}
                                    </div>
                                    <input type="checkbox" checked={showSequences} onChange={(e) => updateConfig({ showSequences: e.target.checked })} className="sr-only" />
                                    <span className="text-[10px] text-slate-600">Sequences</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <div className={cn("w-3 h-3 rounded border flex items-center justify-center transition-colors", showExtensions ? "bg-indigo-500 border-indigo-500" : "border-slate-300 bg-card")}>
                                        {showExtensions && <Check className="w-2 h-2 text-white" />}
                                    </div>
                                    <input type="checkbox" checked={showExtensions} onChange={(e) => updateConfig({ showExtensions: e.target.checked })} className="sr-only" />
                                    <span className="text-[10px] text-slate-600">Extensions</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                    <div className={cn("w-3 h-3 rounded border flex items-center justify-center transition-colors", showPolicies ? "bg-indigo-500 border-indigo-500" : "border-slate-300 bg-card")}>
                                        {showPolicies && <Check className="w-2 h-2 text-white" />}
                                    </div>
                                    <input type="checkbox" checked={showPolicies} onChange={(e) => updateConfig({ showPolicies: e.target.checked })} className="sr-only" />
                                    <span className="text-[10px] text-slate-600">Policies</span>
                                </label>
                            </div>
                            <label className="flex items-center gap-1.5 cursor-pointer mt-2">
                                <div className={cn("w-3 h-3 rounded border flex items-center justify-center transition-colors", config.strictMode ? "bg-indigo-500 border-indigo-500" : "border-slate-300 bg-card")}>
                                    {config.strictMode && <Check className="w-2 h-2 text-white" />}
                                </div>
                                <input
                                    type="checkbox"
                                    checked={!!config.strictMode}
                                    onChange={(e) => updateConfig({ strictMode: e.target.checked })}
                                    className="sr-only"
                                />
                                <span className="text-[10px] text-slate-600">Strict Subgraph (Hide Unrelated)</span>
                            </label>
                        </div>

                        {/* Confidence Filter */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-slate-600">Min Confidence</span>
                                <span className="text-[10px] font-medium bg-slate-100 px-1.5 py-0.5 rounded">
                                    {minConfidence === 0 ? 'All edges' : `≥ ${Math.round(minConfidence * 100)}%`}
                                </span>
                            </div>
                            <Slider
                                value={[minConfidence]}
                                onValueChange={(vals) => updateConfig({ minConfidence: vals[0] })}
                                min={0}
                                max={1}
                                step={0.1}
                                className="w-full [&_.bg-primary]:bg-indigo-500"
                            />
                            <p className="text-[10px] text-slate-400">
                                Hide inferred edges below this confidence threshold.
                            </p>
                        </div>

                        <div className="h-px bg-slate-200/80" />

                        {/* Legend */}
                        <div className="space-y-2">
                            <span className="text-[10px] font-medium text-slate-700 block">Legend</span>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                                    <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="#6366f1" strokeWidth="2" /></svg>
                                    <span>FK</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                                    <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3,2" /></svg>
                                    <span>View</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                                    <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="#ef4444" strokeWidth="2" strokeDasharray="3,2" /></svg>
                                    <span>Trigger</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                                    <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="#ef4444" strokeWidth="2" /></svg>
                                    <span>Cascade</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                                    <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="#94a3b8" strokeWidth="2" opacity="0.6" /></svg>
                                    <span>Inferred</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'impact' && (
                    <div className="space-y-2">
                        {stats ? (
                            <ImpactSummary stats={stats} />
                        ) : schemaStats ? (
                            <div className="space-y-3">
                                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                    Schema Overview
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { label: 'Tables', value: schemaStats.tables },
                                        { label: 'Views', value: schemaStats.views },
                                        { label: 'Relations', value: schemaStats.relationships },
                                        { label: 'Columns', value: schemaStats.columns },
                                        { label: 'Indexes', value: schemaStats.indexes },
                                        { label: 'Enums', value: schemaStats.enums },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="bg-slate-50 border border-slate-100 rounded p-2 flex flex-col items-center justify-center">
                                            <span className="text-[10px] text-muted-foreground mb-0.5">{label}</span>
                                            <span className="text-sm font-semibold text-slate-700">{value}</span>
                                        </div>
                                    ))}
                                </div>
                                {schemaStats.isolatedTables > 0 && (
                                    <div className="text-[10px] text-amber-600 flex items-center gap-1.5 px-1 py-1 bg-amber-50 rounded border border-amber-100">
                                        <Activity className="w-3 h-3 flex-shrink-0" />
                                        <span>{schemaStats.isolatedTables} isolated table{schemaStats.isolatedTables !== 1 ? 's' : ''} (no relationships)</span>
                                    </div>
                                )}
                                <div className="text-[10px] text-slate-400 px-1 text-center pt-1">
                                    Click a table in the list to see its impact analysis.
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-2 py-6 text-center">
                                <Activity className="w-8 h-8 text-muted-foreground/30" />
                                <p className="text-xs font-medium text-muted-foreground">No Schema Loaded</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Resize handle */}
            <div
                className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize
                       opacity-0 hover:opacity-100 transition-opacity z-10
                       flex items-center justify-center"
                onMouseDown={(e) => { e.stopPropagation(); setIsResizing(true); }}
            >
                <div className="w-2 h-2 border-r-2 border-b-2 border-primary/50 rounded-br-sm" />
            </div>
        </motion.div>
    );
}
