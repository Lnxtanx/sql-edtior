// =============================================================================
// Terminal Types
// Shared type definitions for the interactive terminal system
// =============================================================================

/** A single line rendered in the terminal */
export interface TerminalLine {
    id: string;
    type: 'prompt' | 'output' | 'info' | 'success' | 'error' | 'system';
    content: string;
    timestamp: number;
}

/** Parsed command from user input */
export interface ParsedCommand {
    raw: string;
    /** Normalized command name: 'pull', 'push', 'diff', 'status', 'health', 'clear', 'help', or null if invalid */
    command: string | null;
    args: string[];
    isValid: boolean;
}

/** Output callback — used by the execution engine to stream lines into the terminal */
export type OutputWriter = (type: TerminalLine['type'], content: string) => void;

/** Terminal configuration */
export interface TerminalConfig {
    /** Connection name shown in prompt (e.g. "voxa-test") */
    connectionName?: string;
    /** Maximum lines kept in the buffer before pruning old lines */
    maxLines?: number;
    /** Maximum command history entries */
    maxHistory?: number;
    /** Prompt prefix — defaults to "sw" */
    promptPrefix?: string;
}

/** The public API returned by useTerminal */
export interface TerminalHandle {
    lines: TerminalLine[];
    inputValue: string;
    isExecuting: boolean;
    setInputValue: (v: string) => void;
    submit: () => void;
    handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    clear: () => void;
    /** Write a line programmatically (e.g. from outside the terminal) */
    write: OutputWriter;
    promptText: string;
    /** Execute a command programmatically (e.g. from CommandReference click) */
    runCommand: (cmd: string) => void;
    /** Copy all terminal lines to clipboard */
    copyToClipboard: () => void;
}
