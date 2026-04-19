// =============================================================================
// Editor Event Bus
// Lightweight pub/sub singleton for cross-component editor commands.
// Components that can't directly call SqlEditor.tsx state setters (e.g. the
// floating DatabaseDashboardPanel) use this bus to dispatch actions.
// =============================================================================

type DiffResult = {
    liveSql: string;
    migrationSql?: string;
    atlasSummary?: any;
    isEmpty?: boolean;
};

type EditorEvent =
    | { type: 'SET_SQL'; sql: string }
    | { type: 'OPEN_DIFF'; diff: DiffResult; connectionId: string };

type Listener = (event: EditorEvent) => void;

const listeners = new Set<Listener>();

export const editorBus = {
    /** Emit an event to all subscribers */
    emit(event: EditorEvent) {
        listeners.forEach((fn) => fn(event));
    },

    /** Subscribe to editor events. Returns an unsubscribe function. */
    subscribe(fn: Listener) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    },

    // ── Convenience helpers ───────────────────────────────────────────────────

    /** Set SQL content in the active editor (from pull) */
    setSql(sql: string) {
        this.emit({ type: 'SET_SQL', sql });
    },

    /** Open the diff panel with a pre-loaded result */
    openDiff(diff: DiffResult, connectionId: string) {
        this.emit({ type: 'OPEN_DIFF', diff, connectionId });
    },
};
