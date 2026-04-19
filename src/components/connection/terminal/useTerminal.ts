// =============================================================================
// useTerminal
// Composes HistoryManager, CommandParser, ExecutionEngine, and line buffer
// into a single ergonomic hook that powers the TerminalRenderer.
// =============================================================================

import { useState, useCallback, useRef, useMemo } from 'react';
import { HistoryManager } from './HistoryManager';
import { parseCommand } from './CommandParser';
import { useExecutionEngine } from './ExecutionEngine';
import type { TerminalLine, TerminalConfig, TerminalHandle, OutputWriter } from './types';

let lineIdCounter = 0;
const nextLineId = () => `tl-${++lineIdCounter}-${Date.now()}`;

export function useTerminal(config: TerminalConfig & {
    connectionId: string | null;
    onSchemaPulled?: (schema: any) => void;
}): TerminalHandle {
    const {
        connectionName,
        connectionId,
        onSchemaPulled,
        maxLines = 500,
        maxHistory = 100,
        promptPrefix = 'sw',
    } = config;

    // ─── State ───────────────────────────────────────────────────────────────

    const [lines, setLines] = useState<TerminalLine[]>([]);
    const [inputValue, setInputValue] = useState('');

    const historyRef = useRef(new HistoryManager(maxHistory));
    const history = historyRef.current;

    // ─── Execution engine ────────────────────────────────────────────────────

    const engine = useExecutionEngine({ connectionId, onSchemaPulled });

    // ─── Build prompt text ───────────────────────────────────────────────────

    const promptText = useMemo(() => {
        const parts: string[] = [];
        if (connectionName) parts.push(connectionName);
        parts.push(promptPrefix);
        return parts.join(' ') + ' > ';
    }, [connectionName, promptPrefix]);

    // ─── Line helpers ────────────────────────────────────────────────────────

    const appendLine = useCallback(
        (type: TerminalLine['type'], content: string) => {
            const line: TerminalLine = {
                id: nextLineId(),
                type,
                content,
                timestamp: Date.now(),
            };
            setLines((prev) => {
                const next = [...prev, line];
                // Prune if over capacity
                return next.length > maxLines ? next.slice(next.length - maxLines) : next;
            });
        },
        [maxLines]
    );

    /** OutputWriter handed to the engine for streaming lines */
    const write: OutputWriter = useCallback(
        (type, content) => appendLine(type, content),
        [appendLine]
    );

    // ─── Submit ──────────────────────────────────────────────────────────────

    const submit = useCallback(() => {
        const raw = inputValue.trim();
        if (!raw) return;

        // 1. Freeze the prompt + command as a "prompt" line
        appendLine('prompt', `${promptText}${raw}`);

        // 2. Push to history
        history.push(raw);

        // 3. Clear input immediately (feels snappy)
        setInputValue('');

        // 4. Handle "clear" locally
        const parsed = parseCommand(raw);
        if (parsed.command === 'clear') {
            setLines([]);
            return;
        }

        // 5. Execute (async — output streams in via write())
        engine.execute(raw, write);
    }, [inputValue, appendLine, promptText, history, engine, write]);

    // ─── Key handling ────────────────────────────────────────────────────────

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            switch (e.key) {
                case 'Enter':
                    e.preventDefault();
                    submit();
                    break;

                case 'ArrowUp': {
                    e.preventDefault();
                    const prev = history.up(inputValue);
                    if (prev !== null) setInputValue(prev);
                    break;
                }

                case 'ArrowDown': {
                    e.preventDefault();
                    const next = history.down();
                    if (next !== null) setInputValue(next);
                    break;
                }

                case 'Escape':
                    setInputValue('');
                    history.reset();
                    break;

                case 'l':
                    // Ctrl+L = clear (like a real terminal)
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        setLines([]);
                    }
                    break;

                case 'c':
                    // Ctrl+C = cancel current input
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (inputValue) {
                            appendLine('prompt', `${promptText}${inputValue}^C`);
                            setInputValue('');
                        }
                    }
                    break;

                default:
                    break;
            }
        },
        [submit, history, inputValue, appendLine, promptText]
    );

    // ─── Clear ───────────────────────────────────────────────────────────────

    const clear = useCallback(() => setLines([]), []);

    // ─── Run command programmatically (bypasses input state) ─────────────────

    const runCommand = useCallback(
        (cmd: string) => {
            const raw = cmd.trim();
            if (!raw) return;

            // Freeze as prompt line
            appendLine('prompt', `${promptText}${raw}`);
            history.push(raw);
            setInputValue('');

            const parsed = parseCommand(raw);
            if (parsed.command === 'clear') {
                setLines([]);
                return;
            }

            engine.execute(raw, write);
        },
        [appendLine, promptText, history, engine, write]
    );

    // ─── Return handle ───────────────────────────────────────────────────────

    return {
        lines,
        inputValue,
        isExecuting: engine.isExecuting,
        setInputValue,
        submit,
        handleKeyDown,
        clear,
        write,
        promptText,
        runCommand,
        copyToClipboard: useCallback(() => {
            const content = lines.map(l => l.content).filter(c => c.trim() !== '').join('\n');
            if (content) {
                navigator.clipboard.writeText(content);
            }
        }, [lines]),
    };
}
