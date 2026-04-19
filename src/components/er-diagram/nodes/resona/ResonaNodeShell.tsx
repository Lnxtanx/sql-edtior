/**
 * ResonaNodeShell
 *
 * Shared wrapper for all three Resona AI node variants (Table, Group, Global).
 * Provides consistent branding, header controls, edge-resize handles, and chat area.
 */

import { memo, useState, useRef, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { X, Minimize2, Maximize2, ChevronDown, ChevronUp, Plus, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ResonaScope = 'table' | 'group' | 'global';

export interface ResonaNodeShellProps {
    scope: ResonaScope;
    title: string;
    subtitle?: string;
    onClose: () => void;
    showHandle: boolean;
    /** CSS `background` value for the header (gradient or solid). If omitted, uses neutral card bg. */
    headerBg?: string;
    /** Optional callbacks for chat management */
    onNewChat?: () => void;
    onViewHistory?: () => void;
    children?: React.ReactNode;
}

const MIN_W = 280;
const MIN_H = 200;
const MAX_W = 800;
const MAX_H = 700;
const DEFAULT_W = 320;
const DEFAULT_H = 340;
const EXPANDED_W = 520;
const EXPANDED_H = 520;

function ResonaNodeShell({
    scope,
    title,
    subtitle,
    onClose,
    showHandle,
    headerBg,
    onNewChat,
    onViewHistory,
    children,
}: ResonaNodeShellProps) {
    const [isMinimized, setIsMinimized] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });
    const resizingRef = useRef<{ startX: number; startY: number; startW: number; startH: number; edge: string } | null>(null);

    const hasColoredHeader = !!headerBg;

    const displayW = isExpanded ? EXPANDED_W : size.w;
    const displayH = isExpanded ? EXPANDED_H : size.h;

    // ── Edge resize (bottom, right, bottom-right) ──
    const onResizeStart = useCallback((e: React.PointerEvent, edge: string) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement;
        target.setPointerCapture(e.pointerId);
        resizingRef.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h, edge };
    }, [size]);

    const onResizeMove = useCallback((e: React.PointerEvent) => {
        if (!resizingRef.current) return;
        const { startX, startY, startW, startH, edge } = resizingRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        setSize(prev => ({
            w: edge.includes('r') ? Math.max(MIN_W, Math.min(MAX_W, startW + dx)) : prev.w,
            h: edge.includes('b') ? Math.max(MIN_H, Math.min(MAX_H, startH + dy)) : prev.h,
        }));
    }, []);

    const onResizeEnd = useCallback(() => {
        resizingRef.current = null;
    }, []);

    const toggleExpand = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    return (
        <div
            className={cn(
                'bg-card/95 backdrop-blur-md border border-border/50 rounded-xl flex flex-col overflow-hidden transition-[width,height] duration-300 shadow-2xl shadow-black/10 dark:shadow-black/40',
                isMinimized && 'h-auto',
            )}
            style={{
                width: isMinimized ? 240 : displayW,
                height: isMinimized ? undefined : displayH,
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
        >
            {/* Target handle — only for table & group scopes */}
            {showHandle && (
                <Handle
                    type="target"
                    position={Position.Left}
                    id="resona-target"
                    className="!w-2 !h-2 !border-0 !bg-primary/60"
                />
            )}

            {/* Header */}
            <div
                className={cn(
                    'flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing select-none border-b',
                    hasColoredHeader
                        ? 'text-white border-white/10'
                        : 'text-foreground border-border/40 bg-muted/50',
                )}
                style={hasColoredHeader ? { background: headerBg } : undefined}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <img src="/resona.png" alt="Resona" className="w-4 h-4 flex-shrink-0 opacity-90" />
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold tracking-wide truncate leading-tight">{title}</p>
                        {subtitle && (
                            <p className={cn(
                                'text-[9px] truncate leading-tight',
                                hasColoredHeader ? 'text-white/65' : 'text-muted-foreground/70',
                            )}>{subtitle}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-0 nodrag flex-shrink-0">
                    {/* New Chat */}
                    {onNewChat && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                'h-5 w-5',
                                hasColoredHeader
                                    ? 'text-white/70 hover:text-white hover:bg-white/15'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                            )}
                            onClick={onNewChat}
                            title="New chat"
                        >
                            <Plus className="w-3 h-3" />
                        </Button>
                    )}

                    {/* History */}
                    {onViewHistory && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                'h-5 w-5',
                                hasColoredHeader
                                    ? 'text-white/70 hover:text-white hover:bg-white/15'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                            )}
                            onClick={onViewHistory}
                            title="Chat history"
                        >
                            <History className="w-3 h-3" />
                        </Button>
                    )}

                    <div className={cn("w-px h-3 mx-0.5", hasColoredHeader ? "bg-white/15" : "bg-border/50")} />

                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            'h-5 w-5',
                            hasColoredHeader
                                ? 'text-white/70 hover:text-white hover:bg-white/15'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                        )}
                        onClick={toggleExpand}
                        title={isExpanded ? 'Restore size' : 'Expand'}
                    >
                        {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            'h-5 w-5',
                            hasColoredHeader
                                ? 'text-white/70 hover:text-white hover:bg-white/15'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                        )}
                        onClick={() => setIsMinimized(!isMinimized)}
                    >
                        {isMinimized ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            'h-5 w-5',
                            hasColoredHeader
                                ? 'text-white/70 hover:text-red-300 hover:bg-white/15'
                                : 'text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20',
                        )}
                        onClick={onClose}
                    >
                        <X className="w-3 h-3" />
                    </Button>
                </div>
            </div>

            {/* Body */}
            {!isMinimized && (
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {children}

                    {/* Resize handles — right, bottom, corner */}
                    {!isExpanded && (
                        <>
                            {/* Right edge */}
                            <div
                                className="absolute top-0 right-0 w-1.5 h-full cursor-ew-resize hover:bg-primary/10 transition-colors nodrag"
                                onPointerDown={(e) => onResizeStart(e, 'r')}
                                onPointerMove={onResizeMove}
                                onPointerUp={onResizeEnd}
                            />
                            {/* Bottom edge */}
                            <div
                                className="absolute bottom-0 left-0 h-1.5 w-full cursor-ns-resize hover:bg-primary/10 transition-colors nodrag"
                                onPointerDown={(e) => onResizeStart(e, 'b')}
                                onPointerMove={onResizeMove}
                                onPointerUp={onResizeEnd}
                            />
                            {/* Corner */}
                            <div
                                className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize nodrag"
                                onPointerDown={(e) => onResizeStart(e, 'rb')}
                                onPointerMove={onResizeMove}
                                onPointerUp={onResizeEnd}
                            >
                                <svg viewBox="0 0 12 12" className="w-full h-full text-muted-foreground/30">
                                    <path d="M10 2L2 10M10 6L6 10M10 10L10 10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                                </svg>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default memo(ResonaNodeShell);
