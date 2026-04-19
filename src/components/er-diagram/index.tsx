import React, { memo } from 'react';
import { DiagramProvider } from './core/DiagramProvider';
import DiagramCanvasInner from './core/DiagramCanvas';

// We need to pass through all the props that DiagramCanvas expects
type DiagramCanvasProps = React.ComponentProps<typeof DiagramCanvasInner>;

const DiagramCanvas = memo((props: DiagramCanvasProps) => {
    return (
        <DiagramProvider>
        <DiagramCanvasInner { ...props } />
        </DiagramProvider>
    );
});

export default DiagramCanvas;
