import { useCallback, useRef, useState, useEffect, memo } from 'react';
import { Node } from '@xyflow/react';
import { LayoutGrid } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import { useLayoutEngine } from '../layout/useLayoutEngine';
import { Table, Relationship, ParsedSchema } from '@/lib/sql-parser';
import { GraphStats } from '@/lib/schema-workspace';
import { usePathAnalysis, PathAnalysisOptions, PathStrategy } from '../features/path-analysis/usePathAnalysis';
import { useDiagramState } from './DiagramProvider';

// Hooks
import { useDiagramExport } from '../features/hooks/useDiagramExport';
import { useDiagramStats } from '../features/hooks/useDiagramStats';
import { useDiagramGraph } from './hooks/useDiagramGraph';
import { useDiagramNodes } from './hooks/useDiagramNodes';
import { useResonaNodes } from './hooks/useResonaNodes';

// UI Components
import { DiagramToolbar } from '../ui/DiagramToolbar';
import { DiagramFooter } from '../ui/DiagramFooter';
import { DiagramEmptyState } from '../ui/DiagramEmptyState';
import { SubgraphBanner } from './ui/SubgraphBanner';
import { viewportRef, DiagramFlow } from '../ui/DiagramFlow';
import { DiagramModals } from '../ui/DiagramModals';

// Providers & Context
import { useCurrentFile } from '@/components/connection/CurrentFileContext';
import { useLinkedConnection } from '@/components/connection/hooks/useLinkedConnection';
import { useAuth } from '@/components/auth/AuthProvider';

