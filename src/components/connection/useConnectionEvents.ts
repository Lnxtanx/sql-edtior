// =============================================================================
// Connection Event Bus
// Ensures ConnectionDialog, ConnectionPanel, and FileConnectionLink stay in sync.
// Uses a simple pub/sub pattern — no external deps.
// =============================================================================

type ConnectionEventType =
    | 'connections:changed'   // connection list was mutated (add/delete)
    | 'connection:linked'     // file was linked to a connection
    | 'connection:unlinked';  // file was unlinked

type Listener = (event: ConnectionEventType, data?: any) => void;

const listeners = new Set<Listener>();

export function onConnectionEvent(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function emitConnectionEvent(event: ConnectionEventType, data?: any) {
    listeners.forEach(fn => fn(event, data));
}
