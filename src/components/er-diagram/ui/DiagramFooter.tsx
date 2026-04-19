import React from 'react';
import { TerminalSquare, Layers, Eye, Filter, X } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from '@/components/ui/select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuCheckboxItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useDiagramState } from '../core/DiagramProvider';

interface DiagramFooterProps {
    tableCount: number;
    viewCount: number;
    edgeCount: number;
    linkedConnection?: { name: string } | null;
    containerRef?: React.RefObject<HTMLDivElement>;
    schemas?: string[];
}

export function DiagramFooter({
    tableCount,
    viewCount,
    edgeCount,
    linkedConnection,
    containerRef,
    schemas = [],
}: DiagramFooterProps) {
    const {
        viewMode, setViewMode,
        groupBySchema, setGroupBySchema,
        lockGroups, setLockGroups,
        showTerminal, setShowTerminal,
        hiddenSchemas, toggleHiddenSchema, clearHiddenSchemas,
        nodeTypeVisibility, setNodeTypeVisibility,
    } = useDiagramState();

    const hiddenCount = hiddenSchemas.size;
    const hasHiddenSchemas = hiddenCount > 0;

    return (
        <div className="flex items-center justify-between px-2 h-7 border-t border-border bg-card text-[10px] text-muted-foreground font-mono shrink-0">
            {/* Left: Stats + active-filter indicator */}
            <div className="flex items-center gap-2">
                <span>
                    {tableCount} table{tableCount !== 1 ? 's' : ''}
                    {viewCount > 0 ? ` · ${viewCount} view${viewCount !== 1 ? 's' : ''}` : ''}
                    {' '}• {edgeCount} relation{edgeCount !== 1 ? 's' : ''}
                </span>

                {/* Phase 4.10: Active filter indicator */}
                {hasHiddenSchemas && (
                    <span className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded text-[9px] font-semibold">
                        {hiddenCount} schema{hiddenCount !== 1 ? 's' : ''} hidden
                        <button
                            onClick={clearHiddenSchemas}
                            className="ml-0.5 hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
                            title="Show all schemas"
                        >
                            <X className="w-2.5 h-2.5" />
                        </button>
                    </span>
                )}
            </div>

            <div className="flex items-center gap-2 h-full">
                <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                    <SelectTrigger className="h-5 px-1.5 py-0 text-[10px] bg-transparent border-none shadow-none focus:ring-0">
                        <div className="flex items-center gap-1"><Eye className="w-3 h-3" /> Attributes: {viewMode === 'ALL' ? 'All' : viewMode === 'KEYS' ? 'Keys Only' : 'Title Only'}</div>
                    </SelectTrigger>
                    <SelectContent container={containerRef?.current}>
                        <SelectItem value="ALL">Show All Attributes</SelectItem>
                        <SelectItem value="KEYS">Keys Only</SelectItem>
                        <SelectItem value="TITLE">Title Only</SelectItem>
                    </SelectContent>
                </Select>

                <div className="w-px h-3 bg-border mx-0.5" />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex items-center gap-1 h-5 px-1.5 py-0 rounded hover:bg-muted transition-colors outline-none focus:outline-none focus:ring-0">
                            <Layers className="w-3 h-3" />
                            <span>Group</span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent container={containerRef?.current} align="end" className="text-xs min-w-[150px]">
                        <DropdownMenuItem onClick={() => setGroupBySchema(!groupBySchema)} className="cursor-pointer">
                            <div className="w-4 mr-1 text-center">{groupBySchema ? '✓' : ''}</div>
                            Cluster by Schema
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={!groupBySchema} onClick={() => setLockGroups(!lockGroups)} className="cursor-pointer">
                            <div className="w-4 mr-1 text-center">{lockGroups ? '✓' : ''}</div>
                            Lock Nodes to Group
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-px h-3 bg-border mx-0.5" />

                {/* Phase 4.2 + 4.4: Visibility dropdown with schema groups and badge */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="relative flex items-center gap-1 h-5 px-1.5 py-0 rounded hover:bg-muted transition-colors outline-none focus:outline-none focus:ring-0">
                            <Filter className="w-3 h-3" />
                            <span>Visibility</span>
                            {/* Badge showing hidden schema count */}
                            {hasHiddenSchemas && (
                                <span className="absolute -top-1 -right-1 flex items-center justify-center w-3.5 h-3.5 bg-amber-500 text-white text-[8px] font-bold rounded-full">
                                    {hiddenCount}
                                </span>
                            )}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent container={containerRef?.current} align="end" className="text-xs min-w-[180px]">
                        {/* Section: Node Types */}
                        <DropdownMenuLabel className="text-[9px] uppercase tracking-wider text-muted-foreground px-2 py-1">
                            Node Types
                        </DropdownMenuLabel>
                        <DropdownMenuCheckboxItem
                            checked={nodeTypeVisibility.showViews}
                            onCheckedChange={(checked) => setNodeTypeVisibility({ showViews: checked })}
                            className="text-xs cursor-pointer"
                        >
                            Views
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={nodeTypeVisibility.showMaterializedViews}
                            onCheckedChange={(checked) => setNodeTypeVisibility({ showMaterializedViews: checked })}
                            className="text-xs cursor-pointer"
                        >
                            Materialized Views
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={nodeTypeVisibility.showFunctions}
                            onCheckedChange={(checked) => setNodeTypeVisibility({ showFunctions: checked })}
                            className="text-xs cursor-pointer"
                        >
                            Functions
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={nodeTypeVisibility.showEnums}
                            onCheckedChange={(checked) => setNodeTypeVisibility({ showEnums: checked })}
                            className="text-xs cursor-pointer"
                        >
                            Enums
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={nodeTypeVisibility.showDomains}
                            onCheckedChange={(checked) => setNodeTypeVisibility({ showDomains: checked })}
                            className="text-xs cursor-pointer"
                        >
                            Domains
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={nodeTypeVisibility.showRoles}
                            onCheckedChange={(checked) => setNodeTypeVisibility({ showRoles: checked })}
                            className="text-xs cursor-pointer"
                        >
                            Roles
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={nodeTypeVisibility.showSequences}
                            onCheckedChange={(checked) => setNodeTypeVisibility({ showSequences: checked })}
                            className="text-xs cursor-pointer"
                        >
                            Sequences
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={nodeTypeVisibility.showExtensions}
                            onCheckedChange={(checked) => setNodeTypeVisibility({ showExtensions: checked })}
                            className="text-xs cursor-pointer"
                        >
                            Extensions
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                            checked={nodeTypeVisibility.showPolicies}
                            onCheckedChange={(checked) => setNodeTypeVisibility({ showPolicies: checked })}
                            className="text-xs cursor-pointer"
                        >
                            Policies
                        </DropdownMenuCheckboxItem>

                        {/* Section: Schema Groups (only show if multiple schemas exist) */}
                        {schemas.length > 1 && (
                            <>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel className="text-[9px] uppercase tracking-wider text-muted-foreground px-2 py-1">
                                    Schema Groups
                                </DropdownMenuLabel>
                                {schemas.map(schema => (
                                    <DropdownMenuCheckboxItem
                                        key={schema}
                                        checked={!hiddenSchemas.has(schema)}
                                        onCheckedChange={() => toggleHiddenSchema(schema)}
                                        className="text-xs cursor-pointer"
                                    >
                                        {schema}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="w-px h-3 bg-border mx-0.5" />

                <button
                    onClick={() => setShowTerminal(true)}
                    className={`flex items-center gap-1 h-5 px-1.5 py-0 rounded hover:bg-muted transition-colors ${showTerminal ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                    title={linkedConnection ? `Terminal — ${linkedConnection.name}` : 'Terminal — No connection linked'}
                >
                    <TerminalSquare className="w-3 h-3" />
                    <span>Terminal</span>
                    {linkedConnection && (
                        <span className="text-emerald-600 dark:text-emerald-400">•</span>
                    )}
                </button>
            </div>
        </div>
    );
}
