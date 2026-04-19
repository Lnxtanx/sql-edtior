import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNodesState, useEdgesState, Node, Edge } from '@xyflow/react';
import { useDiagramPositionsStore } from '../../store/diagramPositions';
import { Column } from '@/lib/sql-parser';

export function useDiagramNodes(
    layoutedNodes: Node[],
    layoutedEdges: Edge[],
    schemaId: string,
    visibleNodeIds: Set<string>,
    visibleEdgeIds: Set<string>,
    searchQuery: string
) {
    const [nodes, setNodes, onNodesChangeReactFlow] = useNodesState(layoutedNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);
    const [resetCount, setResetCount] = useState(0);

    const { setPosition, getPositions, setElkPositions, resetPositions } = useDiagramPositionsStore();

    const getPositionsRef = useRef(getPositions);
    useEffect(() => {
        getPositionsRef.current = getPositions;
    }, [getPositions]);

    const onAutoFit = useCallback((schema: string) => {
        const groupId = `group_${schema}`;
        setNodes(nds => {
            const children = nds.filter(n => n.parentId === groupId);
            if (children.length === 0) return nds;

            let minX = Infinity, minY = Infinity, maxY = -Infinity, maxX = -Infinity;
            children.forEach(child => {
                const w = (child.style?.width as number) || child.measured?.width || 250;
                const h = (child.style?.height as number) || child.measured?.height || 100;
                minX = Math.min(minX, child.position.x);
                minY = Math.min(minY, child.position.y);
                maxX = Math.max(maxX, child.position.x + w);
                maxY = Math.max(maxY, child.position.y + h);
            });

            const GROUP_PADDING_H = 40;
            const GROUP_PADDING_B = 40;
            const GROUP_HEADER_H = 60;

            const newWidth = Math.max(300, (maxX - Math.min(0, minX)) + GROUP_PADDING_H);
            const newHeight = Math.max(300, (maxY - Math.min(0, minY)) + GROUP_PADDING_B + GROUP_HEADER_H);

            return nds.map(n => n.id === groupId ? { ...n, style: { ...n.style, width: newWidth, height: newHeight } } : n);
        });
    }, [setNodes]);

    const onResizeGroup = useCallback((schema: string, width: number, height: number) => {
        const groupId = `group_${schema}`;
        setNodes(nds => nds.map(n => n.id === groupId ? { ...n, style: { ...n.style, width, height } } : n));
    }, [setNodes]);

    // Store ELK positions when layout completes (for restoring hidden nodes)
    useEffect(() => {
        if (layoutedNodes.length > 0) {
            const elkPos: Record<string, { x: number; y: number }> = {};
            for (const node of layoutedNodes) {
                elkPos[node.id] = node.position;
            }
            setElkPositions(schemaId, elkPos);
        }
    }, [layoutedNodes, schemaId, setElkPositions]);

    // Wrap onNodesChange to detect when a user finishes dragging a node and save it to the store
    const onNodesChangeWrapper = useCallback((changes: any) => {
        onNodesChangeReactFlow(changes);

        changes.forEach((change: any) => {
            // We only want to save the position when the drag finishes (dragging === false)
            if (change.type === 'position' && change.dragging === false && change.position) {
                setPosition(schemaId, change.id, change.position);
            }
        });
    }, [onNodesChangeReactFlow, setPosition, schemaId]);

    // Reset Layout: purge user-dragged positions for this schema and snap back to the
    // raw ELK output. This frees the position memory without a full page reload.
    // Incrementing resetCount signals DiagramFlow to call fitView so the reset is visible.
    const resetLayout = useCallback(() => {
        resetPositions(schemaId);
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setResetCount(c => c + 1);
    }, [resetPositions, schemaId, layoutedNodes, layoutedEdges, setNodes, setEdges]);

    // Helper: check if a node is a dynamically-spawned Resona AI node
    const isResonaNode = (n: Node) =>
        n.type === 'resonaTableNode' || n.type === 'resonaGroupNode' || n.type === 'resonaGlobalNode';

    // Apply layouted elements when they change, preserving node identities to allow CSS transitions.
    // Resona AI nodes are dynamically injected (not part of ELK layout), so they must be preserved
    // across layout updates by separating them before comparison and appending them after.
    useEffect(() => {
        setNodes((prevNodes) => {
            const resonaNodes = prevNodes.filter(isResonaNode);
            const prevLayoutNodes = prevNodes.filter(n => !isResonaNode(n));

            let merged: Node[];
            if (prevLayoutNodes.length === 0 || layoutedNodes.length !== prevLayoutNodes.length) {
                merged = layoutedNodes.map(n => n.type === 'groupNode' ? { ...n, data: { ...n.data, onAutoFit, onResize: onResizeGroup } } : n);
            } else {
                const prevMap = new Map(prevLayoutNodes.map(n => [n.id, n]));
                const userPositions = getPositionsRef.current(schemaId);

                merged = layoutedNodes.map(newNode => {
                    const prevNode = prevMap.get(newNode.id);
                    if (!prevNode) return newNode.type === 'groupNode' ? { ...newNode, data: { ...newNode.data, onAutoFit, onResize: onResizeGroup } } : newNode;

                    // Priority: User Dragged Position > ELK Position
                    const finalPosition = userPositions[newNode.id] || newNode.position;

                    const finalStyle = newNode.type === 'groupNode'
                        ? { ...newNode.style, width: prevNode.style?.width ?? newNode.style?.width, height: prevNode.style?.height ?? newNode.style?.height }
                        : newNode.style;

                    const finalData = newNode.type === 'groupNode'
                        ? { ...newNode.data, onAutoFit, onResize: onResizeGroup }
                        : newNode.data;

                    return {
                        ...prevNode,
                        position: finalPosition,
                        style: finalStyle,
                        data: finalData,
                    };
                });
            }

            return [...merged, ...resonaNodes];
        });
        setEdges((prevEdges) => {
            const resonaEdges = prevEdges.filter(e => e.type === 'resonaEdge');
            return [...layoutedEdges, ...resonaEdges];
        });
    }, [layoutedNodes, layoutedEdges, setNodes, setEdges, schemaId, onAutoFit, onResizeGroup]);

    // Apply visibility filtering AFTER layout computation
    // Always pass through: AI nodes, group container nodes (groupNode type).
    // Group containers are synthetic layout nodes — they have no entry in visibleNodeIds
    // because that set only tracks real schema objects (tables, views, etc.).
    // Removing a group node while its children still reference it as `parentId`
    // triggers React Flow's "Parent node not found" crash.
    const visibleNodes = useMemo(() => {
        return nodes.filter(node => {
            if (node.type === 'resonaTableNode' || node.type === 'resonaGroupNode' || node.type === 'resonaGlobalNode') return true;
            if (node.type === 'groupNode') return true; // always keep group containers
            return visibleNodeIds.has(node.id);
        });
    }, [nodes, visibleNodeIds]);

    // Guarantee parent group nodes appear before their children.
    // React Flow requires this ordering in the nodes array — if a child node
    // appears before its parent, ReactFlow throws a runtime warning and the
    // ResizeObserver crashes trying to read dimensions of the missing parent.
    const orderedVisibleNodes = useMemo(() => {
        const groupNodes = visibleNodes.filter(n => n.type === 'groupNode');
        const childNodes = visibleNodes.filter(n => n.type !== 'groupNode');
        return [...groupNodes, ...childNodes];
    }, [visibleNodes]);

    // Filter nodes based on search (but keep AI nodes visible)
    const renderedNodes: Node[] = useMemo(() => {
        if (!searchQuery) return orderedVisibleNodes;

        return orderedVisibleNodes.map((node) => {
            // Always show AI nodes and group containers undimmed
            if (node.type === 'groupNode'
                || node.type === 'resonaTableNode' || node.type === 'resonaGroupNode' || node.type === 'resonaGlobalNode') {
                return node;
            }
            const label = node.data.label as string;
            const columns = node.data.columns as Column[];

            const q = searchQuery.toLowerCase();
            const isMatched = label?.toLowerCase().includes(q) ||
                columns?.some((col) => col.name.toLowerCase().includes(q));

            if (!isMatched) {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        isSearchDimmed: true,
                    },
                    style: {
                        ...node.style,
                        opacity: 0.15,
                        filter: 'grayscale(100%) blur(1px)',
                        pointerEvents: 'none' as any,
                    }
                };
            }
            return node;
        });
    }, [orderedVisibleNodes, searchQuery]);

    // Filter edges based on visibility, then apply search dimming
    const renderedEdges: Edge[] = useMemo(() => {
        // First filter by visibility
        const filteredByVisibility = edges.filter(edge => edge.type === 'resonaEdge' || visibleEdgeIds.has(edge.id));

        if (!searchQuery) return filteredByVisibility;

        const matchedNodeIds = new Set(
            renderedNodes.filter(n => !n.data?.isSearchDimmed).map(n => n.id)
        );

        return filteredByVisibility.map((edge) => {
            // Preserve animated and className from the original edge calculated by ELK
            if (!matchedNodeIds.has(edge.source) || !matchedNodeIds.has(edge.target)) {
                return {
                    ...edge,
                    style: {
                        ...edge.style,
                        opacity: 0.05,
                    }
                };
            }
            return edge;
        });
    }, [edges, visibleEdgeIds, renderedNodes, searchQuery]);

    return {
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
    };
}
