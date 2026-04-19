import { useCallback, useEffect, useMemo } from 'react';
import { ReactFlow, Controls, ControlButton, Background, BackgroundVariant, Node, Edge, useReactFlow } from '@xyflow/react';
import { Sparkles } from 'lucide-react';
import { Table } from '@/lib/sql-parser';
import { PathAnalysisOptions, PathStrategy } from '../features/path-analysis/usePathAnalysis';
import { PathAnalysisOverlay } from '../features/path-analysis/PathAnalysisOverlay';
import { AutoFitController, SearchFitController } from '../core/DiagramControllers';
import { nodeTypes, edgeTypes } from '../core/diagramNodeTypes';
import { LayoutingOverlay } from '../core/ui/LayoutingOverlay';

/** External ref for viewport control — populated by DiagramFlow */
export const viewportRef = { current: null as { setCenter: (x: number, y: number, opts?: { zoom?: number; duration?: number }) => void } | null };

function ResetFitController({ resetCount }: { resetCount: number }) {
    const { fitView } = useReactFlow();
    useEffect(() => {
        if (resetCount > 0) {
            const id = setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 50);
            return () => clearTimeout(id);
        }
    }, [resetCount, fitView]);
    return null;
}

function ViewportRefConnector() {
    const { setCenter } = useReactFlow();
    useEffect(() => {
        viewportRef.current = { setCenter };
    }, [setCenter]);
    return null;
}

interface DiagramFlowProps {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: (changes: any) => void;
    onEdgesChange: (changes: any) => void;
    onNodeSelect: (event: React.MouseEvent, node: Node) => void;
    onNodeClick: (event: React.MouseEvent, node: Node) => void;

    isLayouting: boolean;
    isGlowing: boolean;
    setIsGlowing: (glowing: boolean) => void;

    isSubgraphActive: boolean;
    subgraphConfig: any;
    activeSubgraphIds: Set<string> | undefined;
    searchQuery: string;

    pathMode: boolean;
    pathStart: string | null;
    pathEnd: string | null;
    pathDetails: any;
    pathStrategy: PathStrategy;
    setPathStrategy: (strategy: PathStrategy) => void;
    pathCost: number | null;
    tables: Table[];
    setPathStart: (id: string | null) => void;
    setPathEnd: (id: string | null) => void;
    resetPath: () => void;
    pathOptions: PathAnalysisOptions;
    setPathOptions: (options: PathAnalysisOptions) => void;
    onResetLayout?: () => void;
    resetCount?: number;
}

export function DiagramFlow({
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onNodeSelect,
    onNodeClick,

    isLayouting,
    isGlowing,
    setIsGlowing,

    isSubgraphActive,
    subgraphConfig,
    activeSubgraphIds,
    searchQuery,

    pathMode,
    pathStart,
    pathEnd,
    pathDetails,
    pathStrategy,
    setPathStrategy,
    pathCost,
    tables,
    setPathStart,
    setPathEnd,
    resetPath,
    pathOptions,
    setPathOptions,
    onResetLayout,
    resetCount = 0,
}: DiagramFlowProps) {
    const activeSubgraphNodes = useMemo(() =>
        activeSubgraphIds ? nodes.filter(n => activeSubgraphIds.has(n.id)) : undefined,
        [nodes, activeSubgraphIds]);

    const searchMatchedNodes = useMemo(() =>
        nodes.filter(n => !n.data?.isSearchDimmed
            && n.type !== 'resonaTableNode' && n.type !== 'resonaGroupNode' && n.type !== 'resonaGlobalNode'),
        [nodes]);

    return (
        <div className="flex-1 relative">
            <LayoutingOverlay isLayouting={isLayouting} />

            <PathAnalysisOverlay
                pathMode={pathMode}
                pathStart={pathStart}
                pathEnd={pathEnd}
                pathDetails={pathDetails}
                pathStrategy={pathStrategy}
                setPathStrategy={setPathStrategy}
                pathCost={pathCost}
                tables={tables}
                onPathStartChange={setPathStart}
                onPathEndChange={setPathEnd}
                onReset={resetPath}
                options={pathOptions}
                setOptions={setPathOptions}
            />

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodeClick={onNodeSelect}
                onNodeDoubleClick={onNodeClick}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                minZoom={0.03}
                maxZoom={2}
                zoomOnScroll={true}
                zoomOnPinch={true}
                panOnScroll={false}
                panOnDrag={true}
                className="bg-background !touch-none"
                defaultEdgeOptions={{ type: 'smoothstep' }}
                proOptions={{ hideAttribution: true }}
                edgesFocusable={false}
                nodesDraggable={true}
                onlyRenderVisibleElements={nodes.length > 50 && !nodes.some(n => n.type === 'groupNode')}
                elevateNodesOnSelect={true}
            >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(214, 32%, 91%)" />
                <Controls>
                    <ControlButton
                        onClick={() => setIsGlowing(!isGlowing)}
                        title="Toggle Connection Glow"
                        className={isGlowing ? "!bg-indigo-50 !text-indigo-600" : ""}
                    >
                        <Sparkles className="w-4 h-4" />
                    </ControlButton>
                    <ControlButton
                        onClick={onResetLayout}
                        title="Reset Layout"
                    >
                        <img src="/rotate-cw.png" alt="Reset Layout" className="w-4 h-4 object-contain brightness-0 dark:invert transition-colors" />
                    </ControlButton>
                </Controls>
                <AutoFitController isSubgraphActive={isSubgraphActive} focusTable={subgraphConfig?.focusTable} activeSubgraphNodes={activeSubgraphNodes} />
                <SearchFitController searchQuery={searchQuery} matchedNodes={searchMatchedNodes} />
                <ResetFitController resetCount={resetCount} />
                <ViewportRefConnector />
            </ReactFlow>
        </div>
    );
}
