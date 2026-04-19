import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface Position {
    x: number;
    y: number;
}

interface DiagramPositionsState {
    // Schema-scoped positions so they don't leak across different databases
    // Store is keyed: { [schemaId]: { [nodeId]: Position } }

    // User-dragged positions (manual overrides)
    positions: Record<string, Record<string, Position>>;

    // ELK-computed positions (for restoring when unhiding nodes)
    elkPositions: Record<string, Record<string, Position>>;

    // Set a user-dragged position for a specific schema and node
    setPosition: (schemaId: string, nodeId: string, position: Position) => void;

    // Get all user positions for a specific schema
    getPositions: (schemaId: string) => Record<string, Position>;

    // Issue 2.6: Store ELK-computed positions for all nodes
    setElkPositions: (schemaId: string, positions: Record<string, Position>) => void;

    // Get a specific ELK position for a node
    getElkPosition: (schemaId: string, nodeId: string) => Position | undefined;

    // Get all ELK positions for a schema
    getElkPositions: (schemaId: string) => Record<string, Position>;

    // Reset all user-dragged positions for a specific schema (restores ELK auto-layout)
    // Also clears the in-memory ELK cache for that schema so a fresh layout is computed.
    resetPositions: (schemaId: string) => void;

    // Delete all position data for schemas NOT in the provided list (memory cleanup).
    pruneStaleSchemas: (activeSchemaIds: string[]) => void;
}

export const useDiagramPositionsStore = create<DiagramPositionsState>()(
    persist(
        (set, get) => ({
            positions: {},
            elkPositions: {},

            setPosition: (schemaId: string, nodeId: string, position: Position) => {
                set((state) => ({
                    positions: {
                        ...state.positions,
                        [schemaId]: {
                            ...(state.positions[schemaId] || {}),
                            [nodeId]: position,
                        }
                    }
                }));
            },

            getPositions: (schemaId: string) => {
                return get().positions[schemaId] || {};
            },

            setElkPositions: (schemaId: string, positions: Record<string, Position>) => {
                set((state) => ({
                    elkPositions: {
                        ...state.elkPositions,
                        [schemaId]: positions,
                    }
                }));
            },

            getElkPosition: (schemaId: string, nodeId: string) => {
                return get().elkPositions[schemaId]?.[nodeId];
            },

            getElkPositions: (schemaId: string) => {
                return get().elkPositions[schemaId] || {};
            },

            resetPositions: (schemaId: string) => {
                set((state) => {
                    const nextPositions = { ...state.positions };
                    const nextElk = { ...state.elkPositions };
                    delete nextPositions[schemaId];
                    delete nextElk[schemaId];
                    return { positions: nextPositions, elkPositions: nextElk };
                });
            },

            pruneStaleSchemas: (activeSchemaIds: string[]) => {
                set((state) => {
                    const activeSet = new Set(activeSchemaIds);
                    const nextPositions: Record<string, Record<string, Position>> = {};
                    const nextElk: Record<string, Record<string, Position>> = {};
                    for (const id of activeSet) {
                        if (state.positions[id]) nextPositions[id] = state.positions[id];
                        if (state.elkPositions[id]) nextElk[id] = state.elkPositions[id];
                    }
                    return { positions: nextPositions, elkPositions: nextElk };
                });
            },
        }),
        {
            name: 'schema-weaver-diagram-positions', // localStorage key
            storage: createJSONStorage(() => localStorage),
            // Only persist user-dragged positions - ELK positions are recomputed on each
            // load so there's no benefit in bloating localStorage with them.
            partialize: (state) => ({ positions: state.positions }),
        }
    )
);
