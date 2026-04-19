import { useMemo } from 'react';
import { Table, View, Relationship } from '@/lib/sql-parser';
import {
    extractSubgraph,
    applyProjection,
    SchemaGraph,
    SchemaSubgraph,
    RenderGraph,
} from '@/lib/schema-workspace';
import { toNodeId } from '@/lib/schema-workspace/utils';

export interface SubgraphConfig {
    focusTable?: string | null;
    depth?: number;
    direction?: 'outbound' | 'inbound' | 'both';
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
    // Phase 4.3: Schema group visibility
    hiddenSchemas?: Set<string>;
    // Issue 2.6: Skip all visibility filtering (for layout computation)
    skipFiltering?: boolean;
}

// ---------------------------------------------------------------------------
// Shared helper — builds a RenderGraph respecting visibility config flags.
// Phase 4.3: Also filters out nodes whose schema is in hiddenSchemas.
// ---------------------------------------------------------------------------
function buildRenderGraphFromConfig(
    baseGraph: SchemaGraph | RenderGraph,
    tables: Table[],
    relationships: Relationship[],
    config?: SubgraphConfig
): RenderGraph {
    // Issue 2.6: When skipFiltering is true, return ALL nodes without filtering
    // This is used for layout computation to ensure positions are stable
    if (config?.skipFiltering) {
        const allViews = baseGraph.views || [];
        const allMatViews = allViews.filter(v => v.isMaterialized);
        const regularViews = allViews.filter(v => !v.isMaterialized);
        const allEnums = baseGraph.enums instanceof Map
            ? Array.from(baseGraph.enums.values())
            : (baseGraph.enums || []);

        // Build set of all node IDs for edge filtering
        const allNodeIds = new Set<string>();
        for (const t of tables) allNodeIds.add(toNodeId(t.schema, t.name));
        for (const v of allViews) allNodeIds.add(toNodeId(v.schema, v.name));
        for (const f of (baseGraph.functions || [])) allNodeIds.add(toNodeId(f.schema, f.name));
        for (const e of allEnums) allNodeIds.add(toNodeId((e as any).schema, (e as any).name));
        for (const d of (baseGraph.domains || [])) allNodeIds.add(toNodeId(d.schema, d.name));
        for (const r of (baseGraph.roles || [])) allNodeIds.add(toNodeId(undefined, r.name));
        for (const s of (baseGraph.sequences || [])) allNodeIds.add(toNodeId(s.schema, s.name));
        for (const ext of (baseGraph.extensions || [])) allNodeIds.add(toNodeId(undefined, ext.name));
        for (const p of (baseGraph.policies || [])) allNodeIds.add(toNodeId(p.schema, p.name));

        // Include all edges where both endpoints exist
        const allRels = relationships.filter(rel => {
            const sourceId = toNodeId(rel.source.schema, rel.source.table);
            const targetId = toNodeId(rel.target.schema, rel.target.table);
            return allNodeIds.has(sourceId) && allNodeIds.has(targetId);
        });

        return {
            tables,
            views: regularViews,
            matViews: allMatViews,
            functions: baseGraph.functions || [],
            enums: allEnums as any[],
            domains: baseGraph.domains || [],
            roles: baseGraph.roles || [],
            sequences: baseGraph.sequences || [],
            extensions: baseGraph.extensions || [],
            policies: baseGraph.policies || [],
            relationships: allRels,
        };
    }

    const hidden = config?.hiddenSchemas ?? new Set<string>();
    // Avoid creating new array instances when nothing is filtered out.
    // Without this guard, every useMemo call produces new array references
    // even when the data is identical, which causes useLayoutEngine's ELK
    // stage effect to re-fire on every render (deps are new refs = changed).
    const shouldFilterSchemas = hidden.size > 0;

    // Apply schema-group filter to tables
    const filteredTables = shouldFilterSchemas
        ? tables.filter(t => !hidden.has(t.schema || 'public'))
        : tables;

    const showViews = config?.showViews ?? true;
    const showMatViews = config?.showMaterializedViews ?? true;

    const views: View[] = [];
    const matViews: View[] = [];

    if (showViews || showMatViews) {
        for (const view of baseGraph.views) {
            if (shouldFilterSchemas && hidden.has((view as any).schema || 'public')) continue;
            if (view.isMaterialized && showMatViews) {
                matViews.push(view);
            } else if (!view.isMaterialized && showViews) {
                views.push(view);
            }
        }
    }

    const showFunctions = config?.showFunctions ?? true;
    const allFunctions = baseGraph.functions || [];
    const functions = showFunctions
        ? (shouldFilterSchemas ? allFunctions.filter((f: any) => !hidden.has(f.schema || 'public')) : allFunctions)
        : [];

    const showEnums = config?.showEnums ?? true;
    const allEnums = baseGraph.enums instanceof Map
        ? Array.from(baseGraph.enums.values())
        : (baseGraph.enums || []);
    const enums = showEnums
        ? (shouldFilterSchemas ? (allEnums as any[]).filter((e: any) => !hidden.has(e.schema || 'public')) : allEnums)
        : [];

    const showDomains = config?.showDomains ?? true;
    const allDomains = baseGraph.domains || [];
    const domains = showDomains
        ? (shouldFilterSchemas ? allDomains.filter((d: any) => !hidden.has(d.schema || 'public')) : allDomains)
        : [];

    const showRoles = config?.showRoles ?? true;
    const roles = showRoles ? (baseGraph.roles || []) : [];

    const showSequences = config?.showSequences ?? true;
    const allSequences = baseGraph.sequences || [];
    const sequences = showSequences
        ? (shouldFilterSchemas ? allSequences.filter((s: any) => !hidden.has(s.schema || 'public')) : allSequences)
        : [];

    const showExtensions = config?.showExtensions ?? true;
    const extensions = showExtensions ? (baseGraph.extensions || []) : [];

    const showPolicies = config?.showPolicies ?? true;
    const allPolicies = baseGraph.policies || [];
    const policies = showPolicies
        ? (shouldFilterSchemas ? allPolicies.filter((p: any) => !hidden.has(p.schema || 'public')) : allPolicies)
        : [];

    // Build set of rendered node IDs for relationship edge filtering
    const renderedNodeIds = new Set<string>();
    for (const t of filteredTables) renderedNodeIds.add(toNodeId(t.schema, t.name));
    for (const v of views) renderedNodeIds.add(toNodeId(v.schema, v.name));
    for (const mv of matViews) renderedNodeIds.add(toNodeId(mv.schema, mv.name));
    for (const f of functions as any[]) renderedNodeIds.add(toNodeId(f.schema, f.name));
    for (const e of enums as any[]) renderedNodeIds.add(toNodeId(e.schema, e.name));
    for (const d of domains as any[]) renderedNodeIds.add(toNodeId(d.schema, d.name));
    for (const r of roles as any[]) renderedNodeIds.add(toNodeId(undefined, r.name));
    for (const s of sequences as any[]) renderedNodeIds.add(toNodeId(s.schema, s.name));
    for (const ext of extensions as any[]) renderedNodeIds.add(toNodeId(undefined, ext.name));
    for (const p of policies as any[]) renderedNodeIds.add(toNodeId(p.schema, p.name));

    // Only include edges where BOTH endpoints are rendered.
    // Check count first — if nothing is hidden, all rels pass and we can
    // return the original array to keep stable reference for ELK deps.
    const allRelsVisible = !shouldFilterSchemas
        && (config?.showViews ?? true)
        && (config?.showMaterializedViews ?? true)
        && (config?.showFunctions ?? true)
        && (config?.showEnums ?? true)
        && (config?.showDomains ?? true)
        && (config?.showRoles ?? true)
        && (config?.showSequences ?? true)
        && (config?.showExtensions ?? true)
        && (config?.showPolicies ?? true);

    const filteredRels = allRelsVisible
        ? relationships
        : relationships.filter(rel => {
            const sourceId = toNodeId(rel.source.schema, rel.source.table);
            const targetId = toNodeId(rel.target.schema, rel.target.table);
            return renderedNodeIds.has(sourceId) && renderedNodeIds.has(targetId);
          });

    return {
        tables: filteredTables,
        views,
        matViews,
        functions: functions as any[],
        enums: enums as any[],
        domains: domains as any[],
        roles: roles as any[],
        sequences: sequences as any[],
        extensions: extensions as any[],
        policies: policies as any[],
        relationships: filteredRels,
    };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useSubgraph(
    tables: Table[],
    relationships: Relationship[],
    graph: SchemaGraph | null,
    config?: SubgraphConfig
) {
    return useMemo(() => {
        let result: {
            renderGraph: RenderGraph;
            isSubgraphActive: boolean;
            currentSubgraph?: SchemaSubgraph;
            activeNodeIds?: Set<string>;
        };

        let activeNodeIds: Set<string> | undefined;

        if (config?.focusTable && graph) {
            // Focus mode: use subgraph extraction + projection
            try {
                const subgraph = extractSubgraph(graph, [config.focusTable], {
                    maxDepth: config.depth ?? 2,
                    direction: config.direction ?? 'both',
                    minConfidence: config.minConfidence ?? 0,
                });

                const renderGraphSub = applyProjection(subgraph, {
                    showViews: config.showViews ?? true,
                    showMaterializedViews: config.showMaterializedViews ?? true,
                    showFunctions: config.showFunctions ?? true,
                    showEnums: config.showEnums ?? true,
                    showDomains: config.showDomains ?? true,
                    showRoles: config.showRoles ?? true,
                    showSequences: config.showSequences ?? true,
                    showExtensions: config.showExtensions ?? true,
                    showPolicies: config.showPolicies ?? true,
                });

                let finalRenderGraph: RenderGraph;

                if (config.strictMode) {
                    finalRenderGraph = renderGraphSub;
                } else {
                    // Track active nodes for dimming
                    activeNodeIds = new Set<string>();

                    // Only add nodes actually IN the subgraph projection, not the entire global graph
                    for (const t of renderGraphSub.tables) activeNodeIds.add(toNodeId(t.schema, t.name));
                    for (const v of renderGraphSub.views) activeNodeIds.add(toNodeId(v.schema, v.name));
                    for (const mv of renderGraphSub.matViews) activeNodeIds.add(toNodeId(mv.schema, mv.name));
                    for (const f of renderGraphSub.functions || []) activeNodeIds.add(toNodeId(f.schema, f.name));
                    for (const e of renderGraphSub.enums || []) activeNodeIds.add(toNodeId(e.schema, e.name));
                    for (const d of renderGraphSub.domains || []) activeNodeIds.add(toNodeId(d.schema, d.name));
                    for (const r of renderGraphSub.roles || []) activeNodeIds.add(toNodeId(undefined, r.name));
                    for (const s of renderGraphSub.sequences || []) activeNodeIds.add(toNodeId(s.schema, s.name));
                    for (const ext of renderGraphSub.extensions || []) activeNodeIds.add(toNodeId(undefined, ext.name));
                    for (const p of renderGraphSub.policies || []) activeNodeIds.add(toNodeId(p.schema, p.name));

                    // In strictMode=false, render the FULL graph but dim nodes not in activeNodeIds
                    finalRenderGraph = buildRenderGraphFromConfig(graph, tables, relationships, config);
                }

                result = {
                    renderGraph: finalRenderGraph,
                    isSubgraphActive: true,
                    currentSubgraph: subgraph,
                    activeNodeIds,
                };
            } catch (e) {
                console.error('Failed to extract subgraph', e);
                result = {
                    renderGraph: { tables, views: [], matViews: [], functions: [], enums: [], domains: [], roles: [], sequences: [], extensions: [], policies: [], relationships },
                    isSubgraphActive: false,
                };
            }
        } else if (graph) {
            // Full canvas mode
            result = {
                renderGraph: buildRenderGraphFromConfig(graph, tables, relationships, config),
                isSubgraphActive: false,
            };
        } else {
            // No graph yet: show tables only
            result = {
                renderGraph: { tables, views: [], matViews: [], functions: [], enums: [], domains: [], roles: [], sequences: [], extensions: [], policies: [], relationships },
                isSubgraphActive: false,
            };
        }

        return result;
    }, [tables, relationships, config, graph]);
}