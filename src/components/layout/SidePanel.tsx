import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface SidePanelProps {
    isVisible: boolean;
    children: React.ReactNode;
    defaultWidth?: number;
    minWidth?: number;
    maxWidth?: number;
    onWidthChange?: (width: number) => void;
    headerHeight?: string;
    title?: React.ReactNode;
    fullScreen?: boolean;
}

export function SidePanel({
    isVisible,
    children,
    defaultWidth = 350,
    minWidth = 200,
    maxWidth = 800,
    onWidthChange,
    title,
    header,
    footer,
    fullScreen = false,
}: SidePanelProps & { header?: React.ReactNode; footer?: React.ReactNode }) {
    const [width, setWidth] = useState(defaultWidth);
    const [isResizing, setIsResizing] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const startResizing = (mouseDownEvent: React.MouseEvent) => {
        setIsResizing(true);
        mouseDownEvent.preventDefault();
    };

    const stopResizing = () => {
        setIsResizing(false);
    };

    const resize = (mouseMoveEvent: MouseEvent) => {
        if (isResizing) {
            const panelLeft = sidebarRef.current?.getBoundingClientRect().left || 48;
            let newWidth = mouseMoveEvent.clientX - panelLeft;

            if (newWidth < minWidth) newWidth = minWidth;
            if (newWidth > maxWidth) newWidth = maxWidth;

            setWidth(newWidth);
            onWidthChange?.(newWidth);
        }
    };

    useEffect(() => {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
        };
    }, [isResizing]);

    if (!isVisible) return null;

    return (
        <div
            ref={sidebarRef}
            className={cn(
                "flex flex-col border-r bg-background transition-all duration-200 ease-in-out",
                !fullScreen && "relative",
                fullScreen ? "fixed inset-0 z-40 w-screen h-screen bg-background" : ""
            )}
            style={{
                width: fullScreen ? '100vw' : width,
                height: fullScreen ? '100vh' : 'auto',
                position: fullScreen ? 'fixed' : 'relative',
                zIndex: fullScreen ? 40 : undefined
            }}
        >
            {/* Header */}
            {header ? (
                <div className="flex-shrink-0">
                    {header}
                </div>
            ) : title ? (
                <div className="h-9 min-h-[36px] flex items-center px-4 border-b bg-muted/10 text-xs font-medium text-muted-foreground uppercase tracking-wider select-none">
                    {title}
                </div>
            ) : null}

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col relative">
                {children}
            </div>

            {/* Footer */}
            {footer && (
                <div className="flex-shrink-0 border-t bg-background">
                    {footer}
                </div>
            )}

            {/* Resize Handle (Right) */}
            {!fullScreen && (
                <div
                    className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 z-10 transition-colors"
                    onMouseDown={startResizing}
                />
            )}
        </div>
    );
}

interface SplitViewProps {
    primary: React.ReactNode;
    secondary: React.ReactNode;
    defaultSplit?: number; // percentage 0-100
    visible: boolean;
}

export function SidePanelSplit({
    primary,
    secondary,
    defaultSplit = 50,
    visible
}: SplitViewProps) {
    const [split, setSplit] = useState(defaultSplit);
    const [isResizing, setIsResizing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const startResizing = (e: React.MouseEvent) => {
        setIsResizing(true);
        e.preventDefault();
    };

    useEffect(() => {
        const resize = (e: MouseEvent) => {
            if (!isResizing || !containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            // X-axis based split (Width)
            const offsetX = e.clientX - rect.left;
            const newSplit = (offsetX / rect.width) * 100;

            // Each pane needs at least 240px to be usable
            // Calculate minimum split percentage based on container width
            const containerWidth = rect.width;
            const minPx = 240;
            const minPercent = containerWidth > 0 ? (minPx / containerWidth) * 100 : 25;
            const clampedMin = Math.min(minPercent, 40); // Never force more than 40%
            setSplit(Math.min(Math.max(newSplit, clampedMin), 100 - clampedMin));
        };

        const stopResizing = () => setIsResizing(false);

        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [isResizing]);

    if (!visible) return <>{primary}</>;

    return (
        <div ref={containerRef} className="flex flex-row h-full w-full overflow-hidden">
            <div style={{ width: `${split}%` }} className="relative min-w-0 overflow-hidden">
                {primary}
            </div>

            {/* Split Handle */}
            <div
                className="w-1 bg-border hover:bg-primary/50 cursor-col-resize z-10 flex-shrink-0 transition-colors"
                onMouseDown={startResizing}
            />

            <div className="flex-1 min-w-0 overflow-hidden">
                {secondary}
            </div>
        </div>
    );
}
