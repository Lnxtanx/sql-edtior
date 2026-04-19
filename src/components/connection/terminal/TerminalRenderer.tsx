// =============================================================================
// TerminalRenderer
// Renders terminal lines and an inline prompt that feels like a real CLI.
// No separate fixed input box — the prompt IS the last line.
// Always fills its parent container (flex-1).
// =============================================================================

import { useRef, useEffect, useCallback, memo } from 'react';
import { Terminal, X, FileCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TerminalLine, TerminalHandle } from './types';

// ─── Props ───────────────────────────────────────────────────────────────────

interface TerminalRendererProps {
    terminal: TerminalHandle;
    onClose: () => void;
    connectionName?: string;
    fileName?: string;
    hideHeader?: boolean;
}

// ─── Line color map ──────────────────────────────────────────────────────────

const LINE_STYLES: Record<TerminalLine['type'], string> = {
    prompt: 'text-blue-500 dark:text-blue-400',
    output: 'text-foreground',
    info: 'text-muted-foreground',
    success: 'text-emerald-600 dark:text-emerald-400',
    error: 'text-red-500 dark:text-red-400',
    system: 'text-muted-foreground/70 italic',
};

// ─── Memoized line ───────────────────────────────────────────────────────────

const TerminalLineRow = memo(function TerminalLineRow({
    line,
}: {
    line: TerminalLine;
}) {
    return (
        <div className={cn('whitespace-pre-wrap break-all', LINE_STYLES[line.type])}>
            {line.content}
        </div>
    );
});

// ─── Component ───────────────────────────────────────────────────────────────

export function TerminalRenderer({
    terminal,
    onClose,
    connectionName,
    fileName,
    hideHeader = false,
}: TerminalRendererProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll when lines change or input changes
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [terminal.lines, terminal.inputValue]);

    // Focus input on mount
    useEffect(() => {
        requestAnimationFrame(() => inputRef.current?.focus());
    }, []);

    // Click anywhere in the terminal → focus input
    const handleContainerClick = useCallback(() => {
        inputRef.current?.focus();
    }, []);

    const handleInputKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            terminal.handleKeyDown(e);
        },
        [terminal.handleKeyDown]
    );

    const handleInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            terminal.setInputValue(e.target.value);
        },
        [terminal.setInputValue]
    );

    // Build header context label
    const contextLabel = [connectionName, fileName].filter(Boolean).join(' • ');

    return (
        <div className="flex-1 min-h-0 flex flex-col border-t border-border bg-muted/80 dark:bg-muted/40">
            {/* ── Header ──────────────────────────────────────────────── */}
            {!hideHeader && (
                <div className="flex items-center justify-between px-2 h-7 min-h-[28px] border-b border-border bg-muted/60 dark:bg-muted/50">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Terminal className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex-shrink-0">
                            Terminal
                        </span>
                        {contextLabel && (
                            <>
                                <span className="text-[10px] text-muted-foreground/50">—</span>
                                <div className="flex items-center gap-1 min-w-0">
                                    <FileCode className="w-3 h-3 text-muted-foreground/70 flex-shrink-0" />
                                    <span className="text-[10px] text-muted-foreground/70 truncate">
                                        {contextLabel}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:bg-muted text-muted-foreground"
                        onClick={onClose}
                    >
                        <X className="w-3 h-3" />
                    </Button>
                </div>
            )}

            {/* ── Terminal body ────────────────────────────────────────── */}
            <div
                ref={scrollRef}
                className={cn(
                    "flex-1 overflow-auto font-mono text-xs font-medium leading-relaxed bg-background/50 dark:bg-background/30 cursor-text",
                    // Thin scrollbar (4px)
                    "[&::-webkit-scrollbar]:w-[4px]",
                    "[&::-webkit-scrollbar-track]:bg-transparent",
                    "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/20",
                    "[&::-webkit-scrollbar-thumb]:rounded-full",
                    "[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/30"
                )}
                onClick={handleContainerClick}
            >
                <div className="p-2 min-h-full flex flex-col">
                    {/* Welcome line when empty */}
                    {terminal.lines.length === 0 && (
                        <div className="text-emerald-600/60 dark:text-emerald-400/60 italic select-none">
                            # Schema Weaver CLI — Type "help" for commands
                        </div>
                    )}

                    {/* History lines */}
                    {terminal.lines.map((line) => (
                        <TerminalLineRow key={line.id} line={line} />
                    ))}

                    {/* ── Active inline prompt ────────────────────── */}
                    <div className="flex items-start mt-0">
                        <span className="text-emerald-600 dark:text-emerald-400 select-none shrink-0 whitespace-pre">
                            {terminal.promptText}
                        </span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={terminal.inputValue}
                            onChange={handleInputChange}
                            onKeyDown={handleInputKeyDown}
                            className={cn(
                                'flex-1 bg-transparent outline-none caret-emerald-500',
                                'text-foreground text-[11px] font-mono leading-5',
                                'placeholder:text-muted-foreground/40'
                            )}
                            placeholder={terminal.lines.length === 0 ? 'Type a command...' : ''}
                            autoComplete="off"
                            spellCheck={false}
                            aria-label="Terminal input"
                        />
                        {/* Blinking cursor indicator when executing */}
                        {terminal.isExecuting && (
                            <span className="text-emerald-500 animate-pulse select-none ml-1">
                                ▋
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

