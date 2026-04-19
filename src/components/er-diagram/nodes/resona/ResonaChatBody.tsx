/**
 * ResonaChatBody
 *
 * Shared chat input + message display used by all Resona node variants.
 * UI-only — no backend calls. Shows a "coming soon" message on submit.
 */

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/* ─── lightweight inline-markdown renderer ─── */

/** Parse a single line into React elements handling **bold**, *italic*, `code` */
function parseInline(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    // Regex: **bold**, *italic*, `code`
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = re.exec(text)) !== null) {
        if (match.index > last) parts.push(text.slice(last, match.index));
        if (match[2]) parts.push(<strong key={key++}>{match[2]}</strong>);
        else if (match[3]) parts.push(<em key={key++}>{match[3]}</em>);
        else if (match[4]) parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[11px] font-mono">{match[4]}</code>);
        last = match.index + match[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
}

/** Render markdown-ish content: code blocks, bullet lists, paragraphs, inline formatting */
function renderMarkdown(content: string) {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;
    let key = 0;

    while (i < lines.length) {
        const line = lines[i];

        // fenced code block ```
        if (line.trimStart().startsWith('```')) {
            const codeLines: string[] = [];
            i++;
            while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            i++; // skip closing ```
            elements.push(
                <pre key={key++} className="my-1 p-2 rounded bg-black/10 dark:bg-white/10 overflow-x-auto text-[11px] font-mono leading-relaxed">
                    {codeLines.join('\n')}
                </pre>,
            );
            continue;
        }

        // bullet list items (- or *)
        if (/^\s*[-*]\s/.test(line)) {
            const items: React.ReactNode[] = [];
            while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
                items.push(<li key={key++}>{parseInline(lines[i].replace(/^\s*[-*]\s/, ''))}</li>);
                i++;
            }
            elements.push(<ul key={key++} className="list-disc list-inside my-1 space-y-0.5">{items}</ul>);
            continue;
        }

        // numbered list items
        if (/^\s*\d+[.)]\s/.test(line)) {
            const items: React.ReactNode[] = [];
            while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i])) {
                items.push(<li key={key++}>{parseInline(lines[i].replace(/^\s*\d+[.)]\s/, ''))}</li>);
                i++;
            }
            elements.push(<ol key={key++} className="list-decimal list-inside my-1 space-y-0.5">{items}</ol>);
            continue;
        }

        // blank line → spacing
        if (line.trim() === '') {
            i++;
            continue;
        }

        // normal paragraph
        elements.push(<p key={key++} className="my-0.5">{parseInline(line)}</p>);
        i++;
    }

    return elements;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface ResonaChatBodyProps {
    placeholder?: string;
    suggestions?: string[];
    tagline?: string;
}

function ResonaChatBody({ placeholder = 'Ask Resona...', suggestions, tagline = 'Your schema, understood.' }: ResonaChatBodyProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    /** Auto-grow textarea to fit content, max 5 rows */
    const autoGrow = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 100)}px`; // ~5 rows
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isThinking]);

    const handleSend = () => {
        const text = input.trim();
        if (!text) return;

        const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setIsThinking(true);

        // Reset textarea height
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        setTimeout(() => {
            setIsThinking(false);
            toast.info('AI analysis coming soon — backend not yet connected.');
        }, 600);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
        // Shift+Enter inserts a newline (default textarea behavior)
    };

    const handleSuggestionClick = (text: string) => {
        setInput(text);
        textareaRef.current?.focus();
    };

    return (
        <>
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <p className="text-[11px] text-muted-foreground/60 italic font-light tracking-wide">{tagline}</p>
                        {suggestions && suggestions.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 justify-center px-2 mt-1">
                                {suggestions.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => handleSuggestionClick(s)}
                                        className="text-[10px] px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/30 hover:border-border/60 font-medium"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={cn(
                            'flex',
                            msg.role === 'user' ? 'justify-end' : 'justify-start',
                        )}
                    >
                        <div
                            className={cn(
                                'px-3 py-2 rounded-xl text-[12px] leading-relaxed max-w-[85%] font-[system-ui,sans-serif]',
                                msg.role === 'user'
                                    ? 'bg-muted/80 text-foreground whitespace-pre-wrap rounded-br-sm'
                                    : 'bg-muted/50 text-foreground border border-border/30 rounded-bl-sm',
                            )}
                        >
                            {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                        </div>
                    </div>
                ))}

                {isThinking && (
                    <div className="flex justify-start">
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/50 border border-border/30 text-muted-foreground text-[12px] rounded-bl-sm">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span className="font-light tracking-wide">Thinking…</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="px-3 py-2.5 border-t border-border/30 flex items-end gap-2 nodrag bg-muted/20">
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => { setInput(e.target.value); autoGrow(); }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    rows={1}
                    className="flex-1 text-[12px] bg-transparent outline-none placeholder:text-muted-foreground/40 px-1 resize-none leading-relaxed max-h-[100px] font-[system-ui,sans-serif]"
                />
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-full flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                    disabled={!input.trim() || isThinking}
                    onClick={handleSend}
                >
                    <Send className="w-3.5 h-3.5" />
                </Button>
            </div>
        </>
    );
}

export default memo(ResonaChatBody);