interface DiagramCanvasProps {
  tables: Table[];
  relationships: Relationship[];
  schema?: ParsedSchema | null;
  onTableClick?: (tableName: string) => void;
  onTableSelect?: (tableName: string | null) => void;
  onApplySQL?: (sql: string) => void;
  onSubgraph?: (tableName: string) => void;
  subgraphConfig?: {
    focusTable: string | null;
    depth: number;
    direction: 'outbound' | 'inbound' | 'both';
    showViews?: boolean;
    showMaterializedViews?: boolean;
    minConfidence?: number;
  };
  user?: any;
  signInWithGoogle?: () => void;
  signOut?: () => void;
  showGlobalAI?: boolean;
  onTableAI?: (tableName: string) => void;
  mode?: 'default' | 'minimal';
  onStatsChange?: (stats: GraphStats | null) => void;
  // Table Editing
  editingTable?: Table | null;
  onEditChange?: (table: Table) => void;
  onEditClose?: () => void;
  onSubgraphConfigChange?: (config: DiagramCanvasProps['subgraphConfig']) => void;
  openGraphSettings?: boolean;
  onGraphSettingsClosed?: () => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

export default memo(function DiagramCanvas({
  tables,
  relationships,
  schema,
  onTableClick,
  onTableSelect,
  onApplySQL,
  onSubgraph,
  subgraphConfig,
  user,
  signInWithGoogle,
  signOut,
  showGlobalAI,
  onTableAI,
  mode = 'default',
  onStatsChange,
  editingTable,
  onEditChange,
  onEditClose,
  onSubgraphConfigChange,
  openGraphSettings: openGraphSettingsProp,
  onGraphSettingsClosed,
  searchQuery: externalSearchQuery,
  onSearchQueryChange: externalSearchQueryChange,
}: DiagramCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [internalSearchQuery, setInternalSearchQuery] = useState('');

  // Connect to Diagram Context
  const {
    layoutDirection, setLayoutDirection,
    viewMode,
    groupBySchema,
    lockGroups,
    isFullscreen, setIsFullscreen,
    isGlowing, setIsGlowing,
    showTerminal, setShowTerminal,
    showGraphSettings, setShowGraphSettings,
    graphSettingsTab, setGraphSettingsTab,
    hiddenSchemas,
    nodeTypeVisibility,
  } = useDiagramState();

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = externalSearchQueryChange || setInternalSearchQuery;

  const [localStats, setLocalStats] = useState<GraphStats | null>(null);
  const [pathOptions, setPathOptions] = useState<PathAnalysisOptions>({
    excludeInferred: false,
    excludeLowConfidence: false
  });
  const [activeGroupSchema, setActiveGroupSchema] = useState<string | null>(null);
  const onCloseGroupAI = useCallback(() => setActiveGroupSchema(null), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setShowTerminal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowTerminal]);

  const { fileId, fileName, projectId, connectionId: fileConnectionId } = useCurrentFile();
  const { linkedConnection, linkedConnectionId } = useLinkedConnection(fileId);
  const { isLoggingIn } = useAuth();

  // Open GraphSettingsPanel when focusTable becomes non-null
  const prevFocusTable = useRef(subgraphConfig?.focusTable);
  useEffect(() => {
    const current = subgraphConfig?.focusTable ?? null;
    const prev = prevFocusTable.current ?? null;
    if (current && current !== prev) {
      setShowGraphSettings(true);
      setGraphSettingsTab('impact');
    }
    prevFocusTable.current = current;
  }, [subgraphConfig?.focusTable, setShowGraphSettings, setGraphSettingsTab]);

  useEffect(() => {
    if (openGraphSettingsProp) {
      setShowGraphSettings(true);
      setGraphSettingsTab('settings');
    }
  }, [openGraphSettingsProp, setShowGraphSettings, setGraphSettingsTab]);

  // Hook 1: Graph and Visibility Setup
  const {
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
  } = useDiagramGraph(tables, relationships, schema, subgraphConfig, hiddenSchemas, nodeTypeVisibility);

  // Path Analysis Hook
  const {
    pathMode,
    setPathMode,
    pathStart,
    pathEnd,
    setPathStart,
    setPathEnd,
    handlePathNodeClick,
    calculatedPath,
    pathDetails,
    resetPath,
    pathStrategy,
    setPathStrategy: setPathStrategyRaw,
    pathCost
  } = usePathAnalysis(graph, relationships, pathOptions);
  const setPathStrategy = (s: PathStrategy) => setPathStrategyRaw(s);

  // Stats Hook
  const handleStatsChange = useCallback((stats: GraphStats | null) => {
    setLocalStats(stats);
    onStatsChange?.(stats);
  }, [onStatsChange]);

  useDiagramStats({
    focusTable: subgraphConfig?.focusTable,
    onStatsChange: handleStatsChange,
    graph,
    riskMap,
    filteredTables: renderGraph.tables,
    filteredRelationships: renderGraph.relationships,
    filteredViews: renderGraph.views,
    filteredMatViews: renderGraph.matViews,
    depthCounts: currentSubgraph?.stats.depthCounts
  });

  // Export Hook
  const { exportImage, exportSchema } = useDiagramExport(schema, reactFlowWrapper);

  // Resona AI Nodes (Table / Group / Global) — declared before useLayoutEngine
  // so that openTableAI / openGroupAI callbacks can be passed into layout options.
  // Uses ref-forwarding since DiagramCanvas is NOT inside <ReactFlow> / zustand provider.
  const { openTableAI, openGroupAI, openGlobalAI, wire: wireResona } = useResonaNodes({
    connectionId: linkedConnectionId || fileConnectionId,
    projectId: projectId || undefined,
    schema,
    onApplySQL,
    onNodeOpen: (position, size) => {
      const w = size?.w ?? 340;
      const h = size?.h ?? 360;
      viewportRef.current?.setCenter(
        position.x + w / 2,
        position.y + h / 2,
        { zoom: 1.1, duration: 400 }
      );
    },
  });

  // Engine Layout
  const { nodes: layoutedNodes, edges: layoutedEdges, isLayouting } = useLayoutEngine(
    layoutRenderGraph.renderGraph,
    {
      direction: layoutDirection,
      onSubgraph,
      onTableAI: openTableAI,
      onGroupAI: (schema: string) => {
        const stats = renderGraph.tables.filter(t => (t.schema || 'public') === schema).length;
        openGroupAI(schema, stats);
      },
      riskMap,
      highlightedPath: calculatedPath || (pathStart ? [pathStart] : undefined),
      isGlowing,
      graph,
      enumNames,
      viewMode,
      groupBySchema,
      lockGroups,
      activeSubgraphIds,
    }
  );

  const schemaId = (schema as any)?.id ?? 'default';

  // Hook 2: Nodes, Edges, Visibility and Search Logic
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChangeWrapper,
    onEdgesChange,
    renderedNodes,
    renderedEdges,
    resetLayout,
    resetCount,
  } = useDiagramNodes(layoutedNodes, layoutedEdges, schemaId, visibleNodeIds, visibleEdgeIds, searchQuery);

