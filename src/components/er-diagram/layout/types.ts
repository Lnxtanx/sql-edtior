import { Node, Edge } from '@xyflow/react';
import { RenderGraph } from '@/lib/schema-workspace';
import { LayoutDirection } from './useLayoutEngine';
import { CascadeRisk } from '@/lib/schema-workspace';
import { SchemaGraph } from '@/lib/schema-workspace';

export interface LayoutResult {
    nodes: Node[];
    edges: Edge[];
    timedOut?: boolean;
}

export interface LayoutEngineOptions {
    direction?: LayoutDirection;
    nodeSpacing?: number;
    rankSpacing?: number;
    viewMode?: 'ALL' | 'KEYS' | 'TITLE';
    groupBySchema?: boolean;
    lockGroups?: boolean;
    riskMap?: Map<string, CascadeRisk>;
    highlightedPath?: string[];
    isGlowing?: boolean;
    graph?: SchemaGraph | null;
    enumNames?: Set<string>;
    activeSubgraphIds?: Set<string>;
    onTableAI?: (tableName: string, position?: { x: number; y: number }) => void;
    onSubgraph?: (tableName: string) => void;
    // Phase 4.9: Group AI callback injected into GroupNode data
    onGroupAI?: (schema: string) => void;
}

export interface ILayoutEngine {
    layout(renderGraph: RenderGraph, options: LayoutEngineOptions): Promise<LayoutResult>;
}
