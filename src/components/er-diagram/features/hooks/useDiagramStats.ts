import { useEffect } from 'react';
import { Table, View, Relationship } from '@/lib/sql-parser';
import { SchemaGraph, GraphStats } from '@/lib/schema-workspace';
import { toNodeId } from '@/lib/schema-workspace/utils';

interface UseDiagramStatsProps {
    focusTable?: string | null;
    onStatsChange?: (stats: GraphStats | null) => void;
    graph: SchemaGraph | null;
    riskMap: Map<string, any>;
    filteredTables: Table[];
    filteredRelationships: Relationship[];
    filteredViews?: View[];
    filteredMatViews?: View[];
    depthCounts?: Map<number, number>;
}

export function useDiagramStats({
    focusTable,
    onStatsChange,
    graph,
    riskMap,
    filteredTables,
    filteredRelationships,
    filteredViews = [],
    filteredMatViews = [],
    depthCounts
}: UseDiagramStatsProps) {
    // Calculate and Report Stats
    useEffect(() => {
        if (!onStatsChange || !graph) return;

        // When no focus table, clear stats for the impact panel
        if (!focusTable) {
            onStatsChange(null);
            return;
        }

        // Default stats if no riskMap available yet
        if (!riskMap) return;

        // Calculate aggregations based on the FILTERED view (what the user sees)
        const tableCount = filteredTables.length + filteredViews.length + filteredMatViews.length;
        const relationshipCount = filteredRelationships.length;

        // Confidence average
        const confidenceSum = filteredRelationships.reduce((sum, rel) => sum + (rel.confidence ?? 1.0), 0);
        const avgConfidence = relationshipCount > 0 ? confidenceSum / relationshipCount : 1.0;

        // Cascade Risk Analysis on the visible subgraph
        let highestRisk: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' = 'NONE';
        let highRiskCount = 0;

        for (const table of filteredTables) {
            const nodeId = toNodeId(table.schema, table.name);
            const risk = riskMap.get(nodeId);
            if (risk) {
                if (risk.level === 'HIGH') {
                    highestRisk = 'HIGH';
                    highRiskCount++;
                } else if (risk.level === 'MEDIUM' && highestRisk !== 'HIGH') {
                    highestRisk = 'MEDIUM';
                } else if (risk.level === 'LOW' && highestRisk === 'NONE') {
                    highestRisk = 'LOW';
                }
            }
        }

        // Compute focused-table-specific stats
        const node = graph.nodes.get(focusTable);
        const isViewFocus = node?.type === 'VIEW' || node?.type === 'MATERIALIZED_VIEW';

        // For tables: index/policy/trigger counts. For views: these will be 0.
        const indexCount = isViewFocus ? 0 : graph.indexes.filter(idx => toNodeId(idx.schema, idx.table) === focusTable).length;
        const policyCount = isViewFocus ? 0 : graph.policies.filter(p => toNodeId(p.schema, p.table) === focusTable).length;
        const triggerCount = isViewFocus ? 0 : graph.triggers.filter(t => toNodeId(t.schema, t.table) === focusTable).length;

        // For views: outbound VIEW_DEPENDENCY edges point to source tables
        const sourceTableCount = node ? node.outbound.filter(r => r.type === 'VIEW_DEPENDENCY').length : 0;
        // For tables: inbound VIEW_DEPENDENCY edges = dependent views
        const dependentViewCount = node ? node.inbound.filter(r => r.type === 'VIEW_DEPENDENCY').length : 0;
        const inboundFkCount = node ? node.inbound.filter(r => r.type === 'FOREIGN_KEY').length : 0;
        const outboundFkCount = node ? node.outbound.filter(r => r.type === 'FOREIGN_KEY').length : 0;

        onStatsChange({
            tableCount,
            relationshipCount,
            cascadeRiskLevel: highestRisk,
            highRiskTableCount: highRiskCount,
            avgConfidence,
            depthCounts,
            focusedTable: focusTable,
            isViewFocus,
            sourceTableCount,
            indexCount,
            policyCount,
            triggerCount,
            dependentViewCount,
            inboundFkCount,
            outboundFkCount,
        });

    }, [focusTable, filteredTables, filteredRelationships, filteredViews, filteredMatViews, riskMap, onStatsChange, graph, depthCounts]);
}
