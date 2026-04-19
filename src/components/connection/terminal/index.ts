// =============================================================================
// Terminal — barrel export
// =============================================================================

export { TerminalRenderer } from './TerminalRenderer';
export { useTerminal } from './useTerminal';
export { HistoryManager } from './HistoryManager';
export { parseCommand, COMMAND_HELP } from './CommandParser';
export { useExecutionEngine } from './ExecutionEngine';

export type {
    TerminalLine,
    TerminalConfig,
    TerminalHandle,
    ParsedCommand,
    OutputWriter,
} from './types';
