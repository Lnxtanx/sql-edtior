import { useSyncExternalStore } from 'react';

interface DashboardState {
    isOpen: boolean;
    isPinned: boolean;
    connectionId: string | null;
}

const STORAGE_KEY = 'schema-weaver:dashboard-panel';

const getInitialState = (): DashboardState => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return {
                isOpen: false, // Always closed on reload
                isPinned: !!parsed.isPinned,
                connectionId: parsed.connectionId || null,
            };
        }
    } catch (e) {
        // ignore
    }
    return { isOpen: false, isPinned: false, connectionId: null };
};

class DashboardStore {
    private state: DashboardState = getInitialState();
    private listeners = new Set<() => void>();

    private save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            isPinned: this.state.isPinned,
            connectionId: this.state.connectionId,
        }));
    }

    private emit() {
        this.listeners.forEach(l => l());
    }

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    getSnapshot = () => this.state;

    open = (connectionId: string) => {
        this.state = { ...this.state, isOpen: true, connectionId };
        this.save();
        this.emit();
    }

    close = () => {
        if (this.state.isPinned) return;
        this.state = { ...this.state, isOpen: false };
        this.emit();
    }

    forceClose = () => {
        this.state = { ...this.state, isOpen: false };
        this.emit();
    }

    togglePin = () => {
        this.state = { ...this.state, isPinned: !this.state.isPinned };
        this.save();
        this.emit();
    }
}

export const dashboardStore = new DashboardStore();

export function useDashboardPanel() {
    const state = useSyncExternalStore(dashboardStore.subscribe, dashboardStore.getSnapshot);
    return {
        ...state,
        open: dashboardStore.open,
        close: dashboardStore.close,
        forceClose: dashboardStore.forceClose,
        togglePin: dashboardStore.togglePin,
    };
}
