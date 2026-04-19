import { X } from 'lucide-react';

interface SubgraphBannerProps {
    isSubgraphActive: boolean;
    subgraphConfig: any;
    renderGraph: any;
    hiddenTableCount: number;
    onSubgraphConfigChange?: (config: any) => void;
    onTableSelect?: (tableName: string | null) => void;
}

export function SubgraphBanner({
    isSubgraphActive,
    subgraphConfig,
    renderGraph,
    hiddenTableCount,
    onSubgraphConfigChange,
    onTableSelect
}: SubgraphBannerProps) {
    if (!isSubgraphActive || !subgraphConfig?.focusTable) {
        return null;
    }

    return (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-10 bg-indigo-50 border border-indigo-200 text-indigo-700 pl-4 pr-2 py-1.5 rounded-full shadow-sm flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-top-2">
            <span>Viewing Network: {subgraphConfig.focusTable}</span>
            <span className="opacity-50">|</span>
            <span className="opacity-70 mr-1">
                {renderGraph.tables.length} tables{renderGraph.views.length > 0 ? ` · ${renderGraph.views.length} views` : ''}{renderGraph.matViews.length > 0 ? ` · ${renderGraph.matViews.length} mat views` : ''}{hiddenTableCount > 0 ? ` · ${hiddenTableCount} hidden` : ''}
            </span>
            {onSubgraphConfigChange && (
                <button
                    className="hover:bg-indigo-200/50 p-1 rounded-full text-indigo-500 hover:text-indigo-800 transition-colors flex items-center justify-center cursor-pointer"
                    onClick={() => {
                        onSubgraphConfigChange({ ...subgraphConfig, focusTable: null });
                        if (onTableSelect) onTableSelect(null);
                    }}
                    title="Clear focus"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}
