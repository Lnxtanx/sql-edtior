/**
 * ResonaChatBodyConnected
 *
 * Compact chat body for Resona nodes on the ER diagram canvas.
 * Receives the `ai` object as a prop from the parent (same pattern as AIPanelShell).
 * NEVER calls useAIAgent itself — just renders the chat UI.
 */

import { useRef, useEffect, useCallback, useState, useMemo, memo } from 'react';
import { Send, X, Database, FileText, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UseAIAgentReturn } from '@/components/ai-panel/hooks/useAIAgent';
import { MentionAutocomplete, MentionItem } from '@/components/ai-panel/MentionAutocomplete';
import { ParsedSchema } from '@/lib/sql-parser';
import { useQuery } from '@tanstack/react-query';
import { getFiles, SqlFile } from '@/lib/file-management/api/client';

interface ResonaChatBodyConnectedProps {
    ai: UseAIAgentReturn;
    schema: ParsedSchema | null;
    projectId?: string | null;
    placeholder?: string;
    suggestions?: string[];
    tagline?: string;
    scope?: 'global' | 'table' | 'group';
    contextName?: string;
}

function ResonaChatBodyConnected({
    ai,
    schema,
    projectId,
    placeholder = 'Ask Resona...',
    suggestions,
    tagline = 'Your schema, understood.',
    scope = 'global',
    contextName,
}: ResonaChatBodyConnectedProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const chatBodyRef = useRef<HTMLDivElement>(null);

    const [mentionSearch, setMentionSearch] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);

    // Block ReactFlow zoom when wheel happens inside this chat body
    useEffect(() => {
        const el = chatBodyRef.current;
        if (!el) return;
        const blockWheel = (e: WheelEvent) => e.stopPropagation();
        el.addEventListener('wheel', blockWheel, { capture: true, passive: false });
        return () => el.removeEventListener('wheel', blockWheel, { capture: true });
    }, []);

    const autoGrow = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }, []);

    useEffect(() => {
        if (textareaRef.current && !ai.state.loading) {
            textareaRef.current.style.height = 'auto';
        }
    }, [ai.state.loading]);

    const handleSend = () => {
        if (!ai.prompt.trim()) return;
        ai.send(ai.prompt);
        ai.setPrompt('');
        setMentionSearch(null);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const handleMentionSelect = (item: MentionItem) => {
        if (!textareaRef.current) return;
        const cursor = textareaRef.current.selectionStart;
        const before = ai.prompt.substring(0, cursor);
        const lastAt = before.lastIndexOf('@');
        const after  = ai.prompt.substring(cursor);
        const next   = before.substring(0, lastAt) + `@${item.name} ` + after;
        ai.setPrompt(next);
        setMentionSearch(null);
        setTimeout(() => {
            const pos = lastAt + item.name.length + 2;
            textareaRef.current?.setSelectionRange(pos, pos);
            textareaRef.current?.focus();
            autoGrow();
        }, 0);
    };

    // Fetch project files for @mentions
    const { data: fileData } = useQuery({
        queryKey: ['projectFiles', projectId],
        queryFn: () => projectId ? getFiles(projectId) : Promise.resolve({ files: [] as SqlFile[] }),
        enabled: !!projectId,
    });

    const projectFiles: MentionItem[] = useMemo(() => 
        (fileData?.files ?? []).filter(f => !f.is_folder).map(f => ({ 
            id: f.id, 
            name: f.title, 
            type: 'file', 
            icon: FileText 
        })), 
    [fileData]);

    const projectFolders: MentionItem[] = useMemo(() => 
        (fileData?.files ?? []).filter(f => f.is_folder).map(f => ({ 
            id: f.id, 
            name: f.title, 
            type: 'folder', 
            icon: FolderOpen 
        })),
    [fileData]);

    const mentionItems = useMemo(() => {
        const items: MentionItem[] = [];
        items.push(...projectFiles);
        if (schema) {
            items.push(...schema.tables.map(t => ({ 
                id: t.name, 
                name: t.name, 
                type: 'table' as const,
                icon: Database,
                meta: `${t.columns.length} cols`
            })));
        }
        items.push(...projectFolders);
        
        if (mentionSearch === null) return [];
        if (!mentionSearch) return items.slice(0, 8);
        return items.filter(i => i.name.toLowerCase().includes(mentionSearch.toLowerCase()));
    }, [schema, projectFiles, projectFolders, mentionSearch]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (mentionSearch !== null && mentionItems.length > 0) {
            if (e.key === 'ArrowDown')  { e.preventDefault(); setMentionIndex(i => (i + 1) % mentionItems.length); return; }
            if (e.key === 'ArrowUp')    { e.preventDefault(); setMentionIndex(i => (i - 1 + mentionItems.length) % mentionItems.length); return; }
            if (e.key === 'Enter' && mentionItems[mentionIndex]) { e.preventDefault(); handleMentionSelect(mentionItems[mentionIndex]); return; }
            if (e.key === 'Escape')     { setMentionSearch(null); return; }
        }

        // Atomic deletion for @mentions
        if (e.key === 'Backspace') {
            const textarea = textareaRef.current;
            if (textarea) {
                const cursor = textarea.selectionStart;
                const value = ai.prompt;
                const before = value.substring(0, cursor);
                // Unified regex supports dots, hyphens, and slashes for files/folders
                const match = before.match(/(@[a-zA-Z0-9_\-.\/]+\s?)$/);
                
                if (match) {
                    const name = match[0].trim().substring(1);
                    const isValid = 
                        schema?.tables.some(t => t.name === name) ||
                        projectFiles.some(f => f.name === name) ||
                        projectFolders.some(f => f.name === name);

                    if (isValid) {
                        e.preventDefault();
                        const start = cursor - match[0].length;
                        const newValue = value.substring(0, start) + value.substring(cursor);
                        ai.setPrompt(newValue);
                        setTimeout(() => {
                            textarea.setSelectionRange(start, start);
                        }, 0);
                        return;
                    }
                }
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSuggestionClick = (text: string) => {
        ai.setPrompt(text);
        textareaRef.current?.focus();
    };

    const contextLabel = contextName
        ? scope === 'table' ? `Table: ${contextName}`
            : scope === 'group' ? `Schema: ${contextName}`
            : contextName
        : null;

    const hasContent = ai.state.history.length > 0 || ai.state.loading || ai.state.text || ai.state.error;
    const isStreaming = ai.state.loading || ai.state.text.length > 0;

    const renderPromptDisplay = () => {
        // Unified regex supports filenames, extensions, and paths
        const parts = ai.prompt.split(/(@[a-zA-Z0-9_\-.\/]+)/);
        return parts.map((part, i) => {
            if (part.startsWith('@')) {
                const name = part.substring(1);
                const isTable = schema?.tables.some(t => t.name === name);
                const isFile = projectFiles.some(f => f.name === name);
                const isFolder = projectFolders.some(f => f.name === name);

                if (isTable || isFile || isFolder) {
                    const bgClass = isFile
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/50 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400'
                        : isFolder
                            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-800/50 text-amber-600 dark:text-amber-400'
                            : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200/50 dark:border-blue-800/50 text-blue-600 dark:text-blue-400';
                    
                    const Icon = isFile ? FileText : isFolder ? FolderOpen : Database;

                    return (
                        <span key={i} className="relative inline-block">
                            {/* Hidden spacer ensures the rest of the text flow matches the textarea exactly */}
                            <span className="invisible select-none" aria-hidden="true">{part}</span>
                            
                            {/* Absolutely positioned pill wrapping both items */}
                            <span
                                className={cn(
                                    "absolute left-0 top-1/2 -translate-y-1/2",
                                    "flex items-center rounded-md border text-[10px] font-medium transition-colors outline-none",
                                    bgClass
                                )}
                                /* 
                                   SHIFT LEFT: 
                                   Move the entire pill to the left by the icon's width.
                                   This 'absorbs' the icon/padding space so the @ text
                                   stays exactly over the invisible spacer.
                                */
                                style={{ marginLeft: '-1.35rem', paddingLeft: '0.25rem' }}
                            >
                                <Icon className="w-2.5 h-2.5 mr-1 shrink-0" />
                                <span className="pr-1">{part}</span>
                            </span>
                        </span>
                    );
                }
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div ref={chatBodyRef} className="flex flex-col flex-1 overflow-hidden min-h-0 select-text">
            {/* Context banner */}
            {contextLabel && (
                <div className="px-2.5 py-1 border-b border-border/20 flex items-center gap-1.5 bg-muted/15 shrink-0">
                    <span className="text-[9px] text-muted-foreground/50 font-medium uppercase tracking-wider">{contextLabel}</span>
                </div>
            )}

            {/* Empty state */}
            {!hasContent && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 px-3 min-h-0">
                    <p className="text-[10px] text-muted-foreground/50 italic font-light tracking-wide">{tagline}</p>
                    {suggestions && suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-center px-2">
                            {suggestions.map((s) => (
                                <button
                                    key={s}
                                    onClick={() => handleSuggestionClick(s)}
                                    className="text-[9px] px-2 py-0.5 rounded-full bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/20 hover:border-border/50 font-medium"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Messages */}
            {hasContent && (
                <div className="flex-1 overflow-y-auto min-h-0 nodrag nopan"
                     style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(128,128,128,0.25) transparent' }}>
                    <div className="flex flex-col gap-1.5 px-3 py-2 min-w-0 max-w-full">
                        {ai.state.history.map((msg, i) => (
                        <div key={i} className={cn(
                                "w-full min-w-0 flex flex-col",
                                msg.role === 'user' ? "py-2 first:pt-0" : "py-1 first:pt-0",
                            )}>
                                {/* Execution trace */}
                                {msg.role === 'assistant' && msg.executionTrace && (
                                    <div className="w-full min-w-0 mb-1.5 px-0.5">
                                        <ExecutionTrace steps={msg.executionTrace.steps} planSteps={msg.executionTrace.planSteps} intent={msg.executionTrace.intent} />
                                    </div>
                                )}

                                {/* Message bubble */}
                                <MessageBubble message={msg} />

                                {/* Credits only */}
                                {msg.role === 'assistant' && msg.usage && msg.usage.creditsUsed > 0 && (
                                    <div className="py-1 pl-1 opacity-60">
                                        <span className="text-[8px] text-muted-foreground/50 font-medium tracking-tight">
                                            CREDITS USED: {formatCredit(msg.usage.creditsUsed)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Streaming indicator */}
                        {isStreaming && ai.state.steps.length > 0 && (
                            <div className="w-full min-w-0">
                                <ExecutionTrace steps={ai.state.steps} planSteps={ai.state.planSteps} intent={ai.state.intent} isLoading />
                            </div>
                        )}

                        {/* Streaming text */}
                        {ai.state.text && (
                            <div className="w-full min-w-0 py-1">
                                <div className="text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-words">
                                    {ai.state.text}
                                    {ai.state.loading && (
                                        <span className="inline-block w-1 h-3 bg-primary/30 ml-0.5 animate-pulse rounded-full align-middle" />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Loading dots */}
                        {ai.state.loading && ai.state.steps.length === 0 && !ai.state.text && (
                            <div className="flex items-center gap-1 px-1 py-1">
                                <span className="w-1 h-1 rounded-full bg-primary/50 animate-[pulse_1.2s_ease-in-out_infinite]" />
                                <span className="w-1 h-1 rounded-full bg-primary/30 animate-[pulse_1.2s_ease-in-out_0.2s_infinite]" />
                                <span className="w-1 h-1 rounded-full bg-primary/15 animate-[pulse_1.2s_ease-in-out_0.4s_infinite]" />
                            </div>
                        )}

                        {/* Error */}
                        {ai.state.error && (
                            <div className="flex items-start gap-1.5 text-red-500/80 bg-red-500/5 rounded-lg px-2 py-1.5">
                                <span className="text-[10px]">{ai.state.error}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Input Wrapper: Full-width square footer integrated with the chat body */}
            <div className={cn(
                "border-t border-border/10 flex flex-col gap-2 nodrag nopan bg-background/50 backdrop-blur-sm shrink-0 relative cursor-text transition-all duration-200 ring-offset-background",
                "focus-within:bg-background/80 focus-within:ring-1 focus-within:ring-primary/10",
                mentionSearch !== null ? "bg-muted/30" : "",
                ai.state.loading ? "opacity-50 pointer-events-none" : ""
            )}>
                <div className="flex items-end w-full">
                    <div className="flex-1 grid grid-cols-1 grid-rows-1 relative min-h-[44px]">
                        <textarea
                            ref={textareaRef}
                            value={ai.prompt}
                            onChange={(e) => {
                                const val = e.target.value;
                                ai.setPrompt(val);
                                autoGrow();

                                const cursor = e.target.selectionStart;
                                const before = val.substring(0, cursor);
                                const lastAt = before.lastIndexOf('@');
                                if (lastAt !== -1 && !/\s/.test(before.substring(lastAt + 1))) {
                                    setMentionSearch(before.substring(lastAt + 1).toLowerCase());
                                    setMentionIndex(0);
                                } else {
                                    setMentionSearch(null);
                                }
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            rows={1}
                            disabled={ai.state.loading}
                            className={cn(
                                "grid-area-[1/1] w-full text-[11px] bg-transparent outline-none placeholder:text-muted-foreground/30 px-3 py-3.5 resize-none leading-relaxed max-h-[140px] font-sans disabled:opacity-50 z-10 overflow-y-auto",
                                ai.prompt ? "text-transparent caret-foreground" : ""
                            )}
                            style={{ gridArea: '1 / 1' }}
                        />
                        {ai.prompt && (
                            <div
                                className="grid-area-[1/1] px-3 py-3.5 text-[11px] leading-relaxed pointer-events-none whitespace-pre-wrap break-words overflow-y-auto font-sans text-foreground/90 bg-transparent"
                                aria-hidden="true"
                                style={{ gridArea: '1 / 1' }}
                            >
                                {renderPromptDisplay()}
                            </div>
                        )}
                        <MentionAutocomplete
                            items={mentionItems}
                            mentionSearch={mentionSearch}
                            mentionIndex={mentionIndex}
                            onSelect={handleMentionSelect}
                        />
                    </div>

                    {/* Simple Action Button */}
                    <div className="flex items-center gap-1.5 px-2 pb-2">
                        <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                                "w-7 h-7 rounded-sm transition-all duration-200",
                                ai.prompt.trim() || ai.state.loading
                                    ? "text-primary opacity-100"
                                    : "text-muted-foreground opacity-20 pointer-events-none"
                            )}
                            onClick={ai.state.loading ? ai.abort : handleSend}
                            title={ai.state.loading ? "Stop" : "Send"}
                        >
                            {ai.state.loading ? <X className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Compact Message Bubble ─────────────────────────────────────────────────────

function MessageBubble({ message }: { message: { role: string; content: string; usage?: { creditsUsed: number } } }) {
    const isUser = message.role === 'user';

    return (
        <div className={cn(
            "w-full min-w-0 overflow-hidden break-words",
            isUser
                ? "bg-muted/35 py-1.5 px-2.5 rounded-lg text-foreground max-w-[90%]"
                : "text-foreground/80 py-0.5 px-0.5"
        )}>
            {isUser ? (
                <div className="whitespace-pre-wrap break-words font-sans text-[11px] pr-4 min-w-0 leading-relaxed">{message.content}</div>
            ) : (
                <div className="text-[11px] leading-relaxed whitespace-pre-wrap break-words">
                    {renderInlineMarkdown(message.content)}
                </div>
            )}
        </div>
    );
}

// ── Compact Execution Trace ────────────────────────────────────────────────────

function ExecutionTrace({ steps, planSteps, intent, isLoading }: {
    steps: any[];
    planSteps: any[];
    intent: string | null;
    isLoading?: boolean;
}) {
    if (!steps.length && !planSteps?.length) return null;

    return (
        <div className="flex flex-col gap-0.5 select-none bg-muted/20 rounded-lg p-1.5 border border-border/30">
            {planSteps?.map((ps: any) => (
                <div key={ps.id} className="flex items-center gap-2 py-1 px-1.5">
                    <StatusDot status={ps.status} />
                    <span className={cn(
                        "text-[10px] tracking-tight",
                        ps.status === 'running' && "text-foreground/90 font-semibold",
                        ps.status === 'done' && "text-muted-foreground/40",
                        ps.status === 'error' && "text-red-500",
                        ps.status === 'pending' && "text-muted-foreground/30",
                    )}>{ps.description || ps.tool}</span>
                </div>
            ))}
            {steps.map((step: any) => (
                <div key={step.id} className="flex items-center gap-2 py-1 px-1.5">
                    <StatusDot status={step.status} running={isLoading && step.status === 'running'} />
                    <span className={cn(
                        "text-[10px] font-semibold tracking-tight",
                        step.status === 'running' && "text-foreground/90",
                        step.status === 'done' && "text-muted-foreground/70",
                        step.status === 'error' && "text-red-500",
                    )}>{step.label || step.type}</span>
                    {step.latencyMs && (
                        <span className="text-[9px] text-muted-foreground/30 font-mono ml-auto tabular-nums">{step.latencyMs}ms</span>
                    )}
                </div>
            ))}
        </div>
    );
}

function StatusDot({ status, running }: { status: string; running?: boolean }) {
    if (running) return <span className="w-2.5 h-2.5 flex items-center justify-center"><span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" /></span>;
    if (status === 'done') return <span className="w-2.5 h-2.5 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" /></span>;
    if (status === 'error') return <span className="w-2.5 h-2.5 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /></span>;
    return <span className="w-2.5 h-2.5 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/15" /></span>;
}

function formatCredit(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

// ── Minimal Inline Markdown ────────────────────────────────────────────────────

function renderInlineMarkdown(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
        const codeMatch = remaining.match(/^`([^`]+)`/);
        if (codeMatch) {
            parts.push(<code key={key++} className="px-1 py-px bg-muted/40 rounded text-[10px] font-mono">{codeMatch[1]}</code>);
            remaining = remaining.slice(codeMatch[0].length);
            continue;
        }
        const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
        if (boldMatch && boldMatch.index !== undefined) {
            if (boldMatch.index > 0) parts.push(remaining.slice(0, boldMatch.index));
            parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
            remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
            continue;
        }
        const italicMatch = remaining.match(/\*(.+?)\*/);
        if (italicMatch && italicMatch.index !== undefined) {
            if (italicMatch.index > 0) parts.push(remaining.slice(0, italicMatch.index));
            parts.push(<em key={key++}>{italicMatch[1]}</em>);
            remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
            continue;
        }
        parts.push(remaining);
        break;
    }

    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
}

export default memo(ResonaChatBodyConnected);
