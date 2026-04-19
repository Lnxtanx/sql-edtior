import { useMemo } from 'react';
import { SchemaGraph, analyzeCascadeRisks, GraphStats, buildSchemaGraph } from '@/lib/schema-workspace';
import { toNodeId } from '@/lib/schema-workspace/utils';
import { Table, Relationship } from '@/lib/sql-parser';
import { useSubgraph } from '../../features/hooks/useSubgraph';

const LAYOUT_SUBGRAPH_CONFIG = { skipFiltering: true } as const;

export function useDiagramGraph(
    tables: Table[],
    relationships: Relationship[],
    schema: any,
    subgraphConfig: any,
    hiddenSchemas: Set<string>,
    nodeTypeVisibility: any
) {
    // Build graph and analyze risks
    const graph = useMemo(() => schema ? buildSchemaGraph(schema) : null, [schema]);

    const enumNames = useMemo(() => {
        if (!graph) return new Set<string>();
        return new Set(graph.enums.keys());
    }, [graph]);

    const riskMap = useMemo(() => {
        if (!graph) return new Map();
        return analyzeCascadeRisks(graph);
    }, [graph]);

    // Layout uses UNFILTERED graph to ensure stable positions
    const layoutRenderGraph = useSubgraph(tables, relationships, graph, LAYOUT_SUBGRAPH_CONFIG);

    // Visibility filtering is applied AFTER layout, not before
    const subgraphConfigWithHidden = useMemo(
        () => {
            const base = subgraphConfig
                ? { ...subgraphConfig, hiddenSchemas }
                : { focusTable: null, depth: 2, direction: 'both' as const, hiddenSchemas };
            return { ...base, ...nodeTypeVisibility };
        },
        [subgraphConfig, hiddenSchemas, nodeTypeVisibility]
    );

    const { renderGraph, isSubgraphActive, currentSubgraph, activeNodeIds: activeSubgraphIds } = useSubgraph(tables, relationships, graph, subgraphConfigWithHidden);

    // Compute which node IDs should be visible based on filters
    const visibleNodeIds = useMemo(() => {
        const ids = new Set<string>();
        for (const t of renderGraph.tables) ids.add(toNodeId(t.schema, t.name));
        for (const v of renderGraph.views) ids.add(toNodeId(v.schema, v.name));
        for (const mv of renderGraph.matViews) ids.add(toNodeId(mv.schema, mv.name));
        for (const f of (renderGraph.functions || [])) ids.add(toNodeId(f.schema, f.name));
        for (const e of (renderGraph.enums || [])) ids.add(toNodeId((e as any).schema, (e as any).name));
        for (const d of (renderGraph.domains || [])) ids.add(toNodeId(d.schema, d.name));
        for (const r of (renderGraph.roles || [])) ids.add(toNodeId(undefined, r.name));
        for (const s of (renderGraph.sequences || [])) ids.add(toNodeId(s.schema, s.name));
        for (const ext of (renderGraph.extensions || [])) ids.add(toNodeId(undefined, ext.name));
        for (const p of (renderGraph.policies || [])) ids.add(toNodeId(p.schema, p.name));
        return ids;
    }, [renderGraph]);

    // Compute which edge IDs should be visible
    const visibleEdgeIds = useMemo(() => {
        const ids = new Set<string>();
        for (const r of renderGraph.relationships) ids.add(r.id);
        return ids;
    }, [renderGraph.relationships]);

    const hiddenTableCount = useMemo(() => {
        if (!isSubgraphActive || !graph) return 0;
        let tableNodeCount = 0;
        for (const node of graph.nodes.values()) {
            if (node.type === 'TABLE') tableNodeCount++;
        }
        return tableNodeCount - renderGraph.tables.length;
    }, [isSubgraphActive, graph, renderGraph.tables.length]);

    return {
        graph,
        enumNames,
        riskMap,
        layoutRenderGraph,
        renderGraph,
        isSubgraphActive,
        currentSubgraph,
        activeSubgraphIds,
        visibleNodeIds,
        visibleEdgeIds,
        hiddenTableCount
    };
}
