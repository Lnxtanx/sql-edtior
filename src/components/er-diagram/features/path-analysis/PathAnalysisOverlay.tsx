import { useState } from 'react';
import { Footprints, X, Spline, ShieldCheck, Move, Settings2, ArrowRight, ArrowLeft, HelpCircle, Info, Filter, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Relationship, Table } from '@/lib/sql-parser';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { calculateEdgeWeight } from '@/lib/schema-workspace';
import { toNodeId } from '@/lib/schema-workspace/utils';
import { PathStep, PathAnalysisOptions, PathStrategy } from './usePathAnalysis';
import { Checkbox } from '@/components/ui/checkbox';

interface PathAnalysisOverlayProps {
    pathMode: boolean;
    pathStart: string | null;
    pathEnd: string | null;
    pathDetails: PathStep[] | null;
    pathStrategy: PathStrategy;
    setPathStrategy: (strategy: PathStrategy) => void;
    pathCost: number;
    tables: Table[];
    onPathStartChange: (tableId: string) => void;
    onPathEndChange: (tableId: string) => void;
    onReset: () => void;
    options: PathAnalysisOptions;
    setOptions: (options: PathAnalysisOptions) => void;
}

export function PathAnalysisOverlay({
    pathMode,
    pathStart,
    pathEnd,
    pathDetails,
    pathStrategy,
    setPathStrategy,
    pathCost,
    tables,
    onPathStartChange,
    onPathEndChange,
    onReset,
    options,
    setOptions
}: PathAnalysisOverlayProps) {
    const dragControls = useDragControls();

    if (!pathMode) return null;

    return (
        <motion.div
            drag
            dragMomentum={false}
            dragListener={false}
            dragControls={dragControls}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-col gap-2 items-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <div className="bg-background/80 backdrop-blur-xl border border-border/50 shadow-2xl px-3 py-2 rounded-full flex items-center gap-3 transition-colors">
                {/* Drag Handle & Icon */}
                <div
                    className="flex items-center gap-2 text-xs font-semibold text-primary cursor-move group/drag"
                    onPointerDown={(e) => dragControls.start(e)}
                >
                    <div className="text-muted-foreground group-hover/drag:text-primary transition-colors">
                        <Move className="w-3 h-3" />
                    </div>
                    <Footprints className="w-4 h-4 text-primary" />
                    <span className="tracking-tight">Path</span>
                </div>

                <div className="h-4 w-px bg-border/50" />

                {/* Selectors */}
                <div className="flex items-center gap-2 text-xs">
                    <TableSelector
                        value={pathStart}
                        onChange={onPathStartChange}
                        tables={tables}
                        placeholder="Start Table"
                        className={cn(pathStart ? "bg-primary/10 text-primary border-primary/20" : "bg-muted/30 text-muted-foreground border-transparent")}
                    />
                    <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
                    <TableSelector
                        value={pathEnd}
                        onChange={onPathEndChange}
                        tables={tables}
                        placeholder="End Table"
                        className={cn(pathEnd ? "bg-primary/10 text-primary border-primary/20" : "bg-muted/30 text-muted-foreground border-transparent")}
                    />
                </div>

                <div className="h-4 w-px bg-border/50" />

                {/* Settings Trigger */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors relative">
                            <Settings2 className="w-3.5 h-3.5" />
                            {(options.excludeInferred || options.excludeLowConfidence) && (
                                <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-primary border-2 border-background" />
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3 bg-background/95 backdrop-blur-md border-border/50" side="bottom" align="end">
                        <div className="space-y-4">
                            <h4 className="font-semibold text-[10px] text-muted-foreground uppercase tracking-widest pl-1">Path Settings</h4>

                            {/* Algorithm */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-foreground ml-1">Algorithm</label>
                                <Select value={pathStrategy} onValueChange={(v) => setPathStrategy(v as PathStrategy)}>
                                    <SelectTrigger className="h-8 text-xs w-full bg-muted/20 border-border/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="BFS" className="text-xs">
                                            <div className="flex items-center gap-2">
                                                <Spline className="w-3 h-3 text-muted-foreground" />
                                                <span>BFS (Shortest Hops)</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="DIJKSTRA" className="text-xs">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                                <span>Dijkstra (Weighted)</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="h-px bg-border/50" />

                            {/* Filters */}
                            <div className="space-y-2.5">
                                <label className="text-[11px] font-medium text-foreground flex items-center gap-2 ml-1">
                                    <Filter className="w-3 h-3 text-muted-foreground" />
                                    Filtering
                                </label>

                                <div className="flex items-center justify-between group cursor-pointer" onClick={() => setOptions({ ...options, excludeInferred: !options.excludeInferred })}>
                                    <label className="text-xs text-muted-foreground group-hover:text-foreground flex items-center gap-1.5 cursor-pointer select-none transition-colors">
                                        <EyeOff className="w-3 h-3 opacity-50" />
                                        Exclude Inferred
                                    </label>
                                    <Checkbox
                                        checked={options.excludeInferred}
                                        onCheckedChange={(c) => setOptions({ ...options, excludeInferred: !!c })}
                                        className="w-4 h-4 border-muted-foreground/30 data-[state=checked]:bg-primary"
                                    />
                                </div>
                                <div className="flex items-center justify-between group cursor-pointer" onClick={() => setOptions({ ...options, excludeLowConfidence: !options.excludeLowConfidence })}>
                                    <label className="text-xs text-muted-foreground group-hover:text-foreground flex items-center gap-1.5 cursor-pointer select-none transition-colors">
                                        <ShieldCheck className="w-3 h-3 opacity-50" />
                                        Exclude Low Conf.
                                    </label>
                                    <Checkbox
                                        checked={options.excludeLowConfidence}
                                        onCheckedChange={(c) => setOptions({ ...options, excludeLowConfidence: !!c })}
                                        className="w-4 h-4 border-muted-foreground/30 data-[state=checked]:bg-primary"
                                    />
                                </div>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                {pathStart && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive ml-1 transition-all"
                        onClick={onReset}
                    >
                        <X className="w-3 h-3" />
                    </Button>
                )}
            </div>

            {/* Detailed Path Metadata Banner */}
            <AnimatePresence>
                {pathDetails && pathDetails.length > 0 && (
                    <motion.div
                        className="bg-background/80 backdrop-blur-xl border border-border/50 shadow-2xl px-4 py-3 rounded-2xl flex flex-col gap-3 max-w-[420px] w-full mt-2 text-foreground"
                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                    >
                        {/* Metrics Header */}
                        <div className="flex items-center justify-between border-b border-border/40 pb-3">
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Algorithm</span>
                                    <span className={cn("text-xs font-bold", pathStrategy === 'DIJKSTRA' ? "text-emerald-500" : "text-primary")}>
                                        {pathStrategy === 'DIJKSTRA' ? 'Dijkstra' : 'BFS'}
                                    </span>
                                </div>
                                <div className="h-6 w-px bg-border/40" />
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                        {pathStrategy === 'DIJKSTRA' ? 'Cost' : 'Hops'}
                                    </span>
                                    <span className="text-xs font-bold">
                                        {pathStrategy === 'DIJKSTRA' ? pathCost.toFixed(1) : pathDetails.length}
                                    </span>
                                </div>
                            </div>
                            <div className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                Valid Path
                            </div>
                        </div>

                        {/* Path Hops */}
                        <div className="flex flex-col gap-0 max-h-[300px] overflow-y-auto pr-1">
                            {pathDetails.map((step, idx) => {
                                const weight = calculateEdgeWeight(step.rel);
                                const isWarning = weight > 1.0 && pathStrategy === 'DIJKSTRA';
                                const sourceType = step.rel.sourceType || 'UNKNOWN';
                                const confidence = step.rel.confidence || 1;

                                return (
                                    <div key={idx} className="flex flex-col relative pb-5 last:pb-0">
                                        {/* Connection Line */}
                                        {idx < pathDetails.length - 1 && (
                                            <div className="absolute left-[5px] top-6 bottom-0 w-px bg-gradient-to-b from-primary/30 to-border/30" />
                                        )}

                                        {/* Step Item */}
                                        <div className="flex items-center justify-between text-xs group">
                                            <div className="flex items-center gap-2.5">
                                                <div className={cn("w-2.5 h-2.5 rounded-full border-2 z-10 transition-colors", idx === 0 || idx === pathDetails.length - 1 ? "bg-primary border-background" : "bg-background border-muted-foreground/30 group-hover:border-primary")} />
                                                <span className={cn("font-bold tracking-tight", idx === 0 || idx === pathDetails.length - 1 ? "text-primary" : "text-foreground")}>
                                                    {idx === 0 ? step.source : step.source}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Edge Details (between nodes) */}
                                        <div className="pl-6 py-2 flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="bg-muted px-1.5 py-0.5 border border-border/50 rounded text-[9px] text-muted-foreground font-mono flex items-center gap-1">
                                                        {step.direction === '<-' ? <ArrowLeft className="w-2 h-2" /> : null}
                                                        <span className="font-bold">{step.rel.cardinality || 'Rel'}</span>
                                                        {step.direction === '->' ? <ArrowRight className="w-2 h-2" /> : null}
                                                    </div>

                                                    {/* Relationship Type Badge */}
                                                    {step.rel.type === 'VIEW_DEPENDENCY' ? (
                                                        <span className="text-[9px] px-1.5 py-0.5 bg-sky-500/10 text-sky-500 border border-sky-500/20 rounded-full font-bold">View</span>
                                                    ) : step.rel.type === 'TRIGGER_TARGET' ? (
                                                        <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full font-bold">Trigger</span>
                                                    ) : step.rel.type === 'FOREIGN_KEY' ? (
                                                        <span className="text-[9px] px-1.5 py-0.5 bg-muted border border-border/50 rounded-full font-bold text-muted-foreground">FK</span>
                                                    ) : (
                                                        <span className="text-[9px] px-1.5 py-0.5 bg-muted/50 text-muted-foreground border border-border/20 rounded-full italic">Inferred</span>
                                                    )}
                                                </div>

                                                {/* Confidence Badge */}
                                                {confidence < 0.9 && (
                                                    <span className="text-[9px] text-amber-500 bg-amber-500/10 px-1 rounded-full border border-amber-500/20 font-bold">
                                                        {(confidence * 100).toFixed(0)}%
                                                    </span>
                                                )}
                                            </div>

                                            {/* Columns */}
                                            {step.rel.source.column && step.rel.target.column && (
                                                <div className="text-[10px] bg-muted/30 border border-border/20 -ml-1 p-1 rounded-md flex items-center gap-1 group/cols hover:bg-muted transition-colors">
                                                    <span className="text-muted-foreground opacity-60">{step.rel.source.table}.</span>
                                                    <span className="font-bold text-foreground group-hover/cols:text-primary transition-colors">{step.rel.source.column}</span>
                                                    <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/30" />
                                                    <span className="text-muted-foreground opacity-60">{step.rel.target.table}.</span>
                                                    <span className="font-bold text-foreground group-hover/cols:text-primary transition-colors">{step.rel.target.column}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Final Target Node (only for the last step) */}
                                        {idx === pathDetails.length - 1 && (
                                            <div className="flex items-center justify-between text-xs group mt-1">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-background z-10" />
                                                    <span className="font-bold tracking-tight text-primary">
                                                        {step.target}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* No Path Found State */}
                {pathStart && pathEnd && (!pathDetails || pathDetails.length === 0) && (
                    <motion.div
                        className="bg-background/80 backdrop-blur-xl border border-destructive/20 shadow-2xl px-4 py-3 rounded-2xl flex flex-col gap-2 max-w-[300px] w-full mt-2"
                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                    >
                        <div className="flex items-center gap-2 text-destructive font-bold text-xs uppercase tracking-tight">
                            <X className="w-4 h-4" />
                            No path found
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            No connection exists between these tables.
                            {(options.excludeInferred || options.excludeLowConfidence) && (
                                <span className="block mt-1 font-bold text-foreground">
                                    Try disabling filters in settings to see inferred paths.
                                </span>
                            )}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// --- Helper Components ---

function TableSelector({ value, onChange, tables, placeholder, className }: { value: string | null, onChange: (val: string) => void, tables: Table[], placeholder: string, className?: string }) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn(
                        "h-7 px-3 text-[11px] font-bold border-muted-foreground/30 rounded-full min-w-[100px] justify-between shadow-sm transition-all hover:border-primary/50", 
                        className
                    )}
                >
                    <span className="truncate max-w-[120px]">{value || placeholder}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                    <CommandInput placeholder={`Search table...`} className="h-8 text-xs" />
                    <CommandList>
                        <CommandEmpty className="py-2 text-xs text-center text-muted-foreground">No table found.</CommandEmpty>
                        <CommandGroup className="max-h-[200px] overflow-auto">
                            {tables.map((table) => {
                                const nodeId = toNodeId(table.schema, table.name);
                                return (
                                    <CommandItem
                                        key={nodeId}
                                        value={nodeId}
                                        onSelect={(currentValue) => {
                                            onChange(currentValue);
                                            setOpen(false);
                                        }}
                                        className="text-xs py-1.5 rounded-md cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2 w-full">
                                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                                            <span className="font-medium">{table.name}</span>
                                            {table.schema && table.schema !== 'public' && (
                                                <span className="text-[10px] text-muted-foreground ml-auto opacity-60">({table.schema})</span>
                                            )}
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
