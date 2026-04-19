import React from 'react';
import {
    BaseEdge,
    EdgeLabelRenderer,
    EdgeProps,
    getSmoothStepPath,
} from '@xyflow/react';

export default function RelationshipEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    markerStart,
    data,
    animated,
    className,
}: EdgeProps & { className?: string; animated?: boolean }) {
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const {
        label,
        isView,
        isTrigger,
        isDimmed,
        confidence = 1,
    } = (data || {}) as any;

    return (
        <g className={className}>
            <BaseEdge
                path={edgePath}
                markerEnd={markerEnd}
                markerStart={markerStart}
                style={style}
                id={id}
                className={animated ? 'react-flow__edge-path animated-edge' : 'react-flow__edge-path'}
            />
            {label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                            fontSize: 10,
                            color: isView ? '#d97706' : (isTrigger ? '#dc2626' : '#475569'),
                            fontWeight: 600,
                            fontFamily: 'Inter, system-ui, sans-serif',
                            opacity: isDimmed ? 0.2 : (confidence < 0.8 ? 0.8 : 1),
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            padding: '2px 4px',
                            borderRadius: 4,
                            pointerEvents: 'none', // Allow clicking through the label
                        }}
                        className="nodrag nopan"
                    >
                        {label}
                    </div>
                </EdgeLabelRenderer>
            )}
        </g>
    );
}
