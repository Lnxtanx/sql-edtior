import { useState, useMemo } from 'react';
import {
    Network, X, Table as TableIcon, Search, FolderOpen, Folder, Settings2, Eye, Database,
    Code, Puzzle, ShieldCheck, ListChecks, Fingerprint, Users, ListOrdered
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ParsedSchema } from '@/lib/sql-parser';
import { cn } from '@/lib/utils';

import { GraphStats } from '@/lib/schema-workspace';
import { toNodeId } from '@/lib/schema-workspace/utils';

export interface SubgraphConfig {
    focusTable: string | null;
    depth: number;
    direction: 'outbound' | 'inbound' | 'both';
    showViews?: boolean;
    showMaterializedViews?: boolean;
    minConfidence?: number;
}

interface SubgraphPanelProps {
    schema: ParsedSchema | null;
    onClose: () => void;
    config?: SubgraphConfig;
    onConfigChange?: (config: SubgraphConfig) => void;
    stats?: GraphStats | null;
    onOpenSettings?: () => void;
}

type ObjectType = 'table' | 'view' | 'matview' | 'function' | 'extension' | 'policy' | 'enum' | 'domain' | 'role' | 'sequence';

interface FilteredObject {
    name: string;
    type: ObjectType;
}

export function SubgraphPanel({ schema, onClose, config, onConfigChange, stats, onOpenSettings }: SubgraphPanelProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedSchemas, setExpandedSchemas] = useState<Record<string, boolean>>({ 'public': true, 'global': true });

    const focusTable = config?.focusTable || null;

    const updateConfig = (updates: Partial<SubgraphConfig>) => {
        if (onConfigChange && config) {
            onConfigChange({ ...config, ...updates });
        } else if (onConfigChange) {
            onConfigChange({
                focusTable: null,
                depth: 1,
                direction: 'both',
                showViews: true,
                showMaterializedViews: true,
                ...updates
            });
        }
    };

    // Filter all objects for the list
    const filteredObjects = useMemo(() => {
        if (!schema) return {};
        const result: Record<string, FilteredObject[]> = {};

        const addObj = (schemaName: string, name: string, type: ObjectType) => {
            if (searchTerm && !name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return;
            }
            if (!result[schemaName]) result[schemaName] = [];
            result[schemaName].push({ name, type });
        };

        schema.tables?.forEach(obj => addObj(obj.schema || 'public', obj.name, 'table'));
        schema.views?.forEach(obj => addObj(obj.schema || 'public', obj.name, obj.isMaterialized ? 'matview' : 'view'));
        schema.functions?.forEach(obj => addObj(obj.schema || 'public', obj.name, 'function'));
        schema.policies?.forEach(obj => addObj(obj.schema || 'public', obj.name, 'policy'));
        schema.extensions?.forEach(obj => addObj(obj.schema || 'public', obj.name, 'extension'));
        schema.enumTypes?.forEach(obj => addObj(obj.schema || 'public', obj.name, 'enum'));
        schema.domains?.forEach(obj => addObj(obj.schema || 'public', obj.name, 'domain'));
        schema.roles?.forEach(obj => addObj('global', obj.name, 'role')); // Roles often lack schema, grouped under global or public
        schema.sequences?.forEach(obj => addObj(obj.schema || 'public', obj.name, 'sequence'));

        return result;
    }, [schema, searchTerm]);

    const toggleSchema = (schemaName: string) => {
        setExpandedSchemas(prev => ({
            ...prev,
            [schemaName]: !prev[schemaName]
        }));
    };

    const handleObjectSelect = (objectId: string) => {
        if (focusTable === objectId) {
            updateConfig({ focusTable: null });
        } else {
            updateConfig({ focusTable: objectId });
        }
    };

    const clearFocus = () => {
        updateConfig({ focusTable: null });
    };

    const getIconAndColorForType = (type: string) => {
        switch (type) {
            case 'matview': return { Icon: Database, colorClass: 'text-teal-500', bgClass: 'bg-teal-50', hoverBg: 'hover:bg-teal-50/50', hoverText: 'hover:text-teal-900', activeClass: 'text-teal-700 font-medium bg-teal-50' };
            case 'view': return { Icon: Eye, colorClass: 'text-amber-500', bgClass: 'bg-amber-50', hoverBg: 'hover:bg-amber-50/50', hoverText: 'hover:text-amber-900', activeClass: 'text-amber-700 font-medium bg-amber-50' };
            case 'function': return { Icon: Code, colorClass: 'text-purple-500', bgClass: 'bg-purple-50', hoverBg: 'hover:bg-purple-50/50', hoverText: 'hover:text-purple-900', activeClass: 'text-purple-700 font-medium bg-purple-50' };
            case 'policy': return { Icon: ShieldCheck, colorClass: 'text-red-500', bgClass: 'bg-red-50', hoverBg: 'hover:bg-red-50/50', hoverText: 'hover:text-red-900', activeClass: 'text-red-700 font-medium bg-red-50' };
            case 'extension': return { Icon: Puzzle, colorClass: 'text-emerald-500', bgClass: 'bg-emerald-50', hoverBg: 'hover:bg-emerald-50/50', hoverText: 'hover:text-emerald-900', activeClass: 'text-emerald-700 font-medium bg-emerald-50' };
            case 'enum': return { Icon: ListChecks, colorClass: 'text-pink-500', bgClass: 'bg-pink-50', hoverBg: 'hover:bg-pink-50/50', hoverText: 'hover:text-pink-900', activeClass: 'text-pink-700 font-medium bg-pink-50' };
            case 'domain': return { Icon: Fingerprint, colorClass: 'text-cyan-500', bgClass: 'bg-cyan-50', hoverBg: 'hover:bg-cyan-50/50', hoverText: 'hover:text-cyan-900', activeClass: 'text-cyan-700 font-medium bg-cyan-50' };
            case 'role': return { Icon: Users, colorClass: 'text-rose-500', bgClass: 'bg-rose-50', hoverBg: 'hover:bg-rose-50/50', hoverText: 'hover:text-rose-900', activeClass: 'text-rose-700 font-medium bg-rose-50' };
            case 'sequence': return { Icon: ListOrdered, colorClass: 'text-orange-500', bgClass: 'bg-orange-50', hoverBg: 'hover:bg-orange-50/50', hoverText: 'hover:text-orange-900', activeClass: 'text-orange-700 font-medium bg-orange-50' };
            case 'table':
            default: return { Icon: TableIcon, colorClass: 'text-indigo-500', bgClass: 'bg-indigo-50', hoverBg: 'hover:bg-slate-50', hoverText: 'hover:text-slate-900', activeClass: 'bg-indigo-50 text-indigo-700 font-medium' };
        }
    };

    const focusNodeType = useMemo(() => {
        if (!focusTable || !schema) return 'table';
        if (schema.views?.find(v => toNodeId(v.schema, v.name) === focusTable)) return schema.views.find(v => toNodeId(v.schema, v.name) === focusTable)?.isMaterialized ? 'matview' : 'view';
        if (schema.functions?.find(f => toNodeId(f.schema, f.name) === focusTable)) return 'function';
        if (schema.policies?.find(p => toNodeId(p.schema, p.name) === focusTable)) return 'policy';
        if (schema.extensions?.find(e => toNodeId(e.schema, e.name) === focusTable)) return 'extension';
        if (schema.enumTypes?.find(e => e.name && toNodeId(e.schema, e.name) === focusTable)) return 'enum';
        if (schema.domains?.find(d => toNodeId(d.schema, d.name) === focusTable)) return 'domain';
        if (schema.roles?.find(r => `global.${r.name}` === focusTable || r.name === focusTable)) return 'role';
        if (schema.sequences?.find(s => toNodeId(s.schema, s.name) === focusTable)) return 'sequence';
        return 'table';
    }, [focusTable, schema]);

    const { Icon: FocusIcon, colorClass: focusIconColor } = getIconAndColorForType(focusNodeType);

    return (
        <div className="h-full flex flex-col bg-background border-r0 w-full">
            {/* Header with Integrated Search */}
            <div className="flex flex-col gap-3 px-3 py-3 border-b border-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Network className="w-4 h-4 text-indigo-500" />
                        <h2 className="text-sm font-semibold">Graph Explorer</h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onOpenSettings} title="Graph Settings">
                            <Settings2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Find objects..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-8 pl-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-offset-0 focus-visible:ring-1"
                    />
                </div>
            </div>

            {/* Active Focus Chip */}
            {focusTable && (
                <div className="px-3 py-1.5 border-b border-indigo-100 bg-indigo-50/50 animate-in slide-in-from-top-2 fade-in">
                    <div className="flex items-center gap-2">
                        <FocusIcon className={cn("w-3.5 h-3.5 flex-shrink-0", focusIconColor)} />
                        <span className="text-xs font-medium text-indigo-700 truncate flex-1">{focusTable}</span>
                        <button
                            onClick={clearFocus}
                            className="text-indigo-400 hover:text-indigo-600 transition-colors flex-shrink-0"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Object List */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-0.5">
                    {!schema ? (
                        <div className="text-center p-4 text-xs text-muted-foreground">No schema loaded</div>
                    ) : (
                        Object.entries(filteredObjects).map(([schemaName, items]) => {
                            // Calculate counts
                            const counts: Record<string, number> = {};
                            items.forEach(item => { counts[item.type] = (counts[item.type] || 0) + 1; });

                            const countParts = [];
                            if (counts['table']) countParts.push(`${counts['table']} tables`);
                            if (counts['view']) countParts.push(`${counts['view']} views`);
                            if (counts['matview']) countParts.push(`${counts['matview']} mat views`);
                            if (counts['function']) countParts.push(`${counts['function']} funcs`);
                            if (counts['extension']) countParts.push(`${counts['extension']} exts`);
                            if (counts['policy']) countParts.push(`${counts['policy']} policies`);
                            if (counts['enum']) countParts.push(`${counts['enum']} enums`);
                            if (counts['domain']) countParts.push(`${counts['domain']} domains`);
                            if (counts['role']) countParts.push(`${counts['role']} roles`);
                            if (counts['sequence']) countParts.push(`${counts['sequence']} seqs`);

                            const countLabel = countParts.join(' · ');

                            return (
                                <div key={schemaName} className="space-y-0.5">
                                    <button
                                        onClick={() => toggleSchema(schemaName)}
                                        className="flex items-center gap-1.5 w-full text-left px-2 py-1 hover:bg-slate-100 rounded text-xs font-medium text-slate-700 transition-colors"
                                    >
                                        {expandedSchemas[schemaName] ? (
                                            <FolderOpen className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                                        ) : (
                                            <Folder className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                        )}
                                        <span className="truncate flex-1">{schemaName}</span>
                                        <span className="text-slate-400 font-normal ml-auto text-[10px] pl-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]" title={countLabel}>
                                            {countLabel}
                                        </span>
                                    </button>

                                    {expandedSchemas[schemaName] && (
                                        <div className="ml-2 pl-2 border-l border-slate-200 mt-0.5 space-y-0.5">
                                            {items.map(item => {
                                                const objectId = item.type === 'role' ? `global.${item.name}` : toNodeId(schemaName, item.name);
                                                const { Icon: ItemIcon, colorClass, hoverBg, hoverText, activeClass } = getIconAndColorForType(item.type);

                                                const isActive = focusTable === objectId;

                                                return (
                                                    <button
                                                        key={`${item.type}-${objectId}`}
                                                        onClick={() => handleObjectSelect(objectId)}
                                                        className={cn(
                                                            "flex items-center gap-2 w-full text-left px-2 py-1 rounded text-xs transition-colors truncate",
                                                            isActive ? activeClass : `text-slate-600 ${hoverBg} ${hoverText}`
                                                        )}
                                                    >
                                                        <ItemIcon className={cn("w-3 h-3 flex-shrink-0 opacity-70", isActive ? "" : colorClass)} />
                                                        <span className="truncate">{item.name}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </ScrollArea>
        </div >
    );
}
