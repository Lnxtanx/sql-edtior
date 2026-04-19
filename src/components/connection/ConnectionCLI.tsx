/**
 * ConnectionCLI
 *
 * Interactive CLI terminal for Schema Weaver.
 * Behaves like a real terminal with inline prompt, command history,
 * streaming output, and connection-aware prompt prefix.
 *
 * Architecture:
 *   useTerminal  → composes HistoryManager + CommandParser + ExecutionEngine
 *   TerminalRenderer → renders lines + inline prompt (no fixed input box)
 */

import { forwardRef, useImperativeHandle } from 'react';
import { TerminalRenderer, useTerminal } from './terminal';

// Keep the CLILog type exported for backward compat (used by useConnectionActions)
export interface CLILog {
    timestamp: Date;
    type: 'command' | 'info' | 'success' | 'error' | 'output';
    message: string;
}

/** Imperative handle exposed via ref */
export interface ConnectionCLIHandle {
    runCommand: (cmd: string) => void;
    copyToClipboard: () => void;
}

interface ConnectionCLIProps {
    connectionId: string | null;
    connectionName?: string;
    fileName?: string;
    onClose: () => void;
    onSchemaPulled?: (schema: any) => void;
    hideHeader?: boolean;
}

export const ConnectionCLI = forwardRef<ConnectionCLIHandle, ConnectionCLIProps>(
    function ConnectionCLI(
        {
            connectionId,
            connectionName,
            fileName,
            onClose,
            onSchemaPulled,
            hideHeader,
        },
        ref
    ) {
        const terminal = useTerminal({
            connectionId,
            connectionName,
            onSchemaPulled,
            maxLines: 500,
            maxHistory: 100,
        });

        useImperativeHandle(ref, () => ({
            runCommand: terminal.runCommand,
            copyToClipboard: terminal.copyToClipboard,
        }), [terminal.runCommand, terminal.copyToClipboard]);

        return (
            <TerminalRenderer
                terminal={terminal}
                onClose={onClose}
                connectionName={connectionName}
                fileName={fileName}
                hideHeader={hideHeader}
            />
        );
    }
);

export default ConnectionCLI;

