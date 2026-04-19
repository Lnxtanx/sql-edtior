// =============================================================================
// HistoryManager
// Ring-buffer for command history with up/down navigation.
// Pure logic — no React dependency.
// =============================================================================

export class HistoryManager {
    private entries: string[] = [];
    private cursor = -1;
    private draft = '';        // stash whatever the user was typing before navigating history
    private maxSize: number;

    constructor(maxSize = 100) {
        this.maxSize = maxSize;
    }

    /** Push a new command. Resets cursor. Deduplicates consecutive repeats. */
    push(command: string): void {
        const trimmed = command.trim();
        if (!trimmed) return;

        // Skip if it's a repeat of the last entry
        if (this.entries.length > 0 && this.entries[this.entries.length - 1] === trimmed) {
            this.cursor = -1;
            this.draft = '';
            return;
        }

        this.entries.push(trimmed);

        // Prune oldest if over capacity
        if (this.entries.length > this.maxSize) {
            this.entries = this.entries.slice(this.entries.length - this.maxSize);
        }

        this.cursor = -1;
        this.draft = '';
    }

    /** Navigate up (older). Returns the entry or null if at the top. */
    up(currentInput: string): string | null {
        if (this.entries.length === 0) return null;

        // Stash the current input when we first leave it
        if (this.cursor === -1) {
            this.draft = currentInput;
        }

        if (this.cursor < this.entries.length - 1) {
            this.cursor++;
        }

        return this.entries[this.entries.length - 1 - this.cursor] ?? null;
    }

    /** Navigate down (newer). Returns the entry, or the original draft when back at bottom. */
    down(): string | null {
        if (this.cursor <= 0) {
            this.cursor = -1;
            return this.draft;
        }

        this.cursor--;
        return this.entries[this.entries.length - 1 - this.cursor] ?? this.draft;
    }

    /** Reset navigation state (e.g. on submit). */
    reset(): void {
        this.cursor = -1;
        this.draft = '';
    }

    /** Get all entries (for debug). */
    getAll(): readonly string[] {
        return this.entries;
    }

    /** Current cursor position (-1 = not navigating). */
    get position(): number {
        return this.cursor;
    }
}
