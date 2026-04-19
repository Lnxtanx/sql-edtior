import { useState, useEffect, useCallback, useMemo } from 'react';
import { SchemaGraph, getShortestPath, getWeightedShortestPath, buildWeightedAdjacencyLists } from '@/lib/schema-workspace';
import { Relationship } from '@/lib/sql-parser';

export type PathStrategy = 'BFS' | 'DIJKSTRA';

export interface PathStep {
    source: string;
    target: string;
    rel: Relationship;
    direction: string | '->' | '<-';
}

export interface PathAnalysisOptions {
    excludeInferred?: boolean;
    excludeLowConfidence?: boolean; // <0.8
}

export function usePathAnalysis(
    graph: SchemaGraph | null,
    relationships: Relationship[],
    options: PathAnalysisOptions = {}
) {
    const [pathMode, setPathMode] = useState(false);
    const [pathStart, setPathStart] = useState<string | null>(null);
    const [pathEnd, setPathEnd] = useState<string | null>(null);
    const [pathStrategy, setPathStrategy] = useState<PathStrategy>('BFS');

    // Reset path when mode changes
    useEffect(() => {
        if (!pathMode) {
            setPathStart(null);
            setPathEnd(null);
        }
    }, [pathMode]);

    // Handle path node selection
    const handlePathNodeClick = useCallback((nodeId: string) => {
        if (!pathMode) return;

        if (!pathStart) {
            setPathStart(nodeId);
        } else if (!pathEnd && nodeId !== pathStart) {
            setPathEnd(nodeId);
        } else if (pathStart && pathEnd) {
            // Reset and start over
            setPathStart(nodeId);
            setPathEnd(null);
        }
    }, [pathMode, pathStart, pathEnd]);

    // Filter relationships based on options
    const filteredRelationships = useMemo(() => {
        return relationships.filter(rel => {
            if (options.excludeInferred && (rel.type === 'VIEW_DEPENDENCY' || rel.type === 'TRIGGER_TARGET' || rel.type === 'INFERRED')) return false;

            // Also check for explicit INFERRED type if not covered above
            if (options.excludeInferred && rel.type === 'INFERRED') return false;

            if (options.excludeLowConfidence && (rel.confidence ?? 1) < 0.8) return false;

            return true;
        });
    }, [relationships, options.excludeInferred, options.excludeLowConfidence]);

    // Optimization: Cache the Weighted Adjacency Map
    // This prevents rebuilding the map on every path calculation (O(E) cost).
    // It only rebuilds when the FILTERED relationship graph changes.
    const weightedAdjacency = useMemo(() => {
        // We use filteredRelationships here, not graph.relationships
        return buildWeightedAdjacencyLists(filteredRelationships);
    }, [filteredRelationships]);

    // Calculate Shortest Path
    const calculatedResult = useMemo(() => {
        if (!pathMode || !pathStart || !pathEnd) return null;

        // Ensure nodes exist in adjacency. If filtered out edges cause isolation, path might not exist.
        // The algorithm handles missing keys gracefully (returns null path).

        if (pathStrategy === 'BFS') {
            return getShortestPath(pathStart, pathEnd, weightedAdjacency);
        } else {
            return getWeightedShortestPath(pathStart, pathEnd, weightedAdjacency);
        }
    }, [pathMode, pathStart, pathEnd, pathStrategy, weightedAdjacency]);

    // Derive Path Metadata
    const pathDetails = useMemo(() => {
        if (!calculatedResult || !calculatedResult.path || calculatedResult.path.length < 2) return null;

        const { path, edges } = calculatedResult;
        const steps: PathStep[] = [];

        // Edge count should be path.length - 1
        for (let i = 0; i < path.length - 1; i++) {
            const source = path[i];
            const target = path[i + 1];

            // Use the specific edge chosen by the algorithm
            const rel = edges[i];

            if (rel) {
                // Determine direction
                // rel.source is { schema, table }
                // source is schema.table (qualified ID)

                // Helper to construct ID from rel source
                const relSourceId = rel.source.schema
                    ? `${rel.source.schema}.${rel.source.table}`
                    : rel.source.table;

                // Also handle public schema default if source doesn't have it explicitly
                const matchesSource = relSourceId === source ||
                    (rel.source.table === source && rel.source.schema === 'public') ||
                    (`public.${rel.source.table}` === source && !rel.source.schema);

                steps.push({
                    source,
                    target,
                    rel,
                    direction: matchesSource ? '->' : '<-'
                });
            }
        }
        return steps;
    }, [calculatedResult]);

    const resetPath = useCallback(() => {
        setPathStart(null);
        setPathEnd(null);
    }, []);

    return {
        pathMode,
        setPathMode,
        pathStart,
        setPathStart,
        pathEnd,
        setPathEnd,
        pathStrategy,
        setPathStrategy,
        handlePathNodeClick,
        calculatedPath: calculatedResult?.path || null,
        pathCost: calculatedResult?.totalWeight || 0,
        pathDetails,
        resetPath
    };
}
