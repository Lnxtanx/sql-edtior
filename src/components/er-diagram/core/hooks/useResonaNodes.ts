/**
 * useResonaNodes
 *
 * Manages the lifecycle of Resona AI nodes on the diagram canvas.
 * Handles spawning, positioning, and removing AI nodes + their connection edges.
 *
 * - Table AI: spawns next to the table, connected via a resonaEdge
 * - Group AI: spawns next to the group header, connected via a resonaEdge
 * - Global AI: spawns at a fixed canvas position, no edge
 */

import { useCallback, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import type { ParsedSchema } from '@/lib/sql-parser';

type SetNodes = React.Dispatch<React.SetStateAction<Node[]>>;
type SetEdges = React.Dispatch<React.SetStateAction<Edge[]>>;
type GetNode = (id: string) => Node | undefined;

/** AI context passed to every Resona node */
export interface ResonaAIContext {
    connectionId?: string | null;
    projectId?: string | null;
    schema?: ParsedSchema | null;
    onApplySQL?: (sql: string) => void;
    /** Called when a Resona node opens — should pan/zoom the viewport to show it */
    onNodeOpen?: (position: { x: number; y: number }, size?: { w: number; h: number }) => void;
}

/** Offset from the source node where the AI node appears */
const TABLE_OFFSET_X = 340;
const TABLE_OFFSET_Y = 0;
const GROUP_OFFSET_X = 360;
const GROUP_OFFSET_Y = -40;
const GLOBAL_POSITION = { x: 80, y: 80 };

/**
 * Because DiagramCanvas is NOT inside <ReactFlow>, we can't call useReactFlow().
 * Instead, we use refs that get wired to the real setNodes/setEdges/getNode after
 * useDiagramNodes has run. The callbacks returned here are stable from the first
 * render, so they can safely be passed into useLayoutEngine options above.
 */
export function useResonaNodes(aiContext?: ResonaAIContext) {
    const setNodesRef = useRef<SetNodes>(() => {});
    const setEdgesRef = useRef<SetEdges>(() => {});
    const getNodeRef = useRef<GetNode>(() => undefined);
    const activeResona = useRef<Set<string>>(new Set());

    /** Call this after useDiagramNodes to wire the real state setters */
    const wire = useCallback((setNodes: SetNodes, setEdges: SetEdges, nodes: Node[]) => {
        setNodesRef.current = setNodes;
        setEdgesRef.current = setEdges;
        getNodeRef.current = (id: string) => nodes.find(n => n.id === id);
    }, []);

    // ── Close helpers ───────────────────────────────────────────────
    const removeResonaNode = useCallback((nodeId: string) => {
        activeResona.current.delete(nodeId);
        setNodesRef.current((nds) => nds.filter((n) => n.id !== nodeId));
        setEdgesRef.current((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    }, []);

    // ── Table AI ────────────────────────────────────────────────────
    const openTableAI = useCallback((tableNodeId: string) => {
        const resonaId = `resona-table-${tableNodeId}`;

        // Toggle off if already open
        if (activeResona.current.has(resonaId)) {
            removeResonaNode(resonaId);
            return;
        }

        // Position relative to the table node
        const sourceNode = getNodeRef.current(tableNodeId);
        const pos = sourceNode
            ? { x: sourceNode.position.x + TABLE_OFFSET_X, y: sourceNode.position.y + TABLE_OFFSET_Y }
            : { x: 400, y: 200 };

        // Extract table name from node id (e.g. "public.users" → "users", plain "users" → "users")
        const tableName = tableNodeId.includes('.') ? tableNodeId.split('.').pop()! : tableNodeId;
        const schema = tableNodeId.includes('.') ? tableNodeId.split('.')[0] : undefined;

        const resonaNode: Node = {
            id: resonaId,
            type: 'resonaTableNode',
            position: pos,
            data: {
                tableName,
                schema,
                onClose: () => removeResonaNode(resonaId),
                connectionId: aiContext?.connectionId,
                projectId: aiContext?.projectId,
                apiSchema: aiContext?.schema,
                onApplySQL: aiContext?.onApplySQL,
            },
            draggable: true,
            selectable: true,
        };

        const resonaEdge: Edge = {
            id: `edge-resona-${tableNodeId}`,
            source: tableNodeId,
            sourceHandle: 'default-source',
            target: resonaId,
            targetHandle: 'resona-target',
            type: 'resonaEdge',
            data: { scope: 'table' },
        };

        activeResona.current.add(resonaId);
        setNodesRef.current((nds) => [...nds, resonaNode]);
        setEdgesRef.current((eds) => [...eds, resonaEdge]);
    }, [removeResonaNode]);

    // ── Group AI ────────────────────────────────────────────────────
    const openGroupAI = useCallback((schemaName: string, tableCount?: number) => {
        const groupNodeId = `group_${schemaName}`;
        const resonaId = `resona-group-${schemaName}`;

        if (activeResona.current.has(resonaId)) {
            removeResonaNode(resonaId);
            return;
        }

        const sourceNode = getNodeRef.current(groupNodeId);
        const pos = sourceNode
            ? { x: sourceNode.position.x + (sourceNode.measured?.width ?? 300) + GROUP_OFFSET_X, y: sourceNode.position.y + GROUP_OFFSET_Y }
            : { x: 500, y: 100 };

        const resonaNode: Node = {
            id: resonaId,
            type: 'resonaGroupNode',
            position: pos,
            data: {
                schemaName,
                tableCount,
                onClose: () => removeResonaNode(resonaId),
                connectionId: aiContext?.connectionId,
                projectId: aiContext?.projectId,
                apiSchema: aiContext?.schema,
                onApplySQL: aiContext?.onApplySQL,
            },
            draggable: true,
            selectable: true,
        };

        const resonaEdge: Edge = {
            id: `edge-resona-group-${schemaName}`,
            source: groupNodeId,
            sourceHandle: 'resona-source',
            target: resonaId,
            targetHandle: 'resona-target',
            type: 'resonaEdge',
            data: { scope: 'group' },
        };

        activeResona.current.add(resonaId);
        setNodesRef.current((nds) => [...nds, resonaNode]);
        setEdgesRef.current((eds) => [...eds, resonaEdge]);
    }, [removeResonaNode]);

    // ── Global AI ───────────────────────────────────────────────────
    const openGlobalAI = useCallback(() => {
        const resonaId = 'resona-global';

        if (activeResona.current.has(resonaId)) {
            removeResonaNode(resonaId);
            return;
        }

        const resonaNode: Node = {
            id: resonaId,
            type: 'resonaGlobalNode',
            position: { ...GLOBAL_POSITION },
            data: {
                onClose: () => removeResonaNode(resonaId),
                connectionId: aiContext?.connectionId,
                projectId: aiContext?.projectId,
                schema: aiContext?.schema,
                onApplySQL: aiContext?.onApplySQL,
            },
            draggable: true,
            selectable: true,
        };

        activeResona.current.add(resonaId);
        setNodesRef.current((nds) => [...nds, resonaNode]);

        // Pan/zoom viewport to show the newly opened node
        aiContext?.onNodeOpen?.(
            GLOBAL_POSITION,
            { w: 340, h: 360 } // default node size
        );

        // No edge for global
    }, [removeResonaNode, aiContext]);

    return {
        openTableAI,
        openGroupAI,
        openGlobalAI,
        /** Call after useDiagramNodes to wire the real state setters */
        wire,
    };
}
