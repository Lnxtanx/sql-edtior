/**
 * ResonaEdge
 *
 * Dashed, animated edge connecting a table/group node to its Resona AI node.
 * Uses a smooth step path with a subtle glow effect.
 */

import { BaseEdge, EdgeProps, getSmoothStepPath, EdgeLabelRenderer } from '@xyflow/react';
import { cn } from '@/lib/utils';

export default function ResonaEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    data,
}: EdgeProps) {
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 16,
    });

    const scope = (data as any)?.scope ?? 'table';

    const scopeColor: Record<string, string> = {
        table: '#3b82f6',   // blue-500
        group: '#8b5cf6',   // violet-500
    };

    const color = scopeColor[scope] || scopeColor.table;

    return (
        <g>
            <BaseEdge
                path={edgePath}
                id={id}
                style={{
                    ...style,
                    stroke: color,
                    strokeWidth: 2,
                    strokeOpacity: 0.8,
                }}
                className="react-flow__edge-path animated-edge"
            />
            {/* Label */}
            <EdgeLabelRenderer>
                <div
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                        fontSize: 9,
                        fontWeight: 600,
                        color,
                        backgroundColor: 'rgba(255,255,255,0.92)',
                        padding: '1px 5px',
                        borderRadius: 6,
                        border: `1px solid ${color}33`,
                        pointerEvents: 'none',
                    }}
                    className="nodrag nopan"
                >
                    Resona AI
                </div>
            </EdgeLabelRenderer>
        </g>
    );
}
