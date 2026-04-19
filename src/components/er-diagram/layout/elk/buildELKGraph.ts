/**
 * elk/buildELKGraph.ts
 *
 * Constructs the ELK graph JSON that drives layout computation.
 * Responsible for:
 *  - BFS-based layer assignment for subgraph focus
 *  - Flat layout (groupBySchema=false): all nodes in root
 *  - Hierarchical layout (groupBySchema=true): nodes inside schema group containers
 *  - Cross-group vs intra-group edge classification
 */
import { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import { Table, Relationship } from '@/lib/sql-parser';
import { RenderGraph } from '@/lib/schema-workspace';
import { toNodeId } from '@/lib/schema-workspace/utils';
import { LayoutEngineOptions } from '../types';
import {
    NODE_WIDTH,
    FUNCTION_HEIGHT,
    DOMAIN_HEIGHT,
    ROLE_HEIGHT,
    SEQUENCE_HEIGHT,
    EXTENSION_HEIGHT,
    GROUP_HEADER_HEIGHT,
    GROUP_PADDING_H,
    GROUP_PADDING_B,
} from './constants';
import {
    computeTableHeight,
    computeViewHeight,
    computeEnumHeight,
    computePolicyHeight,
} from './heightCalculators';

// ---------------------------------------------------------------------------
// Cardinality helper
// Bug 1.8 fix: accept a pre-built Map instead of a raw Table[] array.
// O(E) instead of O(T×E).
// ---------------------------------------------------------------------------
export function getCardinality(
    rel: Relationship,
    tableMap: Map<string, Table>
): { source: string; target: string; label: string } {
    const sourceKey = `${rel.source.schema ?? ''}.${rel.source.table}`;
    const targetKey = `${rel.target.schema ?? ''}.${rel.target.table}`;
    const sourceTable = tableMap.get(sourceKey);
    const targetTable = tableMap.get(targetKey);

    if (!sourceTable || !targetTable) return { source: 'n', target: '1', label: 'n:1' };

    const sourceCol = sourceTable.columns.find(c => c.name === rel.source.column);
    const targetCol = targetTable.columns.find(c => c.name === rel.target.column);
    const sourceIsUnique = sourceCol?.isUnique || sourceCol?.isPrimaryKey;
    const targetIsPK = targetCol?.isPrimaryKey;

    if (sourceIsUnique && targetIsPK) return { source: '1', target: '1', label: '1:1' };
    if (targetIsPK) return { source: 'n', target: '1', label: 'n:1' };
    return { source: 'n', target: 'n', label: 'n:n' };
}

// ---------------------------------------------------------------------------
// Adjacency map builder for BFS traversal
// Issue 2.8: Extract to allow memoization at call site.
// ---------------------------------------------------------------------------
export function buildAdjacencyMaps(relationships: Relationship[]): {
    outEdges: Map<string, string[]>;
    inEdges: Map<string, string[]>;
} {
    const outEdges = new Map<string, string[]>();
    const inEdges = new Map<string, string[]>();
    relationships.forEach(r => {
        const s = toNodeId(r.source.schema, r.source.table);
        const t = toNodeId(r.target.schema, r.target.table);
        if (!outEdges.has(s)) outEdges.set(s, []);
        if (!inEdges.has(t)) inEdges.set(t, []);
        outEdges.get(s)!.push(t);
        inEdges.get(t)!.push(s);
    });
    return { outEdges, inEdges };
}

// ---------------------------------------------------------------------------
// ELK direction mapping
// ---------------------------------------------------------------------------
export const DIRECTION_MAP: Record<string, string> = {
    LR: 'RIGHT',
    RL: 'LEFT',
    TB: 'DOWN',
    BT: 'UP',
};

// ---------------------------------------------------------------------------
// layoutOptions factories
// ---------------------------------------------------------------------------
export function buildRootLayoutOptions(
    elkDir: string,
    nodeSpacing: number,
    rankSpacing: number,
): Record<string, string> {
    return {
        'elk.algorithm': 'layered',
        'elk.direction': elkDir,
        'elk.layered.spacing.nodeNodeBetweenLayers': `${rankSpacing}`,
        'elk.spacing.nodeNode': `${nodeSpacing}`,
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.crossingMinimization.greedySwitch.type': 'OFF',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        'elk.padding': '[top=40, left=40, bottom=40, right=40]',
        'elk.layered.mergeEdges': 'true',
        'elk.edgeRouting': 'ORTHOGONAL',
    };
}

export function buildGroupLayoutOptions(elkDir: string, useBoxAlg: boolean = false): Record<string, string> {
    if (useBoxAlg) {
        return {
            'elk.algorithm': 'box',
            'elk.direction': elkDir,
            'elk.padding': `[top=${GROUP_HEADER_HEIGHT}, left=${GROUP_PADDING_H}, bottom=${GROUP_PADDING_B}, right=${GROUP_PADDING_H}]`,
        };
    }
    return {
        'elk.algorithm': 'layered',
        'elk.direction': elkDir,
        'elk.layered.spacing.nodeNodeBetweenLayers': '120',
        'elk.spacing.nodeNode': '30',
        'elk.padding': `[top=${GROUP_HEADER_HEIGHT}, left=${GROUP_PADDING_H}, bottom=${GROUP_PADDING_B}, right=${GROUP_PADDING_H}]`,
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
    };
}

// ---------------------------------------------------------------------------
// Build ELK graph JSON
// ---------------------------------------------------------------------------
export function buildELKGraph(
    renderGraph: RenderGraph,
    options: LayoutEngineOptions,
): ElkNode {
    const { tables, views, matViews, functions = [], enums = [], domains = [], roles = [], sequences = [], extensions = [], policies = [], relationships } = renderGraph;
    const {
        direction = 'LR',
        nodeSpacing = 80,
        rankSpacing = 200,
        groupBySchema = false,
        viewMode = 'ALL',
    } = options;

    const elkDir = DIRECTION_MAP[direction] ?? 'RIGHT';

    // Collect all node IDs that exist in the render graph
    const validNodeIds = new Set<string>();
    tables.forEach(t => validNodeIds.add(toNodeId(t.schema, t.name)));
    views.forEach(v => validNodeIds.add(toNodeId(v.schema, v.name)));
    matViews.forEach(v => validNodeIds.add(toNodeId(v.schema, v.name)));
    functions.forEach(f => validNodeIds.add(toNodeId(f.schema, f.name)));
    enums.forEach(e => validNodeIds.add(toNodeId(e.schema, e.name)));
    domains.forEach(d => validNodeIds.add(toNodeId(d.schema, d.name)));
    roles.forEach(r => validNodeIds.add(toNodeId(undefined, r.name)));
    sequences.forEach(s => validNodeIds.add(toNodeId(s.schema, s.name)));
    extensions.forEach(ext => validNodeIds.add(toNodeId(undefined, ext.name)));
    policies.forEach(p => validNodeIds.add(toNodeId(p.schema, p.name)));

    const totalNodes = tables.length + views.length + matViews.length +
        functions.length + enums.length + domains.length +
        roles.length + sequences.length + extensions.length + policies.length;

    let useBoxAlgForGroups = false;
    if (totalNodes > 150 && groupBySchema) {
        useBoxAlgForGroups = true;
    }

    // ─── BFS Traversal for layer assignment ────────────────────────────────
    const layerIndices = new Map<string, number>();
    let minLayer = 0;

    if (options.activeSubgraphIds && options.activeSubgraphIds.size > 0) {
        const centerId = options.highlightedPath?.[0] || Array.from(options.activeSubgraphIds)[0];

        if (centerId && validNodeIds.has(centerId)) {
            layerIndices.set(centerId, 0);

            const queue: { id: string, layer: number }[] = [{ id: centerId, layer: 0 }];
            const visited = new Set<string>([centerId]);

            // Issue 2.8: Use extracted helper for adjacency maps
            const { outEdges, inEdges } = buildAdjacencyMaps(relationships);

            let head = 0;
            while (head < queue.length) {
                const curr = queue[head++];
                (outEdges.get(curr.id) || []).forEach(child => {
                    if (!visited.has(child) && options.activeSubgraphIds!.has(child)) {
                        visited.add(child);
                        layerIndices.set(child, curr.layer + 1);
                        queue.push({ id: child, layer: curr.layer + 1 });
                    }
                });
                (inEdges.get(curr.id) || []).forEach(parent => {
                    if (!visited.has(parent) && options.activeSubgraphIds!.has(parent)) {
                        visited.add(parent);
                        layerIndices.set(parent, curr.layer - 1);
                        minLayer = Math.min(minLayer, curr.layer - 1);
                        queue.push({ id: parent, layer: curr.layer - 1 });
                    }
                });
            }
        }
    }

    // ELK requires non-negative layers
    const getLayerOpt = (id: string) => {
        if (!layerIndices.has(id)) return undefined;
        return { 'elk.layered.layer': String(layerIndices.get(id)! - minLayer) };
    };

    // ─── FLAT layout ────────────────────────────────────────────────────────
    if (!groupBySchema) {
        const children: ElkNode[] = [
            ...tables.map(t => ({
                id: toNodeId(t.schema, t.name),
                width: NODE_WIDTH,
                height: computeTableHeight(t, viewMode),
                layoutOptions: getLayerOpt(toNodeId(t.schema, t.name)),
            })),
            ...views.map(v => ({
                id: toNodeId(v.schema, v.name),
                width: NODE_WIDTH,
                height: computeViewHeight(v.columns?.length ?? 0),
                layoutOptions: getLayerOpt(toNodeId(v.schema, v.name)),
            })),
            ...matViews.map(v => ({
                id: toNodeId(v.schema, v.name),
                width: NODE_WIDTH,
                height: computeViewHeight(v.columns?.length ?? 0),
                layoutOptions: getLayerOpt(toNodeId(v.schema, v.name)),
            })),
            ...functions.map(f => ({
                id: toNodeId(f.schema, f.name),
                width: NODE_WIDTH,
                height: FUNCTION_HEIGHT,
                layoutOptions: getLayerOpt(toNodeId(f.schema, f.name)),
            })),
            ...enums.map(e => ({
                id: toNodeId(e.schema, e.name),
                width: NODE_WIDTH,
                height: computeEnumHeight(e.values.length),
                layoutOptions: getLayerOpt(toNodeId(e.schema, e.name)),
            })),
            ...domains.map(d => ({
                id: toNodeId(d.schema, d.name),
                width: NODE_WIDTH,
                height: DOMAIN_HEIGHT,
                layoutOptions: getLayerOpt(toNodeId(d.schema, d.name)),
            })),
            ...roles.map(r => ({
                id: toNodeId(undefined, r.name),
                width: NODE_WIDTH,
                height: ROLE_HEIGHT,
                layoutOptions: getLayerOpt(toNodeId(undefined, r.name)),
            })),
            ...sequences.map(s => ({
                id: toNodeId(s.schema, s.name),
                width: NODE_WIDTH,
                height: SEQUENCE_HEIGHT,
                layoutOptions: getLayerOpt(toNodeId(s.schema, s.name)),
            })),
            ...extensions.map(ext => ({
                id: toNodeId(undefined, ext.name),
                width: NODE_WIDTH,
                height: EXTENSION_HEIGHT,
                layoutOptions: getLayerOpt(toNodeId(undefined, ext.name)),
            })),
            ...policies.map(p => ({
                id: toNodeId(p.schema, p.name),
                width: NODE_WIDTH,
                height: computePolicyHeight(p),
                layoutOptions: getLayerOpt(toNodeId(p.schema, p.name)),
            })),
        ];

        const edges: ElkExtendedEdge[] = relationships
            .filter(r => validNodeIds.has(toNodeId(r.source.schema, r.source.table))
                && validNodeIds.has(toNodeId(r.target.schema, r.target.table)))
            .map(r => ({
                id: r.id,
                sources: [toNodeId(r.source.schema, r.source.table)],
                targets: [toNodeId(r.target.schema, r.target.table)],
            }));

        return {
            id: 'root',
            layoutOptions: buildRootLayoutOptions(elkDir, nodeSpacing, rankSpacing),
            children,
            edges,
        };
    }

    // ─── HIERARCHICAL layout ────────────────────────────────────────────────
    type GroupMembers = { tables: Table[] };
    const schemaMap = new Map<string, GroupMembers>();

    const ensureGroup = (schema: string) => {
        if (!schemaMap.has(schema)) schemaMap.set(schema, { tables: [] });
        return schemaMap.get(schema)!;
    };

    tables.forEach(t => ensureGroup(t.schema || 'public').tables.push(t));
    views.forEach(v => ensureGroup(v.schema || 'public'));
    matViews.forEach(v => ensureGroup(v.schema || 'public'));
    functions.forEach(f => ensureGroup(f.schema || 'public'));
    enums.forEach(e => ensureGroup(e.schema || 'public'));
    domains.forEach(d => ensureGroup(d.schema || 'public'));
    roles.forEach(() => ensureGroup('public')); // Roles are global
    sequences.forEach(s => ensureGroup(s.schema || 'public'));
    extensions.forEach(() => ensureGroup('public')); // Extensions are global
    policies.forEach(p => ensureGroup(p.schema || 'public'));

    // Classify edges: intra-group vs cross-group
    const intraEdges = new Map<string, ElkExtendedEdge[]>();
    const crossEdges: ElkExtendedEdge[] = [];

    relationships.forEach(r => {
        const src = toNodeId(r.source.schema, r.source.table);
        const tgt = toNodeId(r.target.schema, r.target.table);
        if (!validNodeIds.has(src) || !validNodeIds.has(tgt)) return;

        const sg = r.source.schema || 'public';
        const tg = r.target.schema || 'public';
        const edge: ElkExtendedEdge = { id: r.id, sources: [src], targets: [tgt] };

        if (sg === tg) {
            if (!intraEdges.has(sg)) intraEdges.set(sg, []);
            intraEdges.get(sg)!.push(edge);
        } else {
            crossEdges.push(edge);
        }
    });

    // Build group children
    const groupChildren: ElkNode[] = Array.from(schemaMap.entries()).map(([schema, members]) => {
        const groupLeaves: ElkNode[] = [
            ...members.tables.map(t => ({
                id: toNodeId(t.schema, t.name),
                width: NODE_WIDTH,
                height: computeTableHeight(t, viewMode),
                layoutOptions: getLayerOpt(toNodeId(t.schema, t.name)),
            })),
            ...views
                .filter(v => (v.schema || 'public') === schema)
                .map(v => ({ id: toNodeId(v.schema, v.name), width: NODE_WIDTH, height: computeViewHeight(v.columns?.length ?? 0), layoutOptions: getLayerOpt(toNodeId(v.schema, v.name)) })),
            ...matViews
                .filter(v => (v.schema || 'public') === schema)
                .map(v => ({ id: toNodeId(v.schema, v.name), width: NODE_WIDTH, height: computeViewHeight(v.columns?.length ?? 0), layoutOptions: getLayerOpt(toNodeId(v.schema, v.name)) })),
            ...functions
                .filter(f => (f.schema || 'public') === schema)
                .map(f => ({ id: toNodeId(f.schema, f.name), width: NODE_WIDTH, height: FUNCTION_HEIGHT, layoutOptions: getLayerOpt(toNodeId(f.schema, f.name)) })),
            ...enums
                .filter(e => (e.schema || 'public') === schema)
                .map(e => ({ id: toNodeId(e.schema, e.name), width: NODE_WIDTH, height: computeEnumHeight(e.values.length), layoutOptions: getLayerOpt(toNodeId(e.schema, e.name)) })),
            ...domains
                .filter(d => (d.schema || 'public') === schema)
                .map(d => ({ id: toNodeId(d.schema, d.name), width: NODE_WIDTH, height: DOMAIN_HEIGHT, layoutOptions: getLayerOpt(toNodeId(d.schema, d.name)) })),
            ...roles
                .filter(() => schema === 'public')
                .map(r => ({ id: toNodeId(undefined, r.name), width: NODE_WIDTH, height: ROLE_HEIGHT, layoutOptions: getLayerOpt(toNodeId(undefined, r.name)) })),
            ...sequences
                .filter(s => (s.schema || 'public') === schema)
                .map(s => ({ id: toNodeId(s.schema, s.name), width: NODE_WIDTH, height: SEQUENCE_HEIGHT, layoutOptions: getLayerOpt(toNodeId(s.schema, s.name)) })),
            ...extensions
                .filter(() => schema === 'public')
                .map(ext => ({ id: toNodeId(undefined, ext.name), width: NODE_WIDTH, height: EXTENSION_HEIGHT, layoutOptions: getLayerOpt(toNodeId(undefined, ext.name)) })),
            ...policies
                .filter(p => (p.schema || 'public') === schema)
                .map(p => ({ id: toNodeId(p.schema, p.name), width: NODE_WIDTH, height: computePolicyHeight(p), layoutOptions: getLayerOpt(toNodeId(p.schema, p.name)) })),
        ];

        return {
            id: `group_${schema}`,
            layoutOptions: buildGroupLayoutOptions(elkDir, useBoxAlgForGroups),
            children: groupLeaves,
            edges: intraEdges.get(schema) ?? [],
        };
    });

    return {
        id: 'root',
        layoutOptions: buildRootLayoutOptions(elkDir, nodeSpacing, rankSpacing),
        children: groupChildren,
        edges: crossEdges,
    };
}
