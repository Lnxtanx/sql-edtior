import { useState, useRef, useEffect } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { X, GripHorizontal, ArrowRightLeft, Maximize2, Minimize2, Copy, Check } from 'lucide-react';
import { ConnectionCLI, ConnectionCLIHandle } from '@/components/connection';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface TerminalPanelProps {
    isOpen: boolean;
    onClose: () => void;
    connectionId: string | null;
    connectionName?: string;
    fileName?: string;
    onApplySQL?: (sql: string) => void;
}

export function TerminalPanel({
    isOpen,
    onClose,
    connectionId,
    connectionName,
    fileName,
    onApplySQL
}: TerminalPanelProps) {
    const dragControls = useDragControls();
    // Default size: 500x350
    const [size, setSize] = useState({ width: 500, height: 350 });
    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<ConnectionCLIHandle>(null);
    const { toast } = useToast();
    const [isCopied, setIsCopied] = useState(false);

    // Resize handler
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !panelRef.current) return;

            // Calculate new size based on mouse position relative to panel's top-left
            // Note: This simple approach assumes the panel doesn't move while resizing,
            // but since we drag via framer-motion transform, getBoundingClientRect helps.
            const rect = panelRef.current.getBoundingClientRect();

            const newWidth = e.clientX - rect.left;
            const newHeight = e.clientY - rect.top;

            setSize({
                width: Math.max(300, Math.min(newWidth, 1000)), // Min 300, Max 1000
                height: Math.max(200, Math.min(newHeight, 800))  // Min 200, Max 800
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

    return (
        <motion.div
            ref={panelRef}
            drag
            dragListener={false}
            dragControls={dragControls}
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.95, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{ width: size.width, height: size.height }}
            className="absolute top-20 right-20 z-50 bg-card/95 backdrop-blur border border-border/50 shadow-2xl rounded-xl flex flex-col overflow-hidden ring-1 ring-black/5 dark:ring-white/10"
        >
            {/* Header / Drag Handle */}
            <div
                className="flex items-center justify-between px-3 py-2 bg-muted/40 cursor-grab active:cursor-grabbing border-b border-border/40 select-none"
                onPointerDown={(e) => dragControls.start(e)}
            >
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <GripHorizontal className="w-4 h-4 opacity-50" />
                    <span>Terminal</span>
                    {(connectionName || fileName) && <span className="opacity-30 mx-1">|</span>}
                    {connectionName && <span className="opacity-70">{connectionName}</span>}
                    {fileName && (
                        <>
                            <span className="opacity-30 mx-1">•</span>
                            <span className="opacity-70 truncate max-w-[200px]">{fileName}</span>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 rounded hover:bg-muted text-muted-foreground"
                        onClick={() => {
                            terminalRef.current?.copyToClipboard();
                            setIsCopied(true);
                            toast({
                                title: "Copied",
                                description: "Terminal output copied to clipboard",
                            });
                            setTimeout(() => setIsCopied(false), 2000);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 rounded hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                        onClick={onClose}
                        onPointerDown={(e) => e.stopPropagation()} // Prevent drag
                    >
                        <X className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 flex flex-col relative group">
                <ConnectionCLI
                    ref={terminalRef}
                    connectionId={connectionId}
                    connectionName={connectionName}
                    fileName={fileName}
                    onClose={onClose}
                    onSchemaPulled={onApplySQL ? (s: any) => {
                        if (s?.sql) onApplySQL(s.sql);
                    } : undefined}
                    hideHeader={true}
                />

                {/* Resize Handle */}
                <div
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        setIsResizing(true);
                    }}
                >
                    <div className="w-2 h-2 border-r-2 border-b-2 border-primary/50 rounded-br-sm" />
                </div>
            </div>
        </motion.div>
    );
}
