import { useState, useEffect, useRef } from 'react';

export function usePanelResize(initialWidth = 680, initialHeight = 520) {
    const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !panelRef.current) return;

            const rect = panelRef.current.getBoundingClientRect();
            const newWidth = e.clientX - rect.left;
            const newHeight = e.clientY - rect.top;

            setSize({
                width: Math.max(400, Math.min(newWidth, 1200)),
                height: Math.max(300, Math.min(newHeight, 900))
            });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = 'default';
        };

        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'nwse-resize';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    return {
        size,
        isResizing,
        setIsResizing,
        panelRef
    };
}