  // Wire Resona refs to the real state setters now that useDiagramNodes has run
  wireResona(setNodes, setEdges, nodes);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type === 'viewNode' || node.type === 'matViewNode') return;
    if (node.type?.startsWith('resona')) return; // AI nodes don't open subgraph panels
    if (onTableClick) onTableClick(node.id);
  }, [onTableClick]);

  const handleNodeSelect = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type?.startsWith('resona')) return;
    if (pathMode) {
      handlePathNodeClick(node.id);
      return;
    }
    if (onTableSelect) onTableSelect(node.id);
  }, [onTableSelect, pathMode, handlePathNodeClick]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      reactFlowWrapper.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, [setIsFullscreen]);

  return (
    <div ref={reactFlowWrapper} className="flex-1 flex flex-col bg-background">
      {/* Toolbar */}
      {mode === 'default' && (
        <DiagramToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          user={user}
          layoutDirection={layoutDirection}
          updateLayout={setLayoutDirection}
          signInWithGoogle={signInWithGoogle}
          isLoggingIn={isLoggingIn}
          onOpenGlobalAI={openGlobalAI}
          schema={schema}
          pathMode={pathMode}
          setPathMode={setPathMode}
          toggleFullscreen={toggleFullscreen}
          exportImage={exportImage}
          exportSchema={exportSchema}
          containerRef={reactFlowWrapper}
        />
      )}

      {/* Subgraph Banner */}
      <SubgraphBanner
        isSubgraphActive={isSubgraphActive}
        subgraphConfig={subgraphConfig}
        renderGraph={renderGraph}
        hiddenTableCount={hiddenTableCount}
        onSubgraphConfigChange={onSubgraphConfigChange}
        onTableSelect={onTableSelect}
      />

      {/* React Flow Canvas or Empty State */}
      {tables.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <LayoutGrid className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No tables to display</p>
            <p className="text-sm">Enter SQL and click "Generate Diagram"</p>
          </div>
        </div>
      ) : (
        <DiagramFlow
          nodes={renderedNodes}
          edges={renderedEdges}
          onNodesChange={onNodesChangeWrapper}
          onEdgesChange={onEdgesChange}
          onNodeSelect={handleNodeSelect}
          onNodeClick={handleNodeClick}
          isLayouting={isLayouting}
          isGlowing={isGlowing}
          setIsGlowing={setIsGlowing}
          isSubgraphActive={isSubgraphActive}
          subgraphConfig={subgraphConfig}
          activeSubgraphIds={activeSubgraphIds}
          searchQuery={searchQuery}
          pathMode={pathMode}
          pathStart={pathStart}
          pathEnd={pathEnd}
          pathDetails={pathDetails}
          pathStrategy={pathStrategy}
          setPathStrategy={setPathStrategy}
          pathCost={pathCost}
          tables={tables}
          setPathStart={setPathStart}
          setPathEnd={setPathEnd}
          resetPath={resetPath}
          pathOptions={pathOptions}
          setPathOptions={setPathOptions}
          onResetLayout={resetLayout}
          resetCount={resetCount}
        />
      )}

      {/* Floating Panels (Extracted) */}
      <DiagramModals
        editingTable={editingTable}
        allTables={tables}
        onEditChange={onEditChange}
        onEditClose={onEditClose}
        showGraphSettings={showGraphSettings}
        subgraphConfig={subgraphConfig}
        onSubgraphConfigChange={onSubgraphConfigChange}
        localStats={localStats}
        graphSettingsTab={graphSettingsTab}
        graph={graph}
        onGraphSettingsClosed={onGraphSettingsClosed}
        setShowGraphSettings={setShowGraphSettings}
        showTerminal={showTerminal}
        setShowTerminal={setShowTerminal}
        linkedConnectionId={linkedConnectionId}
        linkedConnection={linkedConnection}
        fileName={fileName}
        onApplySQL={onApplySQL}
      />

      {/* Status Bar */}
      {mode === 'default' && (
        <DiagramFooter
          tableCount={tables.length > 0 ? renderedNodes.filter(n => n.type === 'tableNode').length : 0}
          viewCount={tables.length > 0 ? renderedNodes.filter(n => n.type === 'viewNode' || n.type === 'matViewNode').length : 0}
          edgeCount={tables.length > 0 ? renderedEdges.length : 0}
          linkedConnection={linkedConnection}
          containerRef={reactFlowWrapper}
          schemas={[...new Set(tables.map(t => t.schema || 'public'))]}
        />
      )}
    </div>
  );
});
