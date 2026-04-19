/**
 * useLayoutEngine.ts
 *
 * React hook that runs ELK hierarchical layout asynchronously and returns
 * React Flow nodes + edges. Replaces the previous single-pass Dagre compound
 * layout with a production-grade two-level hierarchical layout:
 *   - Root (inter-group): larger spacing between schema groups
 *   - Group (intra-group): tight spacing between tables within a group
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { Node, Edge, MarkerType } from '@xyflow/react';
import { RenderGraph, SchemaGraph } from '@/lib/schema-workspace';
import { CascadeRisk } from '@/lib/schema-workspace';
import { ELKLayoutEngine } from './ELKLayoutEngine';
import { LayoutResult } from './types';
import { toNodeId } from '@/lib/schema-workspace/utils';
import { Table, Relationship } from '@/lib/sql-parser';

export type LayoutDirection = 'TB' | 'LR' | 'BT' | 'RL';

interface LayoutOptions {
  direction?: LayoutDirection;
  nodeSpacing?: number;
  rankSpacing?: number;
  onSubgraph?: (tableName: string) => void;
  onTableAI?: (tableName: string) => void;
  onGroupAI?: (schema: string) => void;
  riskMap?: Map<string, CascadeRisk>;
  highlightedPath?: string[];
  isGlowing?: boolean;
  graph?: SchemaGraph | null;
  enumNames?: Set<string>;
  viewMode?: 'ALL' | 'KEYS' | 'TITLE';
  groupBySchema?: boolean;
  lockGroups?: boolean;
  activeSubgraphIds?: Set<string>;
}

// Module-level singleton — ELK does not need to be re-created between calls
const layoutEngine = new ELKLayoutEngine();

const EMPTY_RESULT: LayoutResult = { nodes: [], edges: [] };

// ---------------------------------------------------------------------------
// Stage 2: Visual Edge Building Helpers
// ---------------------------------------------------------------------------
function getCardinality(
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

function buildRFEdges(renderGraph: RenderGraph, options: LayoutOptions): Edge[] {
  const { relationships, tables } = renderGraph;
  const { highlightedPath, activeSubgraphIds, isGlowing = false } = options;

  const validIds = new Set<string>();
  renderGraph.tables.forEach(t => validIds.add(toNodeId(t.schema, t.name)));
  renderGraph.views.forEach(v => validIds.add(toNodeId(v.schema, v.name)));
  renderGraph.matViews.forEach(v => validIds.add(toNodeId(v.schema, v.name)));
  renderGraph.functions?.forEach(f => validIds.add(toNodeId(f.schema, f.name)));
  renderGraph.enums?.forEach(e => validIds.add(toNodeId(e.schema, e.name)));
  renderGraph.domains?.forEach(d => validIds.add(toNodeId(d.schema, d.name)));
  renderGraph.roles?.forEach(r => validIds.add(toNodeId(undefined, r.name)));
  renderGraph.sequences?.forEach(s => validIds.add(toNodeId(s.schema, s.name)));
  renderGraph.extensions?.forEach(ext => validIds.add(toNodeId(undefined, ext.name)));
  renderGraph.policies?.forEach(p => validIds.add(toNodeId(p.schema, p.name)));

  const cardinalityTableMap = new Map<string, Table>(
    tables.map(t => [`${t.schema ?? ''}.${t.name}`, t])
  );

  return relationships
    .filter(r =>
      validIds.has(toNodeId(r.source.schema, r.source.table)) &&
      validIds.has(toNodeId(r.target.schema, r.target.table))
    )
    .map(rel => {
      const sourceId = toNodeId(rel.source.schema, rel.source.table);
      const targetId = toNodeId(rel.target.schema, rel.target.table);
      const cardinality = getCardinality(rel, cardinalityTableMap);

      const isView = rel.type === 'VIEW_DEPENDENCY';
      const isTrigger = rel.type === 'TRIGGER_TARGET';
      const isCalls = rel.type === 'CALLS';
      const isDependsOn = rel.type === 'DEPENDS_ON';
      const isOwnsPolicy = rel.type === 'OWNS_POLICY';
      const isAppliesTo = rel.type === 'APPLIES_TO';
      const isHasSequence = rel.type === 'HAS_SEQUENCE';
      const isStandardRelation = !isView && !isTrigger && !isCalls && !isDependsOn && !isHasSequence && !isOwnsPolicy && !isAppliesTo;

      let edgeColor = '#6366f1';
      let strokeDasharray = '';
      let strokeWidth = 2;

      let isPathEdge = false;
      if (highlightedPath && highlightedPath.length > 1) {
        const si = highlightedPath.indexOf(sourceId);
        const ti = highlightedPath.indexOf(targetId);
        if (si !== -1 && ti !== -1 && Math.abs(si - ti) === 1) isPathEdge = true;
      }

      let isActiveSubgraphEdge = false;
      if (activeSubgraphIds && activeSubgraphIds.has(sourceId) && activeSubgraphIds.has(targetId)) {
        isActiveSubgraphEdge = true;
      }

      if (highlightedPath && !isPathEdge) edgeColor = '#94a3b8';
      if (isPathEdge) { edgeColor = '#10b981'; strokeWidth = 3; }
      else if (isActiveSubgraphEdge) { edgeColor = '#10b981'; strokeWidth = 3; }

      if (isView) { if (!highlightedPath || isPathEdge) edgeColor = '#f59e0b'; strokeDasharray = '5, 5'; }
      if (isTrigger) { if (!highlightedPath || isPathEdge) edgeColor = '#ef4444'; strokeDasharray = '5, 5'; }
      if (isCalls) {
        if (!highlightedPath || isPathEdge) edgeColor = '#d946ef';
        strokeDasharray = '8, 4';
        strokeWidth = 2.5;
      }
      if (isDependsOn || isHasSequence) {
        if (!highlightedPath || isPathEdge) edgeColor = '#14b8a6';
        strokeDasharray = '5, 5';
        strokeWidth = 1.5;
      }
      if (isOwnsPolicy || isAppliesTo) {
        if (!highlightedPath || isPathEdge) edgeColor = '#64748b';
        strokeDasharray = '4, 4';
        strokeWidth = 1.5;
      }

      let label = cardinality.label;
      if (isView) label = 'depends on';
      if (isTrigger) label = 'triggers';
      if (isCalls) label = 'calls function';
      if (isDependsOn) label = 'uses type';
      if (isOwnsPolicy) label = 'owns';
      if (isAppliesTo) label = 'applies to';
      if (isHasSequence) label = 'uses seq';

      if (rel.onDelete && rel.onDelete !== 'NO ACTION' && isStandardRelation) {
        label += ` • ${rel.onDelete}`;
      }

      const isCascade = rel.onDelete === 'CASCADE';
      const confidence = rel.confidence ?? 1.0;
      const isLowConf = confidence < 1.0;

      if (isCascade) { label += ' ⚠️'; if (!highlightedPath || isPathEdge) edgeColor = '#ef4444'; }
      if (isLowConf) { label += ' (?)'; if (!highlightedPath || isPathEdge) edgeColor = isView ? '#fcd34d' : '#fca5a5'; }
      if (isGlowing && isStandardRelation && !isLowConf) { edgeColor = '#6366f1'; strokeWidth = 3; }

      const isDimmed = (highlightedPath && !isPathEdge) ||
        (activeSubgraphIds && !isActiveSubgraphEdge);

      const isAnimated = isTrigger || isCalls || isPathEdge || isActiveSubgraphEdge || (isGlowing && isStandardRelation && !isLowConf);

      return {
        id: rel.id,
        source: sourceId,
        target: targetId,
        sourceHandle: `${rel.source.column ? rel.source.column + '-source' : 'default-source'}`,
        targetHandle: `${rel.target.column ? rel.target.column + '-target' : 'default-target'}`,
        type: 'relationship',
        animated: isAnimated,
        className: isAnimated ? 'animated-edge' : '',
        style: {
          stroke: edgeColor,
          strokeWidth: isPathEdge ? 4 : (isActiveSubgraphEdge ? 3 : (isLowConf || isDimmed ? 1.5 : strokeWidth)),
          strokeDasharray,
          opacity: isDimmed ? 0.2 : (confidence < 0.8 ? 0.7 : 1),
          ...((isGlowing && !isView && !isTrigger && !isLowConf) ? { filter: 'drop-shadow(0 0 3px #818cf8)' } : {}),
        },
        data: { label, isView, isTrigger, isDimmed, confidence },
        zIndex: isPathEdge ? 10 : (isActiveSubgraphEdge ? 5 : 0),
        markerStart: { type: MarkerType.Arrow, color: edgeColor, width: 15, height: 15 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 15, height: 15 },
      };
    });
}

// ---------------------------------------------------------------------------
// Main Hook
// ---------------------------------------------------------------------------
export function useLayoutEngine(
  renderGraph: RenderGraph,
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[]; isLayouting: boolean } {
  const {
    direction = 'LR',
    nodeSpacing = 80,
    rankSpacing = 200,
    onSubgraph,
    onTableAI,
    onGroupAI,
    riskMap,
    highlightedPath,
    isGlowing = false,
    graph,
    enumNames,
    viewMode = 'ALL',
    groupBySchema = false,
    lockGroups = false,
    activeSubgraphIds,
  } = options;

  const { tables, views, matViews, relationships } = renderGraph;

  const [layoutResult, setLayoutResult] = useState<LayoutResult>(EMPTY_RESULT);
  // Phase 5.3: isLayouting tracks whether ELK is actively computing
  const [isLayouting, setIsLayouting] = useState(false);
  // Unique counter per layout run — prevents console.time duplicate-name warning
  const layoutRunRef = useRef(0);

  // Stable reference for callbacks so they don't trigger re-layouts
  const callbackRef = useRef({ onSubgraph, onTableAI, onGroupAI });
  useEffect(() => { callbackRef.current = { onSubgraph, onTableAI, onGroupAI }; });

  // -------------------------------------------------------------------------
  // Stage 1: Structural Layout (ELK)
  // Only runs when actual nodes/groups or layout directions change.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (tables.length === 0 && views.length === 0 && matViews.length === 0) {
      setLayoutResult(EMPTY_RESULT);
      return;
    }

    let cancelled = false;
    let timerStarted = false;
    // Unique ID per run avoids the "Timer already exists" console warning
    // that fires when a previous timer was never ended (due to cancellation).
    const runId = ++layoutRunRef.current;
    const timerLabel = `[ELK] layout #${runId}`;

    // Phase 5.8: Dev-only performance timing
    if (import.meta.env.DEV) { console.time(timerLabel); timerStarted = true; }
    setIsLayouting(true);

    // Notice we DO NOT pass visual-only settings into the ELK layouter anymore.
    // ELK is purely computing `{ x, y, width, height }` boxes.
    layoutEngine.layout(renderGraph, {
      direction,
      nodeSpacing,
      rankSpacing,
      viewMode,
      groupBySchema,
      lockGroups,
      onSubgraph: callbackRef.current.onSubgraph,
      onTableAI: callbackRef.current.onTableAI,
      onGroupAI: callbackRef.current.onGroupAI,
    }).then(result => {
      if (!cancelled) {
        if (import.meta.env.DEV && timerStarted) console.timeEnd(timerLabel);
        setIsLayouting(false);
        setLayoutResult(result);
        if (result.timedOut) {
          console.warn('[Layout] Schema too large for grouped layout. Showing flat view.');
        }
      }
    }).catch(err => {
      if (!cancelled) {
        if (import.meta.env.DEV && timerStarted) { try { console.timeEnd(timerLabel); } catch { } }
        setIsLayouting(false);
        console.error('[ELKLayoutEngine] Layout failed:', err);
        setLayoutResult(EMPTY_RESULT);
      }
    });

    return () => {
      cancelled = true;
      // Only end the timer if it was actually started — avoids the
      // "Timer does not exist" warning that fires during HMR/rapid remounts.
      if (import.meta.env.DEV && timerStarted) { try { console.timeEnd(timerLabel); } catch { } }
      // Reset the spinner immediately on cancellation.
      // The new effect (if deps changed) will set it back to true right away,
      // so there is no visible flicker. Without this, rapid dep changes leave
      // isLayouting=true permanently because the promise never resolves.
      setIsLayouting(false);
    };
  }, [
    tables,
    views,
    matViews,
    relationships,
    direction,
    nodeSpacing,
    rankSpacing,
    viewMode,
    groupBySchema,
    lockGroups,
  ]); // Removed visual deps: riskMap, highlightedPath, isGlowing, graph, enumNames, activeSubgraphIds

  // -------------------------------------------------------------------------
  // Stage 2: Visual Styling (React useMemo)
  // Re-runs instantaneously when hover/glow/path highlighting happens.
  // We re-compute the RF edges array (colors, thickness, animations) without ELK.
  // -------------------------------------------------------------------------
  const nodesAndEdges = useMemo(() => {
    const nodes = layoutResult.nodes;
    const styledEdges = buildRFEdges(renderGraph, {
      highlightedPath,
      activeSubgraphIds,
      isGlowing,
      riskMap,
      graph,
      enumNames
    });
    return { nodes, edges: styledEdges };
  }, [
    layoutResult,
    renderGraph.relationships,
    renderGraph.tables,
    highlightedPath,
    activeSubgraphIds,
    isGlowing,
    riskMap,
    graph,
    enumNames
  ]);

  // Phase 5.3: return isLayouting alongside nodes/edges for skeleton overlay
  return {
    nodes: nodesAndEdges.nodes,
    edges: nodesAndEdges.edges,
    isLayouting,
  };
}
