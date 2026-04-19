/**
 * elk/parseELKOutput.ts
 *
 * Converts ELK's positioned graph back into React Flow node objects.
 * Each node builder helper handles one node type.
 * No edge positions are produced here — React Flow handles edge routing.
 */
import { ElkNode } from 'elkjs/lib/elk.bundled.js';
import { Node } from '@xyflow/react';
import { RenderGraph, TableNode as SchemaTableNode } from '@/lib/schema-workspace';
import { toNodeId } from '@/lib/schema-workspace/utils';
import { LayoutEngineOptions } from '../types';

export function parseELKOutput(
    elkGraph: ElkNode,
    renderGraph: RenderGraph,
    options: LayoutEngineOptions,
): Node[] {
    const {
        groupBySchema = false,
        lockGroups = false,
        viewMode = 'ALL',
        highlightedPath,
        activeSubgraphIds,
        riskMap,
        graph,
        enumNames,
        onTableAI,
        onSubgraph,
        onGroupAI,
    } = options;

    const { tables, views, matViews, functions = [], enums = [], domains = [], roles = [], sequences = [], extensions = [], policies = [] } = renderGraph;

    // Fast lookup maps
    const tableMap = new Map(tables.map(t => [toNodeId(t.schema, t.name), t]));
    const viewMap = new Map(views.map(v => [toNodeId(v.schema, v.name), v]));
    const matViewMap = new Map(matViews.map(v => [toNodeId(v.schema, v.name), v]));
    const functionMap = new Map(functions.map(f => [toNodeId(f.schema, f.name), f]));
    const enumMapFiltered = new Map(enums.map(e => [toNodeId(e.schema, e.name), e]));
    const domainMap = new Map(domains.map(d => [toNodeId(d.schema, d.name), d]));
    const roleMap = new Map(roles.map(r => [toNodeId(undefined, r.name), r]));
    const sequenceMap = new Map(sequences.map(s => [toNodeId(s.schema, s.name), s]));
    const extensionMap = new Map(extensions.map(ext => [toNodeId(undefined, ext.name), ext]));
    const policyMap = new Map(policies.map(p => [toNodeId(p.schema, p.name), p]));

    const rfNodes: Node[] = [];

    // ─── Dimming helpers ─────────────────────────────────────────────────────
    const isDimmedById = (id: string) =>
        (highlightedPath && !highlightedPath.includes(id)) ||
        (activeSubgraphIds && !activeSubgraphIds.has(id));

    const dimStyle = (id: string) => isDimmedById(id)
        ? { opacity: 0.3, filter: 'grayscale(100%)', transition: 'all 0.3s ease' }
        : { opacity: 1, filter: 'none', transition: 'all 0.3s ease' };

    // ─── Node builder helpers ─────────────────────────────────────────────────

    const buildTableNode = (elkLeaf: ElkNode, parentNodeId?: string): Node | null => {
        const table = tableMap.get(elkLeaf.id);
        if (!table) return null;
        const graphNode = graph?.nodes.get(elkLeaf.id);
        const tableGraph = graphNode?.type === 'TABLE' ? (graphNode as SchemaTableNode) : null;

        return {
            id: elkLeaf.id,
            type: 'tableNode',
            parentId: parentNodeId,
            extent: parentNodeId && lockGroups ? 'parent' : undefined,
            position: { x: elkLeaf.x!, y: elkLeaf.y! },
            style: dimStyle(elkLeaf.id),
            data: {
                label: table.name,
                columns: table.columns,
                schema: table.schema,
                onTableAI,
                onSubgraph,
                risk: riskMap?.get(elkLeaf.id) || riskMap?.get(table.name),
                isHighlighted: highlightedPath?.includes(elkLeaf.id),
                triggers: tableGraph?.triggers ?? [],
                policies: tableGraph?.policies ?? [],
                indexes: tableGraph?.indexes ?? [],
                enumNames: enumNames ?? new Set<string>(),
                checkConstraints: (table as any).checkConstraints ?? [],
                viewMode,
            },
        };
    };

    const buildViewNode = (elkLeaf: ElkNode, isMaterialized: boolean, parentNodeId?: string): Node | null => {
        const viewSource = isMaterialized ? matViewMap.get(elkLeaf.id) : viewMap.get(elkLeaf.id);
        if (!viewSource) return null;
        const isDimmed = highlightedPath && !highlightedPath.includes(elkLeaf.id);

        return {
            id: elkLeaf.id,
            type: isMaterialized ? 'matViewNode' : 'viewNode',
            parentId: parentNodeId,
            extent: parentNodeId && lockGroups ? 'parent' : undefined,
            position: { x: elkLeaf.x!, y: elkLeaf.y! },
            style: {
                opacity: isDimmed ? 0.3 : 1,
                filter: isDimmed ? 'grayscale(100%)' : 'none',
                transition: 'all 0.3s ease',
            },
            data: {
                label: viewSource.name,
                schema: viewSource.schema,
                isMaterialized,
                columnCount: viewSource.columns?.length,
                columns: viewSource.columns,
                onSubgraph,
            },
        };
    };

    const buildFunctionNode = (elkLeaf: ElkNode, parentNodeId?: string): Node | null => {
        const funcSource = functionMap.get(elkLeaf.id);
        if (!funcSource) return null;
        return {
            id: elkLeaf.id,
            type: 'functionNode',
            parentId: parentNodeId,
            extent: parentNodeId && lockGroups ? 'parent' : undefined,
            position: { x: elkLeaf.x!, y: elkLeaf.y! },
            style: dimStyle(elkLeaf.id),
            data: {
                label: funcSource.name,
                schema: funcSource.schema,
                isProcedure: funcSource.isProcedure,
                returnType: funcSource.returnType,
                isHighlighted: highlightedPath?.includes(elkLeaf.id),
            },
        };
    };

    const buildTypeNode = (elkLeaf: ElkNode, typeKind: 'ENUM' | 'DOMAIN', parentNodeId?: string): Node | null => {
        const typeSource = typeKind === 'ENUM' ? enumMapFiltered.get(elkLeaf.id) : domainMap.get(elkLeaf.id);
        if (!typeSource) return null;
        return {
            id: elkLeaf.id,
            type: 'typeNode',
            parentId: parentNodeId,
            extent: parentNodeId && lockGroups ? 'parent' : undefined,
            position: { x: elkLeaf.x!, y: elkLeaf.y! },
            style: dimStyle(elkLeaf.id),
            data: {
                label: typeSource.name,
                schema: typeSource.schema,
                typeKind,
                enumDef: typeKind === 'ENUM' ? typeSource : undefined,
                domainDef: typeKind === 'DOMAIN' ? typeSource : undefined,
                isHighlighted: highlightedPath?.includes(elkLeaf.id),
            },
        };
    };

    const buildRoleNode = (elkLeaf: ElkNode, parentNodeId?: string): Node | null => {
        const roleSource = roleMap.get(elkLeaf.id);
        if (!roleSource) return null;
        return {
            id: elkLeaf.id,
            type: 'roleNode',
            parentId: parentNodeId,
            extent: parentNodeId && lockGroups ? 'parent' : undefined,
            position: { x: elkLeaf.x!, y: elkLeaf.y! },
            style: dimStyle(elkLeaf.id),
            data: {
                label: roleSource.name,
                roleDef: roleSource,
                schema: undefined,
                isHighlighted: highlightedPath?.includes(elkLeaf.id),
            },
        };
    };

    const buildSequenceNode = (elkLeaf: ElkNode, parentNodeId?: string): Node | null => {
        const seqSource = sequenceMap.get(elkLeaf.id);
        if (!seqSource) return null;
        return {
            id: elkLeaf.id,
            type: 'sequenceNode',
            parentId: parentNodeId,
            extent: parentNodeId && lockGroups ? 'parent' : undefined,
            position: { x: elkLeaf.x!, y: elkLeaf.y! },
            style: dimStyle(elkLeaf.id),
            data: {
                label: seqSource.name,
                sequenceDef: seqSource,
                schema: seqSource.schema,
                isHighlighted: highlightedPath?.includes(elkLeaf.id),
            },
        };
    };

    const buildExtensionNode = (elkLeaf: ElkNode, parentNodeId?: string): Node | null => {
        const extSource = extensionMap.get(elkLeaf.id);
        if (!extSource) return null;
        return {
            id: elkLeaf.id,
            type: 'extensionNode',
            parentId: parentNodeId,
            extent: parentNodeId && lockGroups ? 'parent' : undefined,
            position: { x: elkLeaf.x!, y: elkLeaf.y! },
            style: dimStyle(elkLeaf.id),
            data: {
                label: extSource.name,
                extensionDef: extSource,
                schema: extSource.schema,
                isHighlighted: highlightedPath?.includes(elkLeaf.id),
            },
        };
    };

    const buildPolicyNode = (elkLeaf: ElkNode, parentNodeId?: string): Node | null => {
        const policySource = policyMap.get(elkLeaf.id);
        if (!policySource) return null;
        return {
            id: elkLeaf.id,
            type: 'policyNode',
            parentId: parentNodeId,
            extent: parentNodeId && lockGroups ? 'parent' : undefined,
            position: { x: elkLeaf.x!, y: elkLeaf.y! },
            style: dimStyle(elkLeaf.id),
            data: {
                label: policySource.name,
                policyDef: policySource,
                schema: policySource.schema,
                isHighlighted: highlightedPath?.includes(elkLeaf.id),
            },
        };
    };

    // ─── Dispatch helper ─────────────────────────────────────────────────────
    function pushNodeFromLeaf(elkLeaf: ElkNode, parentId?: string) {
        const node =
            buildTableNode(elkLeaf, parentId) ??
            buildViewNode(elkLeaf, false, parentId) ??
            buildViewNode(elkLeaf, true, parentId) ??
            buildFunctionNode(elkLeaf, parentId) ??
            buildTypeNode(elkLeaf, 'ENUM', parentId) ??
            buildTypeNode(elkLeaf, 'DOMAIN', parentId) ??
            buildRoleNode(elkLeaf, parentId) ??
            buildSequenceNode(elkLeaf, parentId) ??
            buildExtensionNode(elkLeaf, parentId) ??
            buildPolicyNode(elkLeaf, parentId);
        if (node) rfNodes.push(node);
    }

    // ─── Flat layout ────────────────────────────────────────────────────────
    if (!groupBySchema) {
        elkGraph.children?.forEach(leaf => pushNodeFromLeaf(leaf));
        return rfNodes;
    }

    // ─── Hierarchical layout ────────────────────────────────────────────────
    elkGraph.children?.forEach(elkGroup => {
        const schema = elkGroup.id.replace(/^group_/, '');

        // Group container node
        rfNodes.push({
            id: elkGroup.id,
            type: 'groupNode',
            position: { x: elkGroup.x!, y: elkGroup.y! },
            style: {
                width: elkGroup.width,
                height: elkGroup.height,
                zIndex: -1,
            },
            data: {
                label: schema,
                stats: {
                    tableCount: tables.filter(t => (t.schema || 'public') === schema).length,
                    viewCount: views.filter(v => (v.schema || 'public') === schema).length + matViews.filter(v => (v.schema || 'public') === schema).length,
                    relCount: renderGraph.relationships.filter(r => (r.source.schema || 'public') === schema && (r.target.schema || 'public') === schema).length,
                },
                onGroupAI,
            },
        });

        // Leaf nodes — position is relative to group (ELK parentNode semantic)
        elkGroup.children?.forEach(leaf => pushNodeFromLeaf(leaf, elkGroup.id));
    });

    return rfNodes;
}
