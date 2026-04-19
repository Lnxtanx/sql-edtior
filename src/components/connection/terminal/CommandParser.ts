// =============================================================================
// CommandParser
// Parses raw terminal input into a structured ParsedCommand.
// Pure function — no side effects.
// =============================================================================

import type { ParsedCommand } from './types';

/** Canonical command aliases → normalized name */
const ALIASES: Record<string, string> = {
    'sw pull': 'pull',
    'pull': 'pull',
    'sw push': 'push',
    'push': 'push',
    'sw diff': 'diff',
    'diff': 'diff',
    'sw status': 'status',
    'status': 'status',
    'sw health': 'health',
    'health': 'health',
    'sw rollback': 'rollback',
    'rollback': 'rollback',
    'clear': 'clear',
    'help': 'help',
};

/**
 * Parse a raw input string into a `ParsedCommand`.
 *
 * Handles:
 * - "sw pull"          → { command: 'pull', args: [], isValid: true }
 * - "pull --schema=x"  → { command: 'pull', args: ['--schema=x'], isValid: true }
 * - "foo"              → { command: null, args: [], isValid: false }
 * - ""                 → { command: null, args: [], isValid: false }
 */
export function parseCommand(input: string): ParsedCommand {
    const raw = input.trim();
    if (!raw) {
        return { raw, command: null, args: [], isValid: false };
    }

    const lower = raw.toLowerCase();

    // Try matching the longest alias first ("sw pull" before "pull")
    // Sort by alias length descending so "sw pull" is tested before "pull"
    for (const alias of Object.keys(ALIASES).sort((a, b) => b.length - a.length)) {
        if (lower === alias || lower.startsWith(alias + ' ')) {
            const rest = raw.slice(alias.length).trim();
            const args = rest ? rest.split(/\s+/) : [];
            return {
                raw,
                command: ALIASES[alias],
                args,
                isValid: true,
            };
        }
    }

    return { raw, command: null, args: [], isValid: false };
}

/** Human-readable help text for each command */
export const COMMAND_HELP: { command: string; alias: string; description: string }[] = [
    { command: 'pull', alias: 'sw pull', description: 'Pull schema from database into editor' },
    { command: 'push', alias: 'sw push', description: 'Preview Atlas migration SQL (drop & recreate)' },
    { command: 'push-apply', alias: 'sw push --apply', description: 'Apply migration directly (drop & recreate)' },
    { command: 'push-force', alias: 'sw push --apply --force', description: 'Force apply (skip destructive check)' },
    { command: 'push-safe', alias: 'sw push --safe', description: 'Preview with smart migration (zero-downtime, data-safe)' },
    { command: 'push-safe-apply', alias: 'sw push --safe --apply', description: 'Apply smart migration (preserves row data)' },
    { command: 'diff', alias: 'sw diff', description: 'Detect drift (live vs last snapshot)' },
    { command: 'status', alias: 'sw status', description: 'Check sync status' },
    { command: 'health', alias: 'sw health', description: 'Check connection health' },
    { command: 'rollback', alias: 'sw rollback', description: 'Rollback last migration' },
    { command: 'clear', alias: 'clear', description: 'Clear terminal' },
    { command: 'help', alias: 'help', description: 'Show this help' },
];
