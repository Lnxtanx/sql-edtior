interface LayoutingOverlayProps {
    isLayouting: boolean;
}

export function LayoutingOverlay({ isLayouting }: LayoutingOverlayProps) {
    if (!isLayouting) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-[1px] pointer-events-none">
            <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-[3px] border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-xs font-medium text-muted-foreground">Computing layout…</p>
            </div>
        </div>
    );
}
