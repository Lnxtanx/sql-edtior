/**
 * core/DiagramControllers.tsx
 *
 * Internal React Flow controller components that manage viewport behavior.
 * Extracted from DiagramCanvas.tsx to keep the main canvas component focused.
 */
import { useCallback, useRef, useEffect } from 'react';
import { useReactFlow, useStore, Node } from '@xyflow/react';

// ---------------------------------------------------------------------------
// AutoFitController
// Fits the viewport to the entire subgraph OR smoothly pans to a specific node.
// ---------------------------------------------------------------------------
export function AutoFitController({
    isSubgraphActive,
    focusTable,
    activeSubgraphNodes,
}: {
    isSubgraphActive: boolean;
    focusTable?: string | null;
    activeSubgraphNodes?: Node[];
}) {
    const { fitView, fitBounds } = useReactFlow();
    // Bug 1.6 fix: useRef instead of useState to avoid re-render on each comparison
    const prevFocus = useRef<string | null | undefined>(null);

    const nodeCount = useStore(s => s.nodeLookup.size);

    useEffect(() => {
        if (nodeCount === 0) return;

        if (isSubgraphActive && focusTable && focusTable !== prevFocus.current) {
            prevFocus.current = focusTable;
            if (activeSubgraphNodes && activeSubgraphNodes.length > 0) {
                // Pan to all subgraph nodes
                fitView({
                    nodes: activeSubgraphNodes,
                    duration: 500,
                    padding: 0.15,
                    maxZoom: 1.2,
                });
            }
        } else if (!isSubgraphActive && prevFocus.current !== null) {
            prevFocus.current = null;
            // Zoom to fit all nodes when subgraph is cleared
            fitView({ duration: 400, padding: 0.1 });
        }
    }, [isSubgraphActive, focusTable, nodeCount, fitView, fitBounds, activeSubgraphNodes]);

    return null;
}

// ---------------------------------------------------------------------------
// SearchFitController
// Fits the viewport to matched search results.
// ---------------------------------------------------------------------------
export function SearchFitController({
    searchQuery,
    matchedNodes,
}: {
    searchQuery?: string;
    matchedNodes: Node[];
}) {
    const { fitView } = useReactFlow();
    const prevQuery = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (searchQuery && searchQuery !== prevQuery.current && matchedNodes.length > 0) {
            fitView({
                nodes: matchedNodes,
                duration: 400,
                padding: 0.2,
                maxZoom: 1.5,
            });
        }
        prevQuery.current = searchQuery;
    }, [searchQuery, matchedNodes, fitView]);

    return null;
}
